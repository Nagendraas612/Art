/**
 * Shiprocket API client — server-only (uses secret API credentials).
 *
 * Phase 1 uses two capabilities:
 *   1. Auth: email/password login -> Bearer token (cached in memory,
 *      transparent re-login on 401).
 *   2. Serviceability: live courier rates per (pickup pincode, delivery
 *      pincode, weight) -> cheapest rate.
 *
 * Design notes for later phases:
 * - Courier selection is centralized in getCheapestCourierRate(); a future
 *   "let the buyer choose" UI calls getCourierRates() and picks from the
 *   list instead — no changes needed inside this client.
 * - One shared token per process. Vercel serverless instances each hold
 *   their own copy; the 25-concurrent-session cap is never approached
 *   because we never create parallel logins (single-flight promise).
 */

const API_BASE = "https://apiv2.shiprocket.in/v1/external";
const FETCH_TIMEOUT_MS = 8000;

// ---- Token cache (single-flight) ------------------------------------------

let cachedToken: string | null = null;
let cachedTokenAt = 0;
let loginInFlight: Promise<string> | null = null;

// Official docs: 240h. One community source claims 24h — refresh early and
// also re-login transparently on 401, so either value is safe.
const TOKEN_REFRESH_MS = 6 * 60 * 60 * 1000; // 6h, well under both claims

function credentialsConfigured(): boolean {
  return Boolean(
    process.env.SHIPROCKET_API_USER_EMAIL && process.env.SHIPROCKET_API_PASSWORD,
  );
}

async function login(): Promise<string> {
  if (!credentialsConfigured()) {
    throw new Error("Shiprocket API credentials are not configured");
  }
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: process.env.SHIPROCKET_API_USER_EMAIL,
      password: process.env.SHIPROCKET_API_PASSWORD,
    }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`Shiprocket login failed: HTTP ${res.status}`);
  }
  const data = (await res.json()) as { token?: string };
  if (!data.token) {
    throw new Error("Shiprocket login response had no token");
  }
  cachedToken = data.token;
  cachedTokenAt = Date.now();
  return data.token;
}

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() - cachedTokenAt < TOKEN_REFRESH_MS) {
    return cachedToken;
  }
  // Single-flight: concurrent callers share one login request.
  if (!loginInFlight) {
    loginInFlight = login().finally(() => {
      loginInFlight = null;
    });
  }
  return loginInFlight;
}

/** Authenticated fetch with one transparent retry on 401 (expired token). */
async function shiprocketFetch(path: string, init?: RequestInit): Promise<Response> {
  const doFetch = async (token: string) =>
    fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers || {}),
        Authorization: `Bearer ${token}`,
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

  let res = await doFetch(await getToken());
  if (res.status === 401) {
    // Token rejected — force a fresh login and retry once.
    cachedToken = null;
    res = await doFetch(await getToken());
  }
  return res;
}

// ---- Serviceability / rates -----------------------------------------------

export interface CourierRate {
  courierId: number;
  courierName: string;
  rate: number; // INR
  etd: string | null; // estimated delivery description, if provided
}

interface ServiceabilityCompany {
  courier_company_id?: number;
  courier_name?: string;
  rate?: number | string;
  etd?: string;
  estimated_delivery_days?: string;
}

function toCourierRate(c: ServiceabilityCompany): CourierRate | null {
  const rate = Number(c.rate);
  if (!c.courier_company_id || !Number.isFinite(rate) || rate < 0) return null;
  return {
    courierId: c.courier_company_id,
    courierName: c.courier_name || `Courier ${c.courier_company_id}`,
    rate: Math.round(rate),
    etd: c.etd || c.estimated_delivery_days || null,
  };
}

export interface RateRequest {
  pickupPincode: string;
  deliveryPincode: string;
  /** Kilograms, already normalized (min 0.5). */
  weightKg: number;
  widthCm?: number;
  heightCm?: number;
  depthCm?: number;
}

// Rates below this are treated as bogus API data and ignored — a real
// courier rate is never this low. Without this guard, a malformed API
// response could show the buyer a ₹1 shipping fee. Ignored rates fall
// through to the flat-fee fallback instead.
const MIN_SANE_RATE = 20;

// Short in-memory cache: rates barely move within minutes, and checkout
// can trigger several lookups in quick succession.
const rateCache = new Map<string, { at: number; rates: CourierRate[] }>();
const RATE_CACHE_MS = 10 * 60 * 1000;

/**
 * All available courier rates for a lane, cheapest first.
 * Returns null when Shiprocket is unreachable/unconfigured (caller falls
 * back to the flat fee) — never throws for transport-level issues.
 */
export async function getCourierRates(req: RateRequest): Promise<CourierRate[] | null> {
  if (!credentialsConfigured()) return null;
  if (!/^\d{6}$/.test(req.pickupPincode) || !/^\d{6}$/.test(req.deliveryPincode)) {
    return null;
  }
  const cacheKey = `${req.pickupPincode}:${req.deliveryPincode}:${req.weightKg.toFixed(2)}`;
  const cached = rateCache.get(cacheKey);
  if (cached && Date.now() - cached.at < RATE_CACHE_MS) return cached.rates;

  try {
    const params = new URLSearchParams({
      pickup_postcode: req.pickupPincode,
      delivery_postcode: req.deliveryPincode,
      weight: String(req.weightKg),
      cod: "0",
    });
    // Dimensions are passed when known; harmless if the endpoint ignores them.
    if (req.widthCm) params.set("length", String(req.widthCm));
    if (req.heightCm) params.set("breadth", String(req.heightCm));
    if (req.depthCm) params.set("height", String(req.depthCm));

    const res = await shiprocketFetch(`/courier/serviceability/?${params.toString()}`, {
      method: "GET",
    });
    if (!res.ok) {
      console.error(`[shiprocket] serviceability HTTP ${res.status}`);
      return null;
    }
    const data = (await res.json()) as {
      data?: { available_courier_companies?: ServiceabilityCompany[] };
    };
    const companies = data?.data?.available_courier_companies || [];
    const rates = companies
      .map(toCourierRate)
      .filter((r): r is CourierRate => r !== null)
      .sort((a, b) => a.rate - b.rate);
    // Drop bogus rates (see MIN_SANE_RATE). If every courier is bogus,
    // the caller falls back to the flat fee.
    const sane = rates.filter((r) => {
      if (r.rate < MIN_SANE_RATE) {
        console.warn(
          `[shiprocket] ignoring bogus rate ₹${r.rate} from ${r.courierName} (${req.pickupPincode}→${req.deliveryPincode})`,
        );
        return false;
      }
      return true;
    });
    rateCache.set(cacheKey, { at: Date.now(), rates: sane });
    return sane;
  } catch (e) {
    console.error("[shiprocket] serviceability failed:", e);
    return null;
  }
}

/** Cheapest available rate, or null when none/unreachable. */
export async function getCheapestCourierRate(
  req: RateRequest,
): Promise<CourierRate | null> {
  const rates = await getCourierRates(req);
  return rates && rates.length > 0 ? rates[0] : null;
}

// ---- Live shipping fee (Phase 1) -------------------------------------------

export interface LiveShippingItem {
  /** Creator's pickup pincode (their own, or the platform default). */
  pickupPincode: string | null;
  /** Total grams for this creator's items in the bag. */
  weightGrams: number;
  widthCm?: number | null;
  heightCm?: number | null;
  depthCm?: number | null;
}

export interface LiveShippingQuote {
  /** Sum of cheapest per-creator rates. Null when live rating is impossible. */
  fee: number | null;
  /** True when every creator resolved to a live rate. */
  fullyRated: boolean;
  lines: Array<{ pickupPincode: string; courierName: string; rate: number; etd: string | null }>;
}

const MIN_WEIGHT_KG = 0.5;

/**
 * Live insured-logistics fee: cheapest Shiprocket rate per creator pickup
 * location, summed into one figure.
 *
 * Returns fee: null when live rating is impossible (credentials missing,
 * no pickup pincode, or API failure) — the caller then uses the flat-fee
 * emergency fallback. Never throws.
 */
export async function calculateLiveShippingFee(
  items: LiveShippingItem[],
  deliveryPincode: string,
): Promise<LiveShippingQuote> {
  const empty: LiveShippingQuote = { fee: null, fullyRated: false, lines: [] };
  if (!credentialsConfigured()) return empty;
  if (!/^\d{6}$/.test(deliveryPincode) || items.length === 0) return empty;

  const lines: LiveShippingQuote["lines"] = [];
  try {
    for (const item of items) {
      if (!item.pickupPincode || !/^\d{6}$/.test(item.pickupPincode)) {
        return empty; // cannot rate part of the bag -> fallback covers all
      }
      const weightKg = Math.max(MIN_WEIGHT_KG, (item.weightGrams || 0) / 1000);
      const cheapest = await getCheapestCourierRate({
        pickupPincode: item.pickupPincode,
        deliveryPincode,
        weightKg: Math.round(weightKg * 100) / 100,
        widthCm: item.widthCm || undefined,
        heightCm: item.heightCm || undefined,
        depthCm: item.depthCm || undefined,
      });
      if (!cheapest) return empty;
      lines.push({
        pickupPincode: item.pickupPincode,
        courierName: cheapest.courierName,
        rate: cheapest.rate,
        etd: cheapest.etd,
      });
    }
    return {
      fee: lines.reduce((sum, l) => sum + l.rate, 0),
      fullyRated: true,
      lines,
    };
  } catch (e) {
    console.error("[shiprocket] live fee calculation failed:", e);
    return empty;
  }
}

/** For health checks / admin diagnostics. */
export function isShiprocketConfigured(): boolean {
  return credentialsConfigured();
}

// ── Phase 2: auto-dispatch (order creation, AWB, pickup) ──────────────────
// These run AFTER payment is confirmed (webhook `after()`), one shipment
// per creator pickup location. Every function returns null/false on
// failure instead of throwing — the orchestrator in src/lib/shipments.ts
// records failures on the Shipment row so the studio can retry. Payment
// confirmation must never depend on logistics.

export interface ShiprocketOrderItem {
  name: string;
  sku: string;
  units: number;
  sellingPrice: number; // INR per unit
}

export interface ShiprocketOrderInput {
  /** Our idempotency key, e.g. "ORD-2026-00013-a1b2c3". Reused on retry. */
  orderId: string;
  orderDate: string; // YYYY-MM-DD
  /** Nickname EXACTLY as registered in Shiprocket Settings → Pickup Addresses. */
  pickupLocation: string;
  // Buyer (billing == shipping for the marketplace checkout).
  customerName: string;
  addressLine: string;
  city: string;
  pincode: string;
  state: string;
  country: string;
  email: string;
  phone: string; // digits; last 10 used
  // Parcel.
  items: ShiprocketOrderItem[];
  subTotal: number;
  weightKg: number;
  lengthCm: number;
  breadthCm: number;
  heightCm: number;
}

export interface ShiprocketCreatedOrder {
  shiprocketOrderId: number;
  shipmentId: number;
}

/**
 * POST /v1/external/orders/create/adhoc — creates the Shiprocket order
 * and returns its order_id + shipment_id. All downstream steps key off
 * shipment_id.
 */
export async function createShiprocketOrder(
  input: ShiprocketOrderInput,
): Promise<ShiprocketCreatedOrder | null> {
  if (!credentialsConfigured()) return null;
  try {
    const digits = input.phone.replace(/\D/g, "").slice(-10);
    const body = {
      order_id: input.orderId,
      order_date: input.orderDate,
      pickup_location: input.pickupLocation,
      billing_customer_name: input.customerName.slice(0, 60),
      billing_address: input.addressLine.slice(0, 120),
      billing_city: input.city.slice(0, 50),
      billing_pincode: input.pincode,
      billing_state: input.state.slice(0, 50),
      billing_country: input.country.slice(0, 50),
      billing_email: input.email,
      billing_phone: digits,
      shipping_is_billing: true,
      order_items: input.items.map((it) => ({
        name: it.name.slice(0, 120),
        sku: it.sku.slice(0, 50),
        units: it.units,
        selling_price: it.sellingPrice,
      })),
      payment_method: "Prepaid",
      sub_total: input.subTotal,
      length: input.lengthCm,
      breadth: input.breadthCm,
      height: input.heightCm,
      weight: Math.max(0.5, Math.round(input.weightKg * 100) / 100),
    };
    const res = await shiprocketFetch("/orders/create/adhoc", {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(
        `[shiprocket] order create failed HTTP ${res.status}: ${text.slice(0, 300)}`,
      );
      return null;
    }
    const data = (await res.json()) as {
      order_id?: number;
      shipment_id?: number;
    };
    if (!data.order_id || !data.shipment_id) {
      console.error("[shiprocket] order create: missing order_id/shipment_id");
      return null;
    }
    return { shiprocketOrderId: data.order_id, shipmentId: data.shipment_id };
  } catch (e) {
    console.error("[shiprocket] order create failed:", e);
    return null;
  }
}

export interface ShiprocketAwb {
  awbCode: string;
  courierName: string;
}

/**
 * GET /v1/external/shipments/{id} — read back the AWB already assigned to a
 * shipment. Used before re-assigning: if a previous assignAwb succeeded at
 * Shiprocket but its response was lost (timeout), re-assigning would orphan
 * a live AWB whose tracking events then match nothing. Adopt it instead.
 */
export async function getShipmentAwb(
  shipmentId: number,
): Promise<ShiprocketAwb | null> {
  if (!credentialsConfigured()) return null;
  try {
    const res = await shiprocketFetch(`/shipments/${shipmentId}`);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      data?: { awb_code?: string; courier_name?: string };
    };
    const awb = data.data?.awb_code || null;
    if (!awb) return null;
    return {
      awbCode: awb,
      courierName: data.data?.courier_name || "Shiprocket",
    };
  } catch (e) {
    console.error("[shiprocket] get shipment AWB failed:", e);
    return null;
  }
}

/**
 * POST /v1/external/courier/assign/awb — assigns the courier and returns
 * the AWB (tracking number). Pass a courier_id to pin the courier that
 * was quoted at checkout; omit it and Shiprocket auto-assigns per the
 * account's courier rules.
 */
export async function assignAwb(
  shipmentId: number,
  courierId?: number,
): Promise<ShiprocketAwb | null> {
  if (!credentialsConfigured()) return null;
  try {
    const body: Record<string, unknown> = { shipment_id: shipmentId };
    if (courierId) body.courier_id = courierId;
    const res = await shiprocketFetch("/courier/assign/awb", {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(
        `[shiprocket] AWB assign failed HTTP ${res.status}: ${text.slice(0, 300)}`,
      );
      return null;
    }
    const data = (await res.json()) as {
      response?: { data?: { awb_code?: string; courier_name?: string } };
      awb_code?: string;
      courier_name?: string;
    };
    const awb =
      data.response?.data?.awb_code || data.awb_code || null;
    if (!awb) {
      console.error("[shiprocket] AWB assign: no awb_code in response");
      return null;
    }
    return {
      awbCode: awb,
      courierName:
        data.response?.data?.courier_name || data.courier_name || "Shiprocket",
    };
  } catch (e) {
    console.error("[shiprocket] AWB assign failed:", e);
    return null;
  }
}

/**
 * POST /v1/external/courier/generate/pickup — requests the courier
 * pickup for the shipment. Requires an assigned AWB.
 */
export async function schedulePickup(shipmentId: number): Promise<boolean> {
  if (!credentialsConfigured()) return false;
  try {
    const res = await shiprocketFetch("/courier/generate/pickup", {
      method: "POST",
      body: JSON.stringify({ shipment_id: [shipmentId] }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(
        `[shiprocket] pickup schedule failed HTTP ${res.status}: ${text.slice(0, 300)}`,
      );
      return false;
    }
    return true;
  } catch (e) {
    console.error("[shiprocket] pickup schedule failed:", e);
    return false;
  }
}
