/**
 * Thin client for Invana Phase 1 Edge logical APIs.
 * Maps product routes (/v1/…) onto Supabase Functions (/functions/v1/…).
 */
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";

export function newRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function edgeFunctionsBaseUrl(): string | null {
  if (!isSupabaseConfigured()) return null;
  const base = import.meta.env.VITE_SUPABASE_URL?.trim().replace(/\/$/, "");
  return base ? `${base}/functions/v1` : null;
}

export type EdgeCallOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  /** Path after /functions/v1/ e.g. `invite?slug=foo` */
  path: string;
  body?: unknown;
  /** Include the current user JWT when available. */
  auth?: boolean;
  /** Optional abort / timeout via AbortSignal. */
  signal?: AbortSignal;
};

export class EdgeApiError extends Error {
  status: number;
  requestId?: string;
  payload?: unknown;

  constructor(message: string, status: number, requestId?: string, payload?: unknown) {
    super(message);
    this.name = "EdgeApiError";
    this.status = status;
    this.requestId = requestId;
    this.payload = payload;
  }
}

/**
 * Call an Edge Function. Returns null when Connected Mode env is missing
 * (caller should fall back to PostgREST / demo adapters).
 */
export async function callEdgeFunction<T>(opts: EdgeCallOptions): Promise<T | null> {
  const base = edgeFunctionsBaseUrl();
  if (!base) return null;

  const requestId = newRequestId();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-request-id": requestId,
  };

  const publishable = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (publishable) headers.apikey = publishable;

  if (opts.auth !== false) {
    const sb = getSupabase();
    const { data } = (await sb?.auth.getSession()) ?? { data: { session: null } };
    const token = data.session?.access_token ?? publishable;
    if (token) headers.Authorization = `Bearer ${token}`;
  } else if (publishable) {
    // Anon public routes still need the project apikey + anon JWT for the gateway.
    headers.Authorization = `Bearer ${publishable}`;
  }

  const res = await fetch(`${base}/${opts.path.replace(/^\//, "")}`, {
    method: opts.method ?? (opts.body ? "POST" : "GET"),
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    signal: opts.signal,
  });

  const responseRequestId = res.headers.get("x-request-id") ?? requestId;
  let payload: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      payload = { raw: text };
    }
  }

  if (!res.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      typeof (payload as { error: unknown }).error === "string"
        ? (payload as { error: string }).error
        : `Edge API error (${res.status})`;
    throw new EdgeApiError(message, res.status, responseRequestId, payload);
  }

  return payload as T;
}
