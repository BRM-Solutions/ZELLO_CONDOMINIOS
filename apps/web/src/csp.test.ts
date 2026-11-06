import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(__dirname, "..");
const html = readFileSync(join(root, "index.html"), "utf8");
const nginx = readFileSync(join(root, "nginx.conf"), "utf8");

describe("nginx CSP", () => {
  it("allows the inline theme script by hash", () => {
    const script = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1];
    expect(script).toBeTruthy();
    const hash = createHash("sha256").update(script as string).digest("base64");
    expect(nginx).toContain(`'sha256-${hash}'`);
  });

  it("keeps the hardening directives and build placeholders", () => {
    for (const fragment of ["frame-ancestors 'none'", "object-src 'none'", "__API_URL__", "__SUPABASE_URL__", "Strict-Transport-Security"]) {
      expect(nginx).toContain(fragment);
    }
    expect(nginx).not.toContain("script-src 'self' 'unsafe-inline'");
  });
});
