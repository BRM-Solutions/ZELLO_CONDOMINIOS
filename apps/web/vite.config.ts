import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  envDir: "../..",
  server: { port: 5173 },
  build: { sourcemap: false, target: "es2022" },
  test: {
    environment: "jsdom",
    reporters: ["dot"],
    silent: "passed-only",
    setupFiles: ["./src/test-setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
