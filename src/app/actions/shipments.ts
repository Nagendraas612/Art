"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentCreator } from "@/lib/studio-auth";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { processOrderShipments } from "@/lib/shipments";
import { checkRateLimit } from "@/lib/rate-limit";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { cuidSchema } from "@/lib/validation";

const retrySchema = z.object({
  orderId: cuidSchema,
});

/**
 * Retry Shiprocket auto-dispatch for an order. Re-runs the idempotent
 * orchestrator — creators that already have an AWB are skipped, only the
 * failed/pending ones are retried.
 *
 * Allowed for the order's creator(s) and admins. Rate-limited: each retry
 * hits the Shiprocket API.
 */
export async function retryShipmentAction(orderId: string) {
  const parsed = retrySchema.safeParse({ orderId });
  if (!parsed.success) return { ok: false as const, error: "Invalid order." };

  const creator = await getCurrentCreator();
  const admin = creator ? null : await getCurrentAdmin();
  if (!creator && !admin) {
    return { ok: false as const, error: "Not authorized." };
  }

  // The creator must actually have items in this order (admins bypass).
  if (creator) {
    const ownItems = await prisma.orderItem.count({
      where: { orderId: parsed.data.orderId, creatorId: creator.id },
    });
    if (ownItems === 0) {
      return { ok: false as const, error: "Not authorized for this order." };
    }
  }

  const limit = await checkRateLimit(
    `retry-shipment:${creator?.id || admin?.id || "anon"}`,
    10,
    60_000,
  );
  if (!limit.allowed) {
    return {
      ok: false as const,
      error: "Too many retries — please wait a minute and try again.",
    };
  }

  const results = await processOrderShipments(parsed.data.orderId);
  revalidatePath("/studio/orders");

  const failed = results.filter((r) => !r.ok);
  if (results.length === 0) {
    // Tell the studio WHY there is nothing to dispatch: the orchestrator
    // skips orders that are not ORDER_CONFIRMED, and it skips creators
    // without a pickup location or Shiprocket credentials.
    const ord = await prisma.order.findUnique({
      where: { id: parsed.data.orderId },
      select: { status: true },
    });
    const reason =
      ord && ord.status !== "ORDER_CONFIRMED"
        ? `order is ${ord.status.replace(/_/g, " ").toLowerCase()} — auto-dispatch runs on confirmed orders, so dispatch this one manually`
        : "pickup location or Shiprocket credentials are missing for this studio";
    return {
      ok: false as const,
      error: `Nothing to dispatch — ${reason}.`,
    };
  }
  if (failed.length > 0) {
    return {
      ok: false as const,
      error: failed
        .map((r) => `${r.storeName}: ${r.error || "failed"}`)
        .join("; "),
    };
  }
  return {
    ok: true as const,
    dispatched: results.map((r) => ({
      storeName: r.storeName,
      awbCode: r.awbCode,
      courierName: r.courierName,
      skipped: r.skipped,
    })),
  };
}
