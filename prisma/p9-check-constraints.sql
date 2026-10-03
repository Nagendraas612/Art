-- P9 data-integrity guardrails (Kalaa Bhadra).
--
-- The project uses `prisma db push` (no migrations directory), so Prisma
-- cannot manage CHECK constraints natively. Run this file once against the
-- database with psql:
--
--   psql "$DATABASE_URL" -f prisma/p9-check-constraints.sql
--
-- Every block is idempotent (safe to re-run). Application-level validation
-- (zod, src/lib/validation.ts) is the first line of defense; these
-- constraints are the last — they make invalid states unrepresentable even
-- if a future code path forgets to validate.

-- 1. Review.rating must be 1-5 (defense in depth behind ratingSchema).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'review_rating_1_5') THEN
    ALTER TABLE "Review" ADD CONSTRAINT review_rating_1_5 CHECK (rating BETWEEN 1 AND 5);
  END IF;
END $$;

-- 2. OrderItem.quantity must be a positive integer.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_item_quantity_positive') THEN
    ALTER TABLE "OrderItem" ADD CONSTRAINT order_item_quantity_positive CHECK (quantity >= 1);
  END IF;
END $$;

-- 3. Money fields must never go negative (a negative earning/payout would be
--    a money-creation bug).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'creator_earning_amount_nonneg') THEN
    ALTER TABLE "CreatorEarning" ADD CONSTRAINT creator_earning_amount_nonneg CHECK (amount >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payout_amount_positive') THEN
    ALTER TABLE "Payout" ADD CONSTRAINT payout_amount_positive CHECK (amount > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_grand_total_nonneg') THEN
    ALTER TABLE "Order" ADD CONSTRAINT order_grand_total_nonneg CHECK ("grandTotal" >= 0);
  END IF;
END $$;

-- 4. Artwork stock cannot go negative (oversell guard at the storage layer).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'artwork_stock_nonneg') THEN
    ALTER TABLE "Artwork" ADD CONSTRAINT artwork_stock_nonneg CHECK (stock >= 0);
  END IF;
END $$;

-- 5. Platform commission rate is a percentage (0-100), matching the
--    application validation in updatePlatformCommissionAction.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'platform_commission_rate_pct') THEN
    ALTER TABLE "PlatformCommission" ADD CONSTRAINT platform_commission_rate_pct
      CHECK ("percentage" >= 0 AND "percentage" <= 100);
  END IF;
END $$;
