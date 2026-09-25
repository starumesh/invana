import type { AuthProvider } from "@/services/types";
import { requireSupabase } from "@/lib/supabase/client";
import type { DemoUser } from "@/types";
import type { AuthError, Session, User } from "@supabase/supabase-js";

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

function mapAuthError(error: AuthError | null | undefined, fallback: string): string {
  const msg = error?.message?.trim() || "";
  if (/email not confirmed/i.test(msg)) {
    return "Please confirm your email from your inbox, then sign in.";
  }
  if (/invalid login credentials/i.test(msg)) {
    return "Wrong email or password. Try again, or create a new account.";
  }
  if (/user already registered/i.test(msg)) {
    return "An account with this email already exists. Sign in instead.";
  }
  return msg || fallback;
}

let cached: DemoUser | null = null;
let listening = false;

function setCachedFromSession(session: Session | null | undefined) {
  cached = mapUser(session?.user);
}

function ensureListener() {
  if (listening) return;
  listening = true;
  const sb = requireSupabase();
  sb.auth.onAuthStateChange((_event, session) => {
    setCachedFromSession(session);
  });
}

/**
 * Connected Mode auth — email + password (Supabase Email provider).
 * Dashboard: Authentication → Providers → Email enabled.
 * For smooth first-time signup, turn OFF “Confirm email”.
 */
export const supabaseAuth: AuthProvider & {
  ready: () => Promise<DemoUser | null>;
  signInWithPassword: (email: string, password: string) => Promise<{ error?: string }>;
  signUpWithPassword: (email: string, password: string) => Promise<{ error?: string }>;
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
    setCachedFromSession(data.session);
    ensureListener();
    return cached;
  },
  async signInWithPassword(email: string, password: string) {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) return { error: "Enter an email." };
    if (!password) return { error: "Enter a password." };

    const sb = requireSupabase();
    ensureListener();
    const { data, error } = await sb.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });

    if (error) {
      return { error: mapAuthError(error, "Couldn’t sign in. Check your email and password.") };
    }

    setCachedFromSession(data.session);
    if (!cached) cached = mapUser(data.user);
    if (!cached) {
      // Session write can lag briefly — re-read storage.
      const { data: again } = await sb.auth.getSession();
      setCachedFromSession(again.session);
    }
    if (!cached) {
      return { error: "Signed in, but no session was returned. Try again in a moment." };
    }
    return {};
  },
  async signUpWithPassword(email: string, password: string) {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) return { error: "Enter an email." };
    if (password.length < 6) {
      return { error: "Password must be at least 6 characters." };
    }

    const sb = requireSupabase();
    ensureListener();
    const { data, error } = await sb.auth.signUp({
      email: trimmedEmail,
      password,
      options: {
        data: { name: trimmedEmail.split("@")[0] || "Host" },
      },
    });

    if (error) {
      return { error: mapAuthError(error, "Couldn’t create account.") };
    }

    if (data.session) {
      setCachedFromSession(data.session);
      return {};
    }

    // Confirm-email on: no session yet — try immediate password sign-in.
    const retry = await sb.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });
    if (retry.error) {
      return {
        error: "Account created. Confirm your email from your inbox, then sign in.",
      };
    }
    setCachedFromSession(retry.data.session);
    if (!cached) cached = mapUser(retry.data.user);
    return {};
  },
  async signOut() {
    const sb = requireSupabase();
    await sb.auth.signOut();
    cached = null;
  },
};
