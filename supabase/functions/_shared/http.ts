import { corsHeaders } from "./cors.ts";

/** Resolve or mint a request id and return response header helpers. */
export function requestId(req: Request): string {
  const incoming = req.headers.get("x-request-id")?.trim();
  if (incoming && incoming.length <= 128) return incoming;
  return crypto.randomUUID();
}

export function json(
  body: unknown,
  status = 200,
  extras?: { requestId?: string; headers?: Record<string, string> },
): Response {
  const headers: Record<string, string> = {
    ...corsHeaders,
    "Content-Type": "application/json",
    ...(extras?.headers ?? {}),
  };
  if (extras?.requestId) headers["x-request-id"] = extras.requestId;
  return new Response(JSON.stringify(body), { status, headers });
}

export function text(
  body: string,
  status = 200,
  extras?: { requestId?: string; contentType?: string; headers?: Record<string, string> },
): Response {
  const headers: Record<string, string> = {
    ...corsHeaders,
    "Content-Type": extras?.contentType ?? "text/plain; charset=utf-8",
    ...(extras?.headers ?? {}),
  };
  if (extras?.requestId) headers["x-request-id"] = extras.requestId;
  return new Response(body, { status, headers });
}

export function clientIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function readJson<T>(req: Request): Promise<T> {
  return (await req.json()) as T;
}
