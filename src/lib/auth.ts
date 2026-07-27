import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { normalizePhone } from "./phone";

/** Re-read role/partner/isActive from the DB if the token is older than this. */
const TOKEN_REFRESH_SECONDS = 5 * 60;

/**
 * A valid bcrypt hash of a value nobody can supply. Compared against when no
 * user or no password exists, so a wrong email and a wrong password take the
 * same time — otherwise the endpoint becomes an account-enumeration oracle.
 *
 * MUST be generated at BCRYPT_ROUNDS: bcrypt.compare takes its work factor
 * from the stored hash, so a cheaper dummy makes the "no such user" path
 * measurably faster and re-opens the oracle it exists to close.
 */
const DUMMY_PASSWORD_HASH = "$2b$12$7K5CQ4UKD8jWYBos1PrWguddIBh4TtBYC3.Bq6gFX7lzr.k87OkSa";

/** Cost factor for new password hashes. */
export const BCRYPT_ROUNDS = 12;

/** Failed OTP guesses tolerated before every live code for a phone is burnt. */
const MAX_OTP_ATTEMPTS = 5;

/** Hash a plaintext password for storage. */
export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  // 8h beats the 30-day default: a JWT session cannot be revoked, so its
  // lifetime is the blast radius of a stolen token.
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  providers: [
    // Google OAuth
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),

    // Email + password — the staff sign-in path. Patients have no password
    // and use the phone OTP provider below.
    Credentials({
      id: "email-password",
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = typeof credentials?.email === "string" ? credentials.email.trim().toLowerCase() : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });

        // Compare against a dummy hash when the user is absent or has no
        // password, so response time does not reveal which emails exist.
        const hash = user?.passwordHash ?? DUMMY_PASSWORD_HASH;
        const passwordMatches = await bcrypt.compare(password, hash);

        if (!user || !user.passwordHash || !passwordMatches) return null;
        if (!user.isActive) return null;

        return {
          id: user.id,
          email: user.email,
          phone: user.phone,
          name: user.name,
          image: user.image,
        };
      },
    }),

    // Phone OTP credentials (verified via UltraMessages)
    Credentials({
      id: "phone-otp",
      name: "Phone OTP",
      credentials: {
        phone: { label: "Phone", type: "text" },
        code: { label: "OTP Code", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.phone || !credentials?.code) return null;

        // Same normalisation as /otp/send, so a code requested as 07xx can be
        // verified as +9647xx.
        const phone = normalizePhone(String(credentials.phone));
        const code = String(credentials.code);
        if (!phone) return null;

        // Consume the code atomically. updateMany + a count check means two
        // concurrent verifications cannot both succeed, and a consumed code can
        // never be replayed — previously `verified` was the only guard and the
        // standalone /verify endpoint never set it.
        const consumed = await prisma.oTPCode.updateMany({
          where: {
            phone,
            code,
            verified: false,
            consumedAt: null,
            attempts: { lt: MAX_OTP_ATTEMPTS },
            expiresAt: { gt: new Date() },
          },
          data: { verified: true, consumedAt: new Date() },
        });

        if (consumed.count === 0) {
          // Count the failure against every live code for this phone, so a
          // 6-digit space cannot be walked indefinitely.
          await prisma.oTPCode.updateMany({
            where: { phone, consumedAt: null, expiresAt: { gt: new Date() } },
            data: { attempts: { increment: 1 } },
          });
          return null;
        }

        // Find or create user
        let user = await prisma.user.findUnique({
          where: { phone },
        });

        if (!user) {
          // Self-service patient signup only.
          user = await prisma.user.create({
            data: {
              phone,
              role: "PATIENT",
            },
          });
        }

        // CRITICAL: phone OTP is the PATIENT sign-in path only.
        //
        // Staff accounts are seeded with phone numbers, so without this check
        // anyone could request an OTP for a known admin's phone and, on one
        // correct code, receive a full SUPER_ADMIN session. Staff must sign in
        // with email + password.
        if (user.role !== "PATIENT") return null;

        // A deactivated account must not be able to sign in.
        if (!user.isActive) return null;

        return {
          id: user.id,
          phone: user.phone,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
  callbacks: {
    // Attach role + partnerId to the JWT, and keep them fresh.
    //
    // Previously this only ran at initial sign-in, so a demoted or deactivated
    // user kept their privileges for the full token lifetime. Re-reading on a
    // short interval bounds that staleness to TOKEN_REFRESH_SECONDS.
    async jwt({ token, user }) {
      const userId = user?.id ?? token.userId;
      if (!userId) return token;

      const lastSynced = typeof token.syncedAt === "number" ? token.syncedAt : 0;
      const isStale = Date.now() - lastSynced > TOKEN_REFRESH_SECONDS * 1000;
      if (!isStale && token.role) return token;

      const dbUser = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          partner: { select: { id: true } },
          doctorProfile: { select: { id: true } },
        },
      });

      // User deleted or deactivated since the token was issued — strip the
      // identity so requireAuth() rejects it.
      if (!dbUser || !dbUser.isActive) {
        delete token.userId;
        delete token.role;
        delete token.partnerId;
        delete token.doctorProfileId;
        return token;
      }

      token.userId = dbUser.id;
      token.role = dbUser.role;
      token.partnerId = dbUser.partner?.id ?? null;
      token.doctorProfileId = dbUser.doctorProfile?.id ?? null;
      token.syncedAt = Date.now();
      return token;
    },
    // Expose role + partnerId on the session (typed via src/types/next-auth.d.ts)
    async session({ session, token }) {
      // Only populate when the token carries a live identity. If it doesn't,
      // the fields stay unset and requireAuth() rejects the request.
      if (session.user && token.userId && token.role) {
        session.user.id = token.userId;
        session.user.role = token.role;
        session.user.partnerId = token.partnerId ?? null;
        session.user.doctorProfileId = token.doctorProfileId ?? null;
      }
      return session;
    },
  },
});
