/**
 * Phase 2: Shiprocket auto-dispatch orchestrator.
 *
 * Called AFTER payment is confirmed (Razorpay webhook `after()`), once per
 * order. Creates one Shiprocket shipment per creator pickup location:
 *   create order → assign AWB (cheapest courier, same logic as checkout)
 *   → schedule pickup → persist on the Shipment row.
 *
 * Hard guarantees:
 * - NEVER throws. Every failure is caught per creator and recorded on the
 *   Shipment row (`shipmentError`) so the studio can retry. A Shiprocket
 *   outage must never affect a confirmed payment.
 * - Idempotent. Re-running for an order skips creators that already have a
 *   Shiprocket shipment (the studio "Retry" button reuses this).
 * - Does NOT change the Order status. The creator still advances
 *   PACKED → SHIPPED manually after handing the parcel over; this only
 *   automates the courier paperwork (AWB + pickup request).
 */

import { prisma } from "@/lib/prisma";
import { OrderStatus } from "@prisma/client";
import {
  assignAwb,
  createShiprocketOrder,
  getCheapestCourierRate,
  isShiprocketConfigured,
  schedulePickup,
} from "./shiprocket";
import { getShippingSettings } from "./shipping";

export interface CreatorShipmentResult {
  creatorId: string;
  storeName: string;
  ok: boolean;
  awbCode?: string;
  courierName?: string;
  skipped?: string;
  error?: string;
}

/** Fallback parcel dimensions (cm) when the artwork has none recorded. */
const DEFAULT_DIMS_CM = { length: 30, breadth: 30, height: 10 };

type OrderItemWithArtwork = {
  id: string;
  quantity: number;
  titleSnapshot: string;
  unitPrice: unknown;
  creatorId: string;
  artwork: {
    weightGrams: number | null;
    widthCm: number | null;
    heightCm: number | null;
    depthCm: number | null;
  };
  creator: { storeName: string; pickupPincode: string | null };
};

export async function processOrderShipments(
  orderId: string,
): Promise<CreatorShipmentResult[]> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        address: true,
        customer: { select: { email: true } },
        items: {
          include: {
            artwork: {
              select: {
                weightGrams: true,
                widthCm: true,
                heightCm: true,
                depthCm: true,
              },
            },
            creator: {
              select: { storeName: true, pickupPincode: true },
            },
          },
        },
      },
    });

    if (!order || !order.address) {
      console.error(`[shipments] order ${orderId} not found or has no address`);
      return [];
    }
    // Only auto-dispatch paid, confirmed orders.
    if (order.status !== OrderStatus.ORDER_CONFIRMED) return [];

    const settings = await getShippingSettings();
    // Phase 2: one pickup location for all creators (admin-set nickname,
    // must match the Shiprocket panel exactly). Per-creator nicknames can
    // be added to CreatorProfile later without changing this flow.
    const pickupLocation = (settings.defaultPickupLocation || "").trim();
    if (!pickupLocation) {
      console.warn(
        `[shipments] order ${order.orderNumber}: no Shiprocket pickup location configured (admin → Shipping Settings). Skipping auto-dispatch.`,
      );
      return [];
    }
    if (!isShiprocketConfigured()) {
      console.warn(
        `[shipments] order ${order.orderNumber}: Shiprocket credentials not configured. Skipping auto-dispatch.`,
      );
      return [];
    }

    const deliveryPincode = order.address.postalCode;
    if (!/^\d{6}$/.test(deliveryPincode)) {
      console.error(
        `[shipments] order ${order.orderNumber}: invalid delivery pincode "${deliveryPincode}"`,
      );
      return [];
    }

    // Group items per creator (one Shiprocket shipment per pickup location).
    const groups = new Map<string, OrderItemWithArtwork[]>();
    for (const item of order.items) {
      const list = groups.get(item.creatorId) || [];
      list.push(item as OrderItemWithArtwork);
      groups.set(item.creatorId, list);
    }

    const email = order.customer?.email || "";
    const results: CreatorShipmentResult[] = [];
    for (const [creatorId, items] of groups) {
      const storeName = items[0]?.creator.storeName || "Studio";
      try {
        results.push(
          await dispatchCreatorShipment({
            orderId: order.id,
            orderNumber: order.orderNumber,
            address: order.address,
            customerEmail: email,
            creatorId,
            storeName,
            items,
            pickupLocation,
            deliveryPincode,
            fallbackPickupPincode: settings.defaultPickupPincode || "",
          }),
        );
      } catch (e) {
        const error = e instanceof Error ? e.message : "Unknown dispatch error";
        console.error(`[shipments] creator ${creatorId} dispatch failed:`, e);
        results.push({ creatorId, storeName, ok: false, error });
      }
    }
    return results;
  } catch (e) {
    // Absolute last resort: the orchestrator itself must never throw.
    console.error(`[shipments] processOrderShipments failed for ${orderId}:`, e);
    return [];
  }
}

/** Persist (or update) the Shipment row for a creator group. */
async function saveShipmentRow(
  srOrderId: string,
  data: {
    orderId: string;
    carrier?: string | null;
    trackingNumber?: string | null;
    shiprocketShipmentId?: string | null;
    awbCode?: string | null;
    courierId?: string | null;
    pickupLocation: string;
    shipmentError?: string | null;
  },
) {
  const row = {
    orderId: data.orderId,
    status: "PENDING" as const,
    carrier: data.carrier ?? null,
    trackingNumber: data.trackingNumber ?? null,
    shiprocketOrderId: srOrderId,
    shiprocketShipmentId: data.shiprocketShipmentId ?? null,
    awbCode: data.awbCode ?? null,
    courierId: data.courierId ?? null,
    pickupLocation: data.pickupLocation,
    shipmentError: data.shipmentError ?? null,
  };
  const already = await prisma.shipment.findFirst({
    where: { orderId: data.orderId, shiprocketOrderId: srOrderId },
    select: { id: true },
  });
  if (already) {
    await prisma.shipment.update({ where: { id: already.id }, data: row });
  } else {
    await prisma.shipment.create({ data: row });
  }
}

async function dispatchCreatorShipment(args: {
  orderId: string;
  orderNumber: string;
  address: {
    fullName: string;
    phone: string;
    line1: string;
    line2: string | null;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  customerEmail: string;
  creatorId: string;
  storeName: string;
  items: OrderItemWithArtwork[];
  pickupLocation: string;
  deliveryPincode: string;
  fallbackPickupPincode: string;
}): Promise<CreatorShipmentResult> {
  const {
    orderId,
    orderNumber,
    address,
    customerEmail,
    creatorId,
    storeName,
    items,
    pickupLocation,
    deliveryPincode,
    fallbackPickupPincode,
  } = args;

  // Idempotency: our Shiprocket order_id is deterministic per
  // order+creator, so a retry reuses it and we skip finished rows.
  const srOrderId = `${orderNumber}-${creatorId.slice(-8)}`;
  const done = await prisma.shipment.findFirst({
    where: { orderId, shiprocketOrderId: srOrderId, awbCode: { not: null } },
    select: { awbCode: true, carrier: true },
  });
  if (done?.awbCode) {
    return {
      creatorId,
      storeName,
      ok: true,
      awbCode: done.awbCode,
      courierName: done.carrier || undefined,
      skipped: "already dispatched",
    };
  }

  const fail = async (error: string): Promise<CreatorShipmentResult> => {
    await saveShipmentRow(srOrderId, {
      orderId,
      pickupLocation,
      shipmentError: error,
    });
    return { creatorId, storeName, ok: false, error };
  };

  // Parcel totals for this creator's items.
  const weightKg = items.reduce(
    (sum, it) => sum + ((it.artwork.weightGrams ?? 500) * it.quantity) / 1000,
    0,
  );
  const lengthCm = Math.max(
    DEFAULT_DIMS_CM.length,
    ...items.map((it) => it.artwork.widthCm ?? DEFAULT_DIMS_CM.length),
  );
  const breadthCm = Math.max(
    DEFAULT_DIMS_CM.breadth,
    ...items.map((it) => it.artwork.depthCm ?? DEFAULT_DIMS_CM.breadth),
  );
  const heightCm = Math.max(
    DEFAULT_DIMS_CM.height,
    ...items.map((it) => it.artwork.heightCm ?? DEFAULT_DIMS_CM.height),
  );
  const subTotal = items.reduce(
    (sum, it) => sum + Number(it.unitPrice) * it.quantity,
    0,
  );

  // 1. Create the Shiprocket order.
  const created = await createShiprocketOrder({
    orderId: srOrderId,
    orderDate: new Date().toISOString().slice(0, 10),
    pickupLocation,
    customerName: address.fullName,
    addressLine: [address.line1, address.line2].filter(Boolean).join(", "),
    city: address.city,
    pincode: deliveryPincode,
    state: address.state,
    country: address.country || "India",
    email: customerEmail,
    phone: address.phone,
    items: items.map((it) => ({
      name: it.titleSnapshot,
      sku: it.id.slice(-12),
      units: it.quantity,
      sellingPrice: Math.round(Number(it.unitPrice)),
    })),
    subTotal: Math.round(subTotal),
    weightKg,
    lengthCm,
    breadthCm,
    heightCm,
  });
  if (!created) {
    return fail("Shiprocket order creation failed (see server logs).");
  }

  // 2. Assign AWB — pin the cheapest courier using the same logic the
  // buyer was quoted at checkout, so the rate stays honest.
  const creatorPickupPincode =
    items[0]?.creator.pickupPincode || fallbackPickupPincode;
  const cheapest = creatorPickupPincode
    ? await getCheapestCourierRate({
        pickupPincode: creatorPickupPincode,
        deliveryPincode,
        weightKg: Math.round(weightKg * 100) / 100,
      })
    : null;
  const awb = await assignAwb(created.shipmentId, cheapest?.courierId);
  if (!awb) {
    await saveShipmentRow(srOrderId, {
      orderId,
      shiprocketShipmentId: String(created.shipmentId),
      pickupLocation,
      shipmentError: "Shiprocket order created but AWB assignment failed.",
    });
    return {
      creatorId,
      storeName,
      ok: false,
      error: "Shiprocket order created but AWB assignment failed.",
    };
  }

  // 3. Schedule the pickup (non-fatal: the AWB exists, so the courier can
  // still be booked from the Shiprocket panel if this fails).
  const pickupScheduled = await schedulePickup(created.shipmentId);
  if (!pickupScheduled) {
    console.warn(
      `[shipments] order ${orderNumber}: pickup scheduling failed for shipment ${created.shipmentId}; AWB ${awb.awbCode} exists.`,
    );
  }

  // 4. Persist the shipment row.
  await saveShipmentRow(srOrderId, {
    orderId,
    carrier: awb.courierName,
    trackingNumber: awb.awbCode,
    shiprocketShipmentId: String(created.shipmentId),
    awbCode: awb.awbCode,
    courierId: cheapest ? String(cheapest.courierId) : null,
    pickupLocation,
    shipmentError: null,
  });

  console.log(
    `[shipments] order ${orderNumber}: dispatched via ${awb.courierName}, AWB ${awb.awbCode} (pickup ${pickupScheduled ? "scheduled" : "NOT scheduled"}).`,
  );
  return {
    creatorId,
    storeName,
    ok: true,
    awbCode: awb.awbCode,
    courierName: awb.courierName,
  };
}

// ── Phase 3: tracking webhooks ────────────────────────────────────────────
// Shiprocket POSTs shipment-status events to /api/webhooks/shiprocket.
// This handler advances the Shipment status (forward-only — events can
// arrive out of order or repeat), records a ShipmentTracking event, and
// notifies the buyer on OUT_FOR_DELIVERY / DELIVERED.
//
// Deliberately does NOT change the Order status: the creator still marks
// PACKED → SHIPPED → DELIVERED manually. This phase is tracking
// visibility, not fulfillment automation.

import { ShipmentStatus } from "@prisma/client";

export interface TrackingWebhookResult {
  matched: boolean;
  awb?: string;
  event?: string;
  updated?: boolean;
}

/** Shiprocket event name → our ShipmentStatus. Unmapped events are logged. */
const EVENT_TO_STATUS: Record<string, ShipmentStatus> = {
  PICKED_UP: ShipmentStatus.PICKED_UP,
  PICKUP_SCHEDULED: ShipmentStatus.PENDING,
  PICKUP_GENERATED: ShipmentStatus.PENDING,
  IN_TRANSIT: ShipmentStatus.IN_TRANSIT,
  OUT_FOR_DELIVERY: ShipmentStatus.OUT_FOR_DELIVERY,
  DELIVERED: ShipmentStatus.DELIVERED,
  RTO_INITIATED: ShipmentStatus.RETURNED,
  RTO_DELIVERED: ShipmentStatus.RETURNED,
  RETURNED: ShipmentStatus.RETURNED,
  CANCELLED: ShipmentStatus.RETURNED,
  DELIVERY_FAILED: ShipmentStatus.FAILED_DELIVERY,
  FAILED_DELIVERY: ShipmentStatus.FAILED_DELIVERY,
};

/** Forward-only rank: events never move a shipment backwards. */
const STATUS_RANK: Record<ShipmentStatus, number> = {
  [ShipmentStatus.PENDING]: 0,
  [ShipmentStatus.PICKED_UP]: 1,
  [ShipmentStatus.IN_TRANSIT]: 2,
  [ShipmentStatus.OUT_FOR_DELIVERY]: 3,
  [ShipmentStatus.DELIVERED]: 4,
  [ShipmentStatus.FAILED_DELIVERY]: 4,
  [ShipmentStatus.RETURNED]: 4,
};

/** Buyer-facing label per status for the order timeline. */
export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  [ShipmentStatus.PENDING]: "Label created — awaiting courier pickup",
  [ShipmentStatus.PICKED_UP]: "Picked up by courier",
  [ShipmentStatus.IN_TRANSIT]: "In transit",
  [ShipmentStatus.OUT_FOR_DELIVERY]: "Out for delivery",
  [ShipmentStatus.DELIVERED]: "Delivered",
  [ShipmentStatus.FAILED_DELIVERY]: "Delivery attempt failed — courier will retry",
  [ShipmentStatus.RETURNED]: "Returned to studio",
};

function extractAwb(payload: any): string | null {
  if (!payload || typeof payload !== "object") return null;
  const candidates = [
    payload.awb,
    payload.awb_code,
    payload.awbCode,
    payload.data?.awb_code,
    payload.data?.awb,
    payload.shipment?.awb,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return null;
}

function extractEvent(payload: any): string | null {
  if (!payload || typeof payload !== "object") return null;
  const candidates = [
    payload.current_status,
    payload.status,
    payload.event,
    payload.data?.current_status,
    payload.data?.status,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) {
      return c.trim().toUpperCase().replace(/[\s-]+/g, "_");
    }
  }
  return null;
}

function extractNote(payload: any): string | null {
  if (!payload || typeof payload !== "object") return null;
  const candidates = [
    payload.remark,
    payload.data?.remark,
    payload.location,
    payload.data?.location,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim().slice(0, 200);
  }
  return null;
}

export async function handleShiprocketTrackingEvent(
  payload: unknown,
): Promise<TrackingWebhookResult> {
  try {
    const awb = extractAwb(payload);
    const event = extractEvent(payload);
    if (!awb || !event) {
      console.warn("[shipments] tracking webhook: missing awb/status");
      return { matched: false };
    }

    const shipment = await prisma.shipment.findFirst({
      where: { awbCode: awb },
      include: {
        order: { select: { id: true, orderNumber: true, customerId: true } },
      },
    });
    if (!shipment) {
      console.warn(`[shipments] tracking webhook: no shipment for AWB ${awb}`);
      return { matched: false, awb, event };
    }

    const mapped = EVENT_TO_STATUS[event] ?? null;
    const note = extractNote(payload);
    let updated = false;

    if (mapped && STATUS_RANK[mapped] > STATUS_RANK[shipment.status]) {
      const data: {
        status: ShipmentStatus;
        shippedAt?: Date;
        deliveredAt?: Date;
      } = { status: mapped };
      if (mapped === ShipmentStatus.PICKED_UP && !shipment.shippedAt) {
        data.shippedAt = new Date();
      }
      if (mapped === ShipmentStatus.DELIVERED && !shipment.deliveredAt) {
        data.deliveredAt = new Date();
      }
      await prisma.shipment.update({ where: { id: shipment.id }, data });
      updated = true;
      console.log(
        `[shipments] AWB ${awb}: ${shipment.status} → ${mapped} (${event})`,
      );
    } else if (!mapped) {
      console.log(
        `[shipments] AWB ${awb}: unmapped event "${event}" — recorded only`,
      );
    }

    // Record the tracking event; dedupe exact repeats within 10 minutes
    // (Shiprocket redelivers webhooks).
    const recent = await prisma.shipmentTracking.findFirst({
      where: {
        shipmentId: shipment.id,
        status: mapped ?? shipment.status,
        note: note ?? null,
        occurredAt: { gte: new Date(Date.now() - 10 * 60 * 1000) },
      },
      select: { id: true },
    });
    if (!recent) {
      await prisma.shipmentTracking.create({
        data: {
          shipmentId: shipment.id,
          status: mapped ?? shipment.status,
          note,
        },
      });
    }

    // Buyer notifications on the two milestones that matter.
    if (
      updated &&
      (mapped === ShipmentStatus.OUT_FOR_DELIVERY ||
        mapped === ShipmentStatus.DELIVERED)
    ) {
      try {
        await prisma.notification.create({
          data: {
            userId: shipment.order.customerId,
            type: "ORDER_STATUS_UPDATED",
            title:
              mapped === ShipmentStatus.DELIVERED
                ? `Order #${shipment.order.orderNumber} delivered`
                : `Order #${shipment.order.orderNumber} out for delivery`,
            body:
              mapped === ShipmentStatus.DELIVERED
                ? `Your artwork has been delivered. Tracking: ${awb}.`
                : `Your artwork is out for delivery via ${shipment.carrier || "courier"}. Tracking: ${awb}.`,
            refType: "ORDER",
            refId: shipment.order.id,
          },
        });
      } catch (e) {
        console.error("[shipments] buyer notification failed:", e);
      }
    }

    return { matched: true, awb, event, updated };
  } catch (e) {
    // Never throw: a bad webhook must not loop Shiprocket retries.
    console.error("[shipments] tracking webhook handler failed:", e);
    return { matched: false };
  }
}
