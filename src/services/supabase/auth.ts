import type { AuthProvider } from "@/services/types";
import { requireSupabase } from "@/lib/supabase/client";
import type { DemoUser } from "@/types";
import type { Session, User } from "@supabase/supabase-js";

/** Shared MVP OTP (not emailed). Override with VITE_DEV_OTP. */
export const DEV_OTP = (import.meta.env.VITE_DEV_OTP?.trim() || "123456");

function mapUser(user: User | null | undefined): DemoUser | null {
  if (!user) return null;
  const name =
    (typeof user.user_metadata?.name === "string" && user.user_metadata.name) ||
    user.email?.split("@")[0] ||
    "Host";
  return {
    id: user.id,
    email: user.email ?? "",
    name,
  };
}

let cached: DemoUser | null = null;
let listening = false;

function ensureListener() {
  if (listening) return;
  listening = true;
  const sb = requireSupabase();
  sb.auth.onAuthStateChange((_event, session: Session | null) => {
    cached = mapUser(session?.user);
  });
  void sb.auth.getSession().then(({ data }) => {
    cached = mapUser(data.session?.user);
  });
}

/**
 * Connected Mode auth — email + hardcoded OTP (no magic-link / no outbound mail).
 * OTP is stored as the Auth password for that email so Supabase still issues a real session.
 * Call `await supabaseAuth.ready()` once after app boot if you need session before first paint.
 *
 * Supabase dashboard: Authentication → Providers → Email → turn OFF "Confirm email".
 */
export const supabaseAuth: AuthProvider & {
  ready: () => Promise<DemoUser | null>;
  /** Email + OTP. OTP must match DEV_OTP / VITE_DEV_OTP (default 123456). */
  signInWithEmailOtp: (email: string, otp: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
} = {
  currentUser() {
    ensureListener();
    return cached;
  },
  ensureUser() {
    ensureListener();
    if (cached) return cached;
    return {
      id: "unauthenticated",
      email: "",
      name: "Sign in required",
    };
  },
  async ready() {
    const sb = requireSupabase();
    const { data } = await sb.auth.getSession();
    cached = mapUser(data.session?.user);
    ensureListener();
    return cached;
  },
  async signInWithEmailOtp(email: string, otp: string) {
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedOtp = otp.trim();
    if (!trimmedEmail) return { error: "Enter an email." };
    if (trimmedOtp !== DEV_OTP) {
      return { error: "That code doesn’t look right. Please try again." };
    }

    const sb = requireSupabase();
    const password = DEV_OTP;

    const signIn = await sb.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });

    if (!signIn.error && signIn.data.user) {
      cached = mapUser(signIn.data.user);
      ensureListener();
      return {};
    }

    // First time for this email — create the Auth user (requires Confirm email OFF).
    const signUp = await sb.auth.signUp({
      email: trimmedEmail,
      password,
      options: {
        data: { name: trimmedEmail.split("@")[0] || "Host" },
      },
    });

    if (signUp.error) {
      return { error: signUp.error.message };
    }

    if (signUp.data.session?.user) {
      cached = mapUser(signUp.data.session.user);
      ensureListener();
      return {};
    }

    // Sign-up succeeded but no session — try password sign-in once more.
    const retry = await sb.auth.signInWithPassword({ email: trimmedEmail, password });
    if (retry.error) {
      return { error: retry.error.message || "Couldn’t sign in. Please try again." };
    }
    cached = mapUser(retry.data.user);
    ensureListener();
    return {};
  },
  async signOut() {
    const sb = requireSupabase();
    await sb.auth.signOut();
    cached = null;
  },
};
