-- عضويات وريد وسند — turn the marketing card into a package a system can sell.
--
-- `HealthPlan` held a name, a price and a JSON list of strings behind a button
-- with no handler. A membership needs terms that can be enforced: how long it
-- runs, what rate it discounts at, and how many uses of each service it
-- includes. Those become columns and two child tables.
--
-- Idempotent, so it is safe to run against a database that already has it.
-- Apply with:
--   dotenvx run -f .env.local -- psql "$DIRECT_URL" -f prisma/sql/membership-packages.sql
--
-- A fresh database created from schema.prisma already has all of this; this
-- file exists for an EXISTING one, where `prisma db push` is not being run.

-- ── HealthPlan gains the commercial terms ─────────────────────────────────

-- `monthlyPrice` was wrong on three of the client's four cards: a one-day
-- package for 5,000 and a twelve-month one for 225,000 are not monthly prices.
-- Duration moves to its own column and the two together are the offer.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'HealthPlan' AND column_name = 'monthlyPrice'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'HealthPlan' AND column_name = 'price'
  ) THEN
    ALTER TABLE "HealthPlan" RENAME COLUMN "monthlyPrice" TO "price";
  END IF;
END $$;

ALTER TABLE "HealthPlan"
  ADD COLUMN IF NOT EXISTS "price"           DECIMAL(18,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "durationDays"    INTEGER       NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS "discountPercent" DECIMAL(5,2)  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "isComingSoon"    BOOLEAN       NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "code"            TEXT;

-- `code` is the seed's idempotency key and must be unique, but existing rows
-- have none. Backfill from the id before the constraint goes on, so the
-- statement cannot fail on a database that already holds plans.
UPDATE "HealthPlan" SET "code" = 'PLAN_' || UPPER(SUBSTRING("id" FROM 1 FOR 8))
  WHERE "code" IS NULL;

ALTER TABLE "HealthPlan" ALTER COLUMN "code" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "HealthPlan_code_key" ON "HealthPlan" ("code");

-- `features` is superseded by HealthPlanBenefit rows. Dropped rather than left
-- behind: two sources for "what does this package include" is exactly the drift
-- that makes two screens disagree.
ALTER TABLE "HealthPlan" DROP COLUMN IF EXISTS "features";

-- ── The rows of a card ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "HealthPlanBenefit" (
  "id"          TEXT    NOT NULL,
  "planId"      TEXT    NOT NULL,
  -- The Postgres ENUM, not TEXT. Prisma declares this field as `ServiceType`,
  -- so a TEXT column makes every `where: { serviceType }` fail at runtime with
  -- `operator does not exist: text = "ServiceType"` — invisible to tsc, and
  -- only reachable once a real query runs.
  "serviceType" "ServiceType",
  "label"       TEXT    NOT NULL,
  "quota"       INTEGER,
  "state"       TEXT    NOT NULL DEFAULT 'AVAILABLE',
  "sortOrder"   INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "HealthPlanBenefit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "HealthPlanBenefit_planId_sortOrder_idx"
  ON "HealthPlanBenefit" ("planId", "sortOrder");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'HealthPlanBenefit_planId_fkey'
      AND conrelid = '"HealthPlanBenefit"'::regclass
  ) THEN
    ALTER TABLE "HealthPlanBenefit"
      ADD CONSTRAINT "HealthPlanBenefit_planId_fkey"
      FOREIGN KEY ("planId") REFERENCES "HealthPlan"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ── What a patient holds ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "Membership" (
  "id"              TEXT          NOT NULL,
  "userId"          TEXT          NOT NULL,
  "planId"          TEXT          NOT NULL,
  "planName"        TEXT          NOT NULL,
  "pricePaid"       DECIMAL(18,3) NOT NULL,
  "discountPercent" DECIMAL(5,2)  NOT NULL,
  "startsAt"        TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt"       TIMESTAMP(3)  NOT NULL,
  "status"          TEXT          NOT NULL DEFAULT 'ACTIVE',
  "cancelledAt"     TIMESTAMP(3),
  "transactionId"   TEXT,
  "createdAt"       TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Membership_userId_expiresAt_idx"
  ON "Membership" ("userId", "expiresAt" DESC);
CREATE INDEX IF NOT EXISTS "Membership_status_expiresAt_idx"
  ON "Membership" ("status", "expiresAt");
CREATE INDEX IF NOT EXISTS "Membership_planId_idx" ON "Membership" ("planId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Membership_userId_fkey' AND conrelid = '"Membership"'::regclass
  ) THEN
    ALTER TABLE "Membership"
      ADD CONSTRAINT "Membership_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  -- RESTRICT, not CASCADE: a plan somebody bought is the record of what was
  -- sold. Deleting it must fail loudly rather than quietly erasing memberships.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Membership_planId_fkey' AND conrelid = '"Membership"'::regclass
  ) THEN
    ALTER TABLE "Membership"
      ADD CONSTRAINT "Membership_planId_fkey"
      FOREIGN KEY ("planId") REFERENCES "HealthPlan"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- ── The membership's own copy of each allowance, and its counter ──────────

CREATE TABLE IF NOT EXISTS "MembershipEntitlement" (
  "id"           TEXT    NOT NULL,
  "membershipId" TEXT    NOT NULL,
  -- The ENUM — see HealthPlanBenefit above.
  "serviceType"  "ServiceType",
  "label"        TEXT    NOT NULL,
  "quota"        INTEGER,
  "used"         INTEGER NOT NULL DEFAULT 0,
  "state"        TEXT    NOT NULL DEFAULT 'AVAILABLE',
  "sortOrder"    INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "MembershipEntitlement_pkey" PRIMARY KEY ("id")
);

-- One row per service per membership. `consumeEntitlement` updates by
-- (membershipId, serviceType), so a duplicate would make "which allowance did
-- that visit spend" ambiguous.
CREATE UNIQUE INDEX IF NOT EXISTS "MembershipEntitlement_membershipId_serviceType_key"
  ON "MembershipEntitlement" ("membershipId", "serviceType");
CREATE INDEX IF NOT EXISTS "MembershipEntitlement_membershipId_sortOrder_idx"
  ON "MembershipEntitlement" ("membershipId", "sortOrder");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'MembershipEntitlement_membershipId_fkey'
      AND conrelid = '"MembershipEntitlement"'::regclass
  ) THEN
    ALTER TABLE "MembershipEntitlement"
      ADD CONSTRAINT "MembershipEntitlement_membershipId_fkey"
      FOREIGN KEY ("membershipId") REFERENCES "Membership"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ── Repair: an earlier run of this file created serviceType as TEXT ───────
--
-- Prisma declares the field as the `ServiceType` enum, so a TEXT column makes
-- every lookup by service fail with `operator does not exist: text =
-- "ServiceType"`. Converted in place; both tables are empty of mismatched
-- values because the enum is the only thing that ever wrote them.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'HealthPlanBenefit' AND column_name = 'serviceType'
      AND data_type = 'text'
  ) THEN
    ALTER TABLE "HealthPlanBenefit"
      ALTER COLUMN "serviceType" TYPE "ServiceType" USING "serviceType"::"ServiceType";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'MembershipEntitlement' AND column_name = 'serviceType'
      AND data_type = 'text'
  ) THEN
    ALTER TABLE "MembershipEntitlement"
      ALTER COLUMN "serviceType" TYPE "ServiceType" USING "serviceType"::"ServiceType";
  END IF;
END $$;
