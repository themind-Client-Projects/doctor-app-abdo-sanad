-- إعادة الإحالة — the parent pointer that makes a referral chain traceable.
--
-- A lab replies with a result and the doctor re-refers the same patient onward
-- to a pharmacy. That is a NEW document with its own number and its own 30-day
-- validity, so the link is a parent pointer rather than a status on the old row.
--
-- ON DELETE SET NULL, deliberately. Cascading would let removing one referral
-- delete every prescription written downstream of it — documents a pharmacy may
-- already have dispensed against. An orphaned chain is recoverable; a deleted
-- clinical record is not.
--
-- Idempotent, so it is safe to run against a database that already has it.
-- Apply with:
--   dotenvx run -f .env.local -- psql "$DIRECT_URL" -f prisma/sql/referral-parent-chain.sql
--
-- A fresh database created from schema.prisma already has all of this; this
-- file exists for an EXISTING one, where `prisma db push` is not being run.

ALTER TABLE "ComplexReferral"
  ADD COLUMN IF NOT EXISTS "parentId" TEXT;

DO $$
BEGIN
  -- Matched on table AND name: `conname` is only unique per table, so checking
  -- the name alone would skip creating this constraint if some other table
  -- happened to carry one with the same name.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ComplexReferral_parentId_fkey'
      AND conrelid = '"ComplexReferral"'::regclass
  ) THEN
    ALTER TABLE "ComplexReferral"
      ADD CONSTRAINT "ComplexReferral_parentId_fkey"
      FOREIGN KEY ("parentId") REFERENCES "ComplexReferral"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Reading a chain walks children by parent; without this it is a sequential
-- scan of every referral on the platform per row rendered.
CREATE INDEX IF NOT EXISTS "ComplexReferral_parentId_idx"
  ON "ComplexReferral" ("parentId");
