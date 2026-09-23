import path from "node:path";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "vitest/config";

// Tests talk to the dev database, so they need the same env the app gets.
loadEnv({ path: path.join(process.cwd(), ".env.local") });
loadEnv({ path: path.join(process.cwd(), ".env") });

export default defineConfig({
  resolve: {
    alias: [
      // next-auth's ESM does a bare `import "next/server"`, which Vite's node
      // resolver cannot map without the extension. Without this, importing any
      // route handler — they all reach `lib/api-auth` — dies at module load,
      // which is why no test in this suite had ever run an ENDPOINT. They
      // queried Prisma directly and could not have caught, say, a foreign key
      // pointed at the wrong id space.
      { find: /^next\/server$/, replacement: path.join(process.cwd(), "node_modules/next/server.js") },
      { find: "@", replacement: path.join(process.cwd(), "src") },
    ],
  },
  test: {
    // The alias above only applies to modules Vite transforms, and next-auth is
    // externalised by default — so it has to be inlined for the alias to reach
    // the import that needs it.
    server: { deps: { inline: [/next-auth/, /@auth\//] } },
    environment: "node",
    // Money tests share rows; running files in parallel makes them flaky.
    fileParallelism: false,
    // Generous because these tests talk to a REMOTE database, not a local one.
    // A single round-trip to the pooler has been measured between 259ms and
    // 4.3s, and the order-lifecycle tests make twenty or more per case — so a
    // 30s budget failed on latency alone, with no defect involved. Better a
    // slow suite than one that cries wolf.
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
