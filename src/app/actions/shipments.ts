"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentCreator } from "@/lib/studio-auth";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { processOrderShipments } from "@/lib/shipments";
import { checkRateLimit } from "@/lib/rate-limit";
import { z } from "zod";
import { revalidatePath } from "next/cache";

const retrySchema = z.object({
  orderId: z.string().min(1).max(64),
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
    return {
      ok: false as const,
      error:
        "Nothing to dispatch — auto-dispatch is not configured (pickup location or Shiprocket credentials missing).",
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
