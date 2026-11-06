import { z } from "zod";

export interface StorageObjectRef {
  bucket: string;
  path: string;
}

export interface StorageAuth {
  accessToken?: string;
}

export interface SignedUpload {
  url: string;
  token: string;
}

export interface SignedDownload {
  url: string;
}

export interface StoredObjectInfo {
  sizeBytes: number;
  mimeType: string | null;
}

export interface StorageClient {
  createSignedUploadUrl(ref: StorageObjectRef, auth: StorageAuth): Promise<SignedUpload>;
  createSignedDownloadUrl(ref: StorageObjectRef, expiresInSeconds: number, auth: StorageAuth): Promise<SignedDownload>;
  headObject(ref: StorageObjectRef, auth: StorageAuth): Promise<StoredObjectInfo | null>;
  removeObjects(bucket: string, paths: string[], auth: StorageAuth): Promise<void>;
}

export class StorageError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body = "",
  ) {
    super(message);
    this.name = "StorageError";
  }

  get isPolicyDenied(): boolean {
    return this.status === 401 || this.status === 403 || (this.status === 400 && /row-level security/i.test(this.body));
  }
}

export interface SupabaseStorageOptions {
  url: string;
  apiKey: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

const REMOVE_CHUNK = 100;

const signedUploadResponse = z.object({ url: z.string().min(1), token: z.string().optional() });
const signedDownloadResponse = z.object({ signedURL: z.string().min(1) });
const objectInfoResponse = z
  .object({
    size: z.coerce.number().optional(),
    contentType: z.string().nullish(),
    content_type: z.string().nullish(),
    metadata: z
      .object({ size: z.coerce.number().optional(), mimetype: z.string().nullish(), contentLength: z.coerce.number().optional() })
      .partial()
      .nullish(),
  })
  .passthrough();

const encodePath = (path: string) => path.split("/").map(encodeURIComponent).join("/");

export function createSupabaseStorageClient(options: SupabaseStorageOptions): StorageClient {
  const base = `${options.url.replace(/\/$/, "")}/storage/v1`;
  const doFetch = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 10_000;

  async function call(method: string, path: string, auth: StorageAuth, body?: unknown): Promise<Response> {
    const headers: Record<string, string> = { apikey: options.apiKey };
    if (auth.accessToken) headers.Authorization = `Bearer ${auth.accessToken}`;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    try {
      return await doFetch(`${base}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      throw new StorageError(503, "storage indisponível");
    }
  }

  async function failure(res: Response, action: string): Promise<StorageError> {
    const text = await res.text().catch(() => "");
    return new StorageError(res.status, `storage: falha em ${action} (${res.status})`, text.slice(0, 300));
  }

  const absolute = (value: string) => (/^https?:\/\//i.test(value) ? value : `${base}${value.startsWith("/") ? "" : "/"}${value}`);

  return {
    async createSignedUploadUrl(ref, auth) {
      const res = await call("POST", `/object/upload/sign/${ref.bucket}/${encodePath(ref.path)}`, auth);
      if (!res.ok) throw await failure(res, "createSignedUploadUrl");
      const parsed = signedUploadResponse.safeParse(await res.json().catch(() => null));
      if (!parsed.success) throw new StorageError(502, "storage: resposta inválida em createSignedUploadUrl");
      const url = absolute(parsed.data.url);
      const token = parsed.data.token ?? new URL(url).searchParams.get("token");
      if (!token) throw new StorageError(502, "storage: token de upload ausente");
      return { url, token };
    },

    async createSignedDownloadUrl(ref, expiresInSeconds, auth) {
      const res = await call("POST", `/object/sign/${ref.bucket}/${encodePath(ref.path)}`, auth, {
        expiresIn: expiresInSeconds,
      });
      if (!res.ok) throw await failure(res, "createSignedDownloadUrl");
      const parsed = signedDownloadResponse.safeParse(await res.json().catch(() => null));
      if (!parsed.success) throw new StorageError(502, "storage: resposta inválida em createSignedDownloadUrl");
      return { url: absolute(parsed.data.signedURL) };
    },

    async headObject(ref, auth) {
      const res = await call("GET", `/object/info/${ref.bucket}/${encodePath(ref.path)}`, auth);
      if (res.status === 404) return null;
      if (res.status === 400) {
        const text = await res.text().catch(() => "");
        if (/not.?found/i.test(text)) return null;
        throw new StorageError(400, "storage: falha em headObject (400)", text.slice(0, 300));
      }
      if (!res.ok) throw await failure(res, "headObject");
      const parsed = objectInfoResponse.safeParse(await res.json().catch(() => null));
      if (!parsed.success) throw new StorageError(502, "storage: resposta inválida em headObject");
      const info = parsed.data;
      const size = info.size ?? info.metadata?.size ?? info.metadata?.contentLength;
      if (size === undefined || !Number.isFinite(size)) throw new StorageError(502, "storage: tamanho ausente em headObject");
      return { sizeBytes: size, mimeType: info.contentType ?? info.content_type ?? info.metadata?.mimetype ?? null };
    },

    async removeObjects(bucket, paths, auth) {
      for (let i = 0; i < paths.length; i += REMOVE_CHUNK) {
        const res = await call("DELETE", `/object/${bucket}`, auth, { prefixes: paths.slice(i, i + REMOVE_CHUNK) });
        if (!res.ok) throw await failure(res, "removeObjects");
      }
    },
  };
}
