import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

// ─────────────────────────────────────────────────────────────
// Prisma v7 — requires driver adapter (no url in schema)
// ─────────────────────────────────────────────────────────────

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query"] : [],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/**
 * Options for any interactive transaction that makes several round trips.
 *
 * Prisma's default is 5 seconds, measured from `$transaction` opening — not per
 * statement. Against a pooled remote database each round trip costs real
 * latency, so a transaction doing half a dozen reads and writes can exceed it
 * on a slow link while every individual query is fine. That surfaced here as
 * intermittent "cannot commit an expired transaction" failures in settlement,
 * order pricing and refresh-token rotation.
 *
 * The fix is not a test workaround: the same timeout hits a real user as a 500
 * on a booking or a sign-in refresh. Raising it trades a rare stuck connection
 * for not aborting work that was going to succeed.
 *
 * `maxWait` is how long to wait for a connection from the pool BEFORE the
 * transaction starts, which is a different failure and needs its own budget.
 */
export const TX_OPTIONS = { timeout: 20_000, maxWait: 10_000 } as const;
