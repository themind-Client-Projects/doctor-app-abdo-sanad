import type { UserRole } from "@prisma/client";
import type { DefaultSession } from "next-auth";

/**
 * Module augmentation so `session.user.role` / `.partnerId` are typed.
 *
 * Replaces the `as unknown as Record<string, unknown>` casts that previously
 * defeated type-checking on the auth boundary — the most security-sensitive
 * data in the app.
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      partnerId: string | null;
    } & DefaultSession["user"];
  }
}

// NB: must target "@auth/core/jwt", not "next-auth/jwt". The latter is a pure
// `export *` re-export, so augmenting it declares a separate interface instead
// of merging into the real one.
declare module "@auth/core/jwt" {
  interface JWT {
    /**
     * Optional by design: the jwt callback strips these when the user is
     * deleted or deactivated, so an existing token stops granting access.
     */
    userId?: string;
    role?: UserRole;
    partnerId?: string | null;
    /** Epoch ms of the last DB sync, used to bound role staleness. */
    syncedAt?: number;
  }
}

export {};
