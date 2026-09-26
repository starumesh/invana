import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/** True when both public Supabase env vars look like a real Connected Mode project. */
export function isSupabaseConfigured(): boolean {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim() ?? "";
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";
  if (!url || !key) return false;
  // Treat .env.example placeholders as unset so Demo Mode (and Sign in) stay consistent.
  if (/YOUR_PROJECT/i.test(url) || key === "eyJ..." || key.includes("YOUR_")) return false;
  return true;
}

/**
 * Browser Supabase client (anon / publishable key only).
 * Returns null when Demo Mode — callers must fall back to demo adapters.
 */
export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (client) return client;
  const url = import.meta.env.VITE_SUPABASE_URL!.trim();
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY!.trim();
  client = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      // Query-param tokens (?code=) work with BrowserRouter path URLs.
      flowType: "pkce",
    },
  });
  return client;
}

/** Throws if Connected Mode env is missing — use only inside Connected adapters. */
export function requireSupabase(): SupabaseClient {
  const sb = getSupabase();
  if (!sb) {
    throw new Error("Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.");
  }
  return sb;
}
