-- Exactly one OPEN version per (contract, service).
--
-- `CommissionRule` used to carry @@unique([contractId, serviceType]). Versioning
-- removed it: a contract now holds many historical versions per service, and
-- only one of them — the one with no `effectiveTo` — is in force.
--
-- Prisma cannot express a partial index (no WHERE clause on @@unique), so the
-- guarantee lives here and is applied by the seed. Without it, two concurrent
-- edits to the same rule could both insert an open version, and
-- `resolveCommissionRule` would silently pick whichever sorted first — i.e. the
-- percentages that pay a partner would depend on a race.
CREATE UNIQUE INDEX IF NOT EXISTS "CommissionRule_open_version_key"
  ON "CommissionRule" ("contractId", "serviceType")
  WHERE "effectiveTo" IS NULL;
