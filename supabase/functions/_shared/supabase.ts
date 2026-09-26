import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";

export function anonClient(authHeader?: string | null): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  return createClient(url, anon, {
    global: authHeader ? { headers: { Authorization: authHeader } } : undefined,
  });
}

export function serviceClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key);
}

export async function requireUserId(authHeader: string | null): Promise<string> {
  if (!authHeader) throw new Error("UNAUTHORIZED");
  const client = anonClient(authHeader);
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error("UNAUTHORIZED");
  return data.user.id;
}
