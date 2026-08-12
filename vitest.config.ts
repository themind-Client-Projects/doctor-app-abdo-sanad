import path from "node:path";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "vitest/config";

// Tests talk to the dev database, so they need the same env the app gets.
loadEnv({ path: path.join(process.cwd(), ".env.local") });
loadEnv({ path: path.join(process.cwd(), ".env") });

export default defineConfig({
  resolve: {
    alias: { "@": path.join(process.cwd(), "src") },
  },
  test: {
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
