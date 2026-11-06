import { errorResponseSchema } from "@app/shared";
import { getSupabase } from "./supabase";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

let activeOrganizationId: string | undefined;

export function setActiveOrganizationId(id: string | undefined): void {
  activeOrganizationId = id;
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const supabase = getSupabase();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body !== undefined && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (activeOrganizationId) headers.set("X-Organization-Id", activeOrganizationId);

  let response: Response;
  try {
    response = await fetch(`${import.meta.env.VITE_API_URL}/api/v1${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Não foi possível conectar ao servidor");
  }

  if (response.ok) {
    return (await response.json()) as T;
  }

  const body: unknown = await response.json().catch(() => null);
  const parsed = errorResponseSchema.safeParse(body);
  const error = parsed.success
    ? new ApiError(response.status, parsed.data.error.code, parsed.data.error.message, parsed.data.error.details)
    : new ApiError(response.status, "UNKNOWN_ERROR", "Erro inesperado do servidor");

  if (response.status === 401) {
    await supabase.auth.signOut();
  }
  throw error;
}
