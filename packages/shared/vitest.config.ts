import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    reporters: ["dot"],
    silent: "passed-only",
    include: ["src/**/*.test.ts"],
  },
});
