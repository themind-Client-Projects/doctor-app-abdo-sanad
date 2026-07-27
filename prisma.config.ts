import path from "node:path";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// Prisma 7 config files do NOT auto-load .env, so process.env.DATABASE_URL was
// undefined here and every migration command failed with
// "The datasource.url property is required in your Prisma config file".
// .env.local is loaded first because dotenv does not overwrite already-set
// vars, which mirrors Next.js precedence.
loadEnv({ path: path.join(__dirname, ".env.local") });
loadEnv({ path: path.join(__dirname, ".env") });

export default defineConfig({
  schema: path.join(__dirname, "prisma", "schema.prisma"),
  // Prisma 7 reads the seed command from here, not from package.json.
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // DDL must go over the session-mode connection. DATABASE_URL points at the
    // transaction pooler, which does not reliably support DDL or advisory
    // locks, so a migration can fail halfway through.
    url: process.env.DIRECT_URL || process.env.DATABASE_URL || "",
  },
});
