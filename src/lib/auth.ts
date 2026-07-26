import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./prisma";

/** Re-read role/partner/isActive from the DB if the token is older than this. */
const TOKEN_REFRESH_SECONDS = 5 * 60;

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

        const phone = credentials.phone as string;
        const code = credentials.code as string;

        // Verify OTP from database
        const otp = await prisma.oTPCode.findFirst({
          where: {
            phone,
            code,
            verified: false,
            expiresAt: { gt: new Date() },
          },
          orderBy: { createdAt: "desc" },
        });

        if (!otp) return null;

        // Mark OTP as verified
        await prisma.oTPCode.update({
          where: { id: otp.id },
          data: { verified: true },
        });

        // Find or create user
        let user = await prisma.user.findUnique({
          where: { phone },
        });

        if (!user) {
          // Self-service patient signup. The role is pinned here and is never
          // derived from input — staff roles are assigned by an admin only.
          user = await prisma.user.create({
            data: {
              phone,
              role: "PATIENT",
            },
          });
        }

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
        include: { partner: { select: { id: true } } },
      });

      // User deleted or deactivated since the token was issued — strip the
      // identity so requireAuth() rejects it.
      if (!dbUser || !dbUser.isActive) {
        delete token.userId;
        delete token.role;
        delete token.partnerId;
        return token;
      }

      token.userId = dbUser.id;
      token.role = dbUser.role;
      token.partnerId = dbUser.partner?.id ?? null;
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
      }
      return session;
    },
  },
});
