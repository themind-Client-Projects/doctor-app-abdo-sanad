-- The owner-dashboard audit: two data repairs and one constraint.
--
-- Idempotent — safe to run against a database that already has all of it.
-- Apply with:
--   dotenvx run -f .env.local -- psql "$DIRECT_URL" -f prisma/sql/owner-dashboard-gaps.sql
--
-- A fresh database created from schema.prisma already has the constraint; the
-- coupon repair only matters for data written before the API normalised codes.

-- ── 1. Coupons that checkout could never find ─────────────────────────────
--
-- `validateCoupon` looks a code up as `UPPER(TRIM(code))`, but the admin API
-- stored codes exactly as typed. A coupon saved as "save10" was listed as live
-- and every patient who typed it was told "كوبون غير صالح".
--
-- Upper-cased in place — EXCEPT where that would collide with a coupon that
-- already holds the upper-case form. Those are left alone and reported, not
-- merged or deleted: which of two coupons with the same code "wins" is a
-- business decision about two sets of redemptions, not a migration's to make.
DO $$
DECLARE
  clash RECORD;
BEGIN
  FOR clash IN
    SELECT c.code
    FROM "Coupon" c
    WHERE c.code <> UPPER(TRIM(c.code))
      AND EXISTS (SELECT 1 FROM "Coupon" o WHERE o.code = UPPER(TRIM(c.code)) AND o.id <> c.id)
  LOOP
    RAISE NOTICE 'Coupon % not normalised: % already exists — resolve by hand', clash.code, UPPER(TRIM(clash.code));
  END LOOP;

  UPDATE "Coupon" c
  SET code = UPPER(TRIM(c.code))
  WHERE c.code <> UPPER(TRIM(c.code))
    AND NOT EXISTS (SELECT 1 FROM "Coupon" o WHERE o.code = UPPER(TRIM(c.code)) AND o.id <> c.id);
END $$;

-- ── 2. One rating per patient per order ──────────────────────────────────
--
-- A double-tap on the stars counted as two ratings and moved the average. The
-- index is created only when no duplicates exist; if some do, this RAISES
-- rather than deleting ratings to make room — which rating is the patient's
-- real one is not something a migration can know.
DO $$
DECLARE
  dupes INTEGER;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'PatientFeedback' AND indexname = 'PatientFeedback_orderId_patientId_key'
  ) THEN
    SELECT COUNT(*) INTO dupes FROM (
      SELECT "orderId", "patientId" FROM "PatientFeedback"
      WHERE "orderId" IS NOT NULL
      GROUP BY "orderId", "patientId" HAVING COUNT(*) > 1
    ) d;

    IF dupes > 0 THEN
      RAISE EXCEPTION '% (orderId, patientId) pairs have more than one rating — deduplicate before applying', dupes;
    END IF;

    CREATE UNIQUE INDEX "PatientFeedback_orderId_patientId_key"
      ON "PatientFeedback" ("orderId", "patientId");
  END IF;
END $$;

-- ── 3. Seeded ratings credited to the wrong patient ──────────────────────
--
-- `prisma/seed-operations.ts` attributed each rating to a patient picked by
-- its index in the completed subset, not to the patient who placed the order,
-- so "patient 3 rated patient 7's lab test". The seed is fixed; this repairs
-- rows it already wrote. Scoped to seed ids (`seed-fb-…`) so no real
-- patient's rating is ever reassigned.
UPDATE "PatientFeedback" f
SET "patientId" = o."patientId"
FROM "Order" o
WHERE f."orderId" = o.id
  AND f.id LIKE 'seed-fb-%'
  AND f."patientId" <> o."patientId"
  -- Skip a row whose corrected pair would collide with an existing rating.
  AND NOT EXISTS (
    SELECT 1 FROM "PatientFeedback" x
    WHERE x."orderId" = f."orderId" AND x."patientId" = o."patientId" AND x.id <> f.id
  );
