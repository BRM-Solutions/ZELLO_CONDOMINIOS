import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    reporters: ["dot"],
    silent: "passed-only",
    testTimeout: 30_000,
    hookTimeout: 120_000,
    setupFiles: ["./src/test/setup.ts"],
    fileParallelism: false,
    include: ["src/**/*.test.ts"],
  },
});
