/**
 * Set (or reset) a user's password, optionally creating the account.
 *
 *   npm run set-password -- admin@warid.app 'SomeStrongPassword'
 *   npm run set-password -- admin@warid.app 'Pass' --create --role=SUPER_ADMIN
 *
 * Passwords are never stored in plaintext — only a bcrypt hash is written.
 * Prefer passing the password via an env var if your shell records history:
 *
 *   NEW_PASSWORD='...' npm run set-password -- admin@warid.app
 */
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { PrismaClient, type UserRole } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import bcrypt from "bcryptjs";

// Standalone scripts do not get Next.js's automatic .env loading.
loadEnv({ path: path.join(process.cwd(), ".env.local") });
loadEnv({ path: path.join(process.cwd(), ".env") });

const BCRYPT_ROUNDS = 12;
const MIN_LENGTH = 10;

async function main() {
  const args = process.argv.slice(2);
  const flags = args.filter((a) => a.startsWith("--"));
  const positional = args.filter((a) => !a.startsWith("--"));

  const email = positional[0]?.trim().toLowerCase();
  const password = positional[1] ?? process.env.NEW_PASSWORD;
  const shouldCreate = flags.includes("--create");
  const role = (flags.find((f) => f.startsWith("--role="))?.split("=")[1] ??
    "SUPER_ADMIN") as UserRole;

  if (!email || !password) {
    console.error(
      "Usage: npm run set-password -- <email> '<password>' [--create] [--role=SUPER_ADMIN]\n" +
        "   or: NEW_PASSWORD='...' npm run set-password -- <email>"
    );
    process.exit(1);
  }

  if (password.length < MIN_LENGTH) {
    console.error(`Password must be at least ${MIN_LENGTH} characters.`);
    process.exit(1);
  }

  // Prisma 7 requires a driver adapter — `new PrismaClient()` with no options
  // throws. Mirrors src/lib/prisma.ts.
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, role: true, isActive: true },
    });

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    if (!user) {
      if (!shouldCreate) {
        console.error(`No user with email "${email}".`);
        const candidates = await prisma.user.findMany({
          where: { email: { not: null } },
          select: { email: true, role: true },
          take: 20,
          orderBy: { createdAt: "asc" },
        });
        if (candidates.length) {
          console.error("\nExisting accounts with an email:");
          for (const c of candidates) console.error(`  ${c.email}  (${c.role})`);
        } else {
          console.error("\nNo accounts have an email address yet.");
        }
        console.error(`\nTo create it: npm run set-password -- ${email} '<password>' --create`);
        process.exit(1);
      }

      const created = await prisma.user.create({
        data: { email, role, passwordHash, isActive: true, name: email.split("@")[0] },
        select: { email: true, role: true },
      });
      console.log(`Created ${created.email} (${created.role}) with a password.`);
      return;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    console.log(`Password set for ${user.email} (${user.role}).`);
    if (!user.isActive) {
      console.warn("Note: this account is inactive and cannot sign in until isActive is true.");
    }
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
