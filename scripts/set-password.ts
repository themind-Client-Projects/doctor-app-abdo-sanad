/**
 * Set (or reset) a user's password.
 *
 *   npm run set-password -- admin@warid.app 'SomeStrongPassword'
 *
 * Passwords are never stored in plaintext — only a bcrypt hash is written.
 * Prefer passing the password via an env var if your shell records history:
 *
 *   NEW_PASSWORD='...' npm run set-password -- admin@warid.app
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 12;
const MIN_LENGTH = 10;

async function main() {
  const [emailArg, passwordArg] = process.argv.slice(2);
  const email = emailArg?.trim().toLowerCase();
  const password = passwordArg ?? process.env.NEW_PASSWORD;

  if (!email || !password) {
    console.error(
      "Usage: npm run set-password -- <email> '<password>'\n" +
        "   or: NEW_PASSWORD='...' npm run set-password -- <email>"
    );
    process.exit(1);
  }

  if (password.length < MIN_LENGTH) {
    console.error(`Password must be at least ${MIN_LENGTH} characters.`);
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, role: true, isActive: true },
    });

    if (!user) {
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
        console.error("\nNo accounts have an email address yet. Seed the database first.");
      }
      process.exit(1);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS) },
    });

    console.log(`Password set for ${user.email} (${user.role}).`);
    if (!user.isActive) {
      console.warn("Note: this account is inactive and cannot sign in until isActive is true.");
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
