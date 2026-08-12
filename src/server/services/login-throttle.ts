import { prisma } from "@/lib/prisma";

/**
 * Throttle for the password sign-in path.
 *
 * The OTP path has always been bounded: a 6-digit code dies after 5 wrong
 * guesses, and a phone gets 3 codes an hour. The password path had no limit at
 * all — an attacker could guess a SUPER_ADMIN password indefinitely, as fast as
 * bcrypt would answer, and nothing anywhere recorded that it was happening.
 *
 * Two independent buckets, because either one alone is trivially sidestepped:
 *
 *   - **email** — stops one account being hammered from many addresses.
 *   - **IP** — stops one host spraying a common password across many accounts,
 *     which an email-only limit never sees (each account stays under its cap).
 *
 * The IP cap is the looser of the two: a clinic behind one NAT is many
 * legitimate users sharing an address, and locking them out together would be
 * its own outage.
 *
 * Counting is DB-backed rather than in-memory on purpose. Serverless instances
 * do not share memory, so an in-process counter resets on every cold start and
 * scales the attacker's allowance with our own fleet size.
 */

/** Failures tolerated per email before it is locked out for the window. */
const MAX_PER_EMAIL = 8;
/** Failures tolerated per source address in the same window. */
const MAX_PER_IP = 30;
const WINDOW_MS = 15 * 60 * 1000;

/** Rows older than this are dead weight; cleared opportunistically on write. */
const RETENTION_MS = 60 * 60 * 1000;

export type ThrottleVerdict = { allowed: true } | { allowed: false; retryAfterSeconds: number };

const emailKey = (email: string) => `email:${email.trim().toLowerCase()}`;
const ipKey = (ip: string) => `ip:${ip}`;

/**
 * Check both buckets BEFORE verifying a password.
 *
 * Deliberately runs before bcrypt: a cost-12 comparison is ~250ms of CPU, so
 * answering "too many attempts" first also stops the endpoint being used as a
 * cheap way to burn our own compute.
 */
export async function checkLoginAllowed(
  email: string,
  ip: string | null
): Promise<ThrottleVerdict> {
  const since = new Date(Date.now() - WINDOW_MS);

  const identifiers = [emailKey(email), ...(ip ? [ipKey(ip)] : [])];
  const rows = await prisma.loginAttempt.groupBy({
    by: ["identifier"],
    where: { identifier: { in: identifiers }, createdAt: { gt: since } },
    _count: { _all: true },
    _min: { createdAt: true },
  });

  for (const row of rows) {
    const isEmail = row.identifier.startsWith("email:");
    const cap = isEmail ? MAX_PER_EMAIL : MAX_PER_IP;
    if (row._count._all < cap) continue;

    // The window rolls off the OLDEST attempt still inside it, so the caller
    // gets an honest wait rather than a fixed number they can poll against.
    const oldest = row._min.createdAt?.getTime() ?? Date.now();
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((oldest + WINDOW_MS - Date.now()) / 1000)
    );
    return { allowed: false, retryAfterSeconds };
  }

  return { allowed: true };
}

/** Record a failed attempt against both buckets. */
export async function recordLoginFailure(email: string, ip: string | null): Promise<void> {
  const identifiers = [emailKey(email), ...(ip ? [ipKey(ip)] : [])];
  await prisma.loginAttempt.createMany({
    data: identifiers.map((identifier) => ({ identifier })),
  });

  // Opportunistic cleanup — no cron to depend on. Failures are rare, so this
  // runs rarely, and it only ever deletes rows already outside every window.
  await prisma.loginAttempt.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - RETENTION_MS) } },
  });
}

/**
 * Clear the email bucket after a correct password.
 *
 * The IP bucket is deliberately NOT cleared: an attacker with one valid account
 * would otherwise reset their own address's budget between sprays.
 */
export async function clearLoginFailures(email: string): Promise<void> {
  await prisma.loginAttempt.deleteMany({ where: { identifier: emailKey(email) } });
}
