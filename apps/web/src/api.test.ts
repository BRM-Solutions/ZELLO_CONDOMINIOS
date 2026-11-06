import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiFetch, setActiveOrganizationId } from "./api";

const signOut = vi.fn();

vi.mock("./supabase", () => ({
  getSupabase: () => ({
    auth: {
      getSession: async () => ({ data: { session: { access_token: "token-123" } } }),
      signOut,
    },
  }),
}));

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("apiFetch", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_API_URL", "https://api.example.test");
    signOut.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("sends the Bearer token to the versioned API", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ data: 1 }, 200));
    vi.stubGlobal("fetch", fetchMock);
    await expect(apiFetch("/me")).resolves.toEqual({ data: 1 });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.example.test/api/v1/me");
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer token-123");
  });

  it("sends the active organization header", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ data: 1 }, 200));
    vi.stubGlobal("fetch", fetchMock);
    setActiveOrganizationId("22222222-2222-4222-8222-222222222222");
    await apiFetch("/workspaces");
    setActiveOrganizationId(undefined);
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(new Headers(init.headers).get("X-Organization-Id")).toBe("22222222-2222-4222-8222-222222222222");
  });

  it("maps the standard error format to ApiError", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: { code: "FORBIDDEN", message: "Sem permissão" } }, 403)));
    await expect(apiFetch("/x")).rejects.toMatchObject({ status: 403, code: "FORBIDDEN", message: "Sem permissão" });
    expect(signOut).not.toHaveBeenCalled();
  });

  it("signs the user out on 401", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: { code: "AUTH_REQUIRED", message: "Autenticação necessária" } }, 401)));
    await expect(apiFetch("/x")).rejects.toBeInstanceOf(ApiError);
    expect(signOut).toHaveBeenCalledOnce();
  });

  it("falls back to a generic error for non-standard bodies and network failures", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("boom", { status: 502 })));
    await expect(apiFetch("/x")).rejects.toMatchObject({ status: 502, code: "UNKNOWN_ERROR" });
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("failed"); }));
    await expect(apiFetch("/x")).rejects.toMatchObject({ status: 0, code: "NETWORK_ERROR" });
  });
});
