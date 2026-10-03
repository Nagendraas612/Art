import { Prisma } from "@prisma/client";

/**
 * Platform fee rules, versioned by effective date.
 *
 * Resolution order (most specific wins):
 *   1. creator + category rule
 *   2. creator-only rule
 *   3. category-only rule
 *   4. global rule (creatorId and categoryId both null)
 * Falls back to DEFAULT_PLATFORM_FEE_RATE when no active rule matches or a
 * rule holds corrupt data — money math must never produce NaN/negative fees.
 */

export const DEFAULT_PLATFORM_FEE_RATE = 0.1; // 10%

type CommissionRuleRow = {
  creatorId: string | null;
  categoryId: string | null;
  percentage: Prisma.Decimal;
  effectiveFrom: Date;
};

type CommissionCapableDb = {
  platformCommission: {
    findMany(args: {
      where: {
        effectiveFrom: { lte: Date };
        OR: Array<{ effectiveTo: null } | { effectiveTo: { gt: Date } }>;
      };
      orderBy: { effectiveFrom: "desc" };
    }): Promise<CommissionRuleRow[]>;
  };
};

export async function resolvePlatformFeeRate(
  db: CommissionCapableDb,
  {
    creatorId,
    categoryId,
  }: { creatorId: string; categoryId: string | null }
): Promise<number> {
  const now = new Date();

  const rules = await db.platformCommission.findMany({
    where: {
      effectiveFrom: { lte: now },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
    },
    orderBy: { effectiveFrom: "desc" },
  });

  const pick = (predicate: (r: CommissionRuleRow) => boolean) =>
    rules.find(predicate);

  const rule =
    pick(
      (r) =>
        r.creatorId === creatorId &&
        categoryId !== null &&
        r.categoryId === categoryId
    ) ||
    pick((r) => r.creatorId === creatorId && r.categoryId === null) ||
    pick(
      (r) =>
        r.creatorId === null &&
        categoryId !== null &&
        r.categoryId === categoryId
    ) ||
    pick((r) => r.creatorId === null && r.categoryId === null);

  if (!rule) return DEFAULT_PLATFORM_FEE_RATE;

  const pct = Number(rule.percentage);
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
    return DEFAULT_PLATFORM_FEE_RATE;
  }
  return pct / 100;
}
