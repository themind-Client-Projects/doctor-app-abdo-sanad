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
    testTimeout: 30_000,
  },
});
