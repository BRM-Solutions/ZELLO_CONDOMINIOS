import { describe, expect, it } from "vitest";
import { StorageError, createSupabaseStorageClient } from "../integrations/storage-client";

interface Captured {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

function mockFetch(responder: (call: Captured) => Response) {
  const calls: Captured[] = [];
  const fetchImpl = (async (input: string | URL, init?: RequestInit) => {
    const call: Captured = {
      url: String(input),
      method: init?.method ?? "GET",
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    };
    calls.push(call);
    return responder(call);
  }) as typeof fetch;
  return { calls, fetchImpl };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const ref = { bucket: "private-files", path: "org/ws/id/file name.pdf" };
const base = "https://x.supabase.co/storage/v1";

describe("supabase storage client", () => {
  it("signs uploads with the user JWT and publishable key", async () => {
    const { calls, fetchImpl } = mockFetch(() => json({ url: "/object/upload/sign/private-files/org/ws/id/file%20name.pdf?token=tok" }));
    const client = createSupabaseStorageClient({ url: "https://x.supabase.co/", apiKey: "sb_publishable_x", fetchImpl });
    const result = await client.createSignedUploadUrl(ref, { accessToken: "user-jwt" });
    expect(result).toEqual({ url: `${base}/object/upload/sign/private-files/org/ws/id/file%20name.pdf?token=tok`, token: "tok" });
    expect(calls[0]).toMatchObject({
      method: "POST",
      url: `${base}/object/upload/sign/private-files/org/ws/id/file%20name.pdf`,
      headers: { apikey: "sb_publishable_x", Authorization: "Bearer user-jwt" },
    });
  });

  it("requests a signed download URL with the TTL", async () => {
    const { calls, fetchImpl } = mockFetch(() => json({ signedURL: "/object/sign/private-files/a?token=t" }));
    const client = createSupabaseStorageClient({ url: "https://x.supabase.co", apiKey: "k", fetchImpl });
    const result = await client.createSignedDownloadUrl(ref, 120, { accessToken: "jwt" });
    expect(result.url).toBe(`${base}/object/sign/private-files/a?token=t`);
    expect(calls[0]?.body).toEqual({ expiresIn: 120 });
  });

  it("reads object info and treats 404 as missing", async () => {
    const found = createSupabaseStorageClient({
      url: "https://x.supabase.co",
      apiKey: "k",
      fetchImpl: mockFetch(() => json({ size: 2048, contentType: "application/pdf" })).fetchImpl,
    });
    expect(await found.headObject(ref, { accessToken: "jwt" })).toEqual({ sizeBytes: 2048, mimeType: "application/pdf" });
    const nested = createSupabaseStorageClient({
      url: "https://x.supabase.co",
      apiKey: "k",
      fetchImpl: mockFetch(() => json({ metadata: { size: 10, mimetype: "image/png" } })).fetchImpl,
    });
    expect(await nested.headObject(ref, {})).toEqual({ sizeBytes: 10, mimeType: "image/png" });
    const missing = createSupabaseStorageClient({
      url: "https://x.supabase.co",
      apiKey: "k",
      fetchImpl: mockFetch(() => json({ error: "not_found" }, 404)).fetchImpl,
    });
    expect(await missing.headObject(ref, {})).toBeNull();
  });

  it("removes objects in chunks with only the apikey header for the worker", async () => {
    const { calls, fetchImpl } = mockFetch(() => json([]));
    const client = createSupabaseStorageClient({ url: "https://x.supabase.co", apiKey: "sb_secret_x", fetchImpl });
    const paths = Array.from({ length: 150 }, (_, i) => `o/${i}`);
    await client.removeObjects("private-files", paths, {});
    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatchObject({ method: "DELETE", url: `${base}/object/private-files` });
    expect(calls[0]?.headers.Authorization).toBeUndefined();
    expect(calls[0]?.headers.apikey).toBe("sb_secret_x");
    expect((calls[1]?.body as { prefixes: string[] }).prefixes).toHaveLength(50);
  });

  it("raises StorageError with policy-denied detection and never leaks credentials in messages", async () => {
    const client = createSupabaseStorageClient({
      url: "https://x.supabase.co",
      apiKey: "sb_secret_x",
      fetchImpl: mockFetch(() => json({ message: "new row violates row-level security policy" }, 400)).fetchImpl,
    });
    const err = await client.createSignedUploadUrl(ref, { accessToken: "jwt-secret" }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(StorageError);
    expect((err as StorageError).isPolicyDenied).toBe(true);
    expect((err as StorageError).message).not.toContain("jwt-secret");

    const down = createSupabaseStorageClient({
      url: "https://x.supabase.co",
      apiKey: "k",
      fetchImpl: (async () => {
        throw new Error("boom");
      }) as typeof fetch,
    });
    const failure = await down.removeObjects("b", ["p"], {}).catch((e: unknown) => e);
    expect(failure).toMatchObject({ status: 503 });
  });
});
