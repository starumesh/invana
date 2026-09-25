import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getSupabase } from "@/lib/supabase/client";
import { onAccountSignedIn, onAccountSignedOut } from "@/api/events";
import { auth, isDemoMode, modeLabel } from "@/services";
import { supabaseAuth } from "@/services/supabase/auth";
import type { DemoUser } from "@/types";

type AuthSessionValue = {
  ready: boolean;
  user: DemoUser | null;
  isDemoMode: boolean;
  modeLabel: string;
  signedIn: boolean;
  signInWithPassword: (email: string, password: string) => Promise<{ error?: string }>;
  signUpWithPassword: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthSessionContext = createContext<AuthSessionValue | null>(null);

function mapDemoUser(user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> } | null): DemoUser | null {
  if (!user) return null;
  const metaName = user.user_metadata?.name;
  const name =
    (typeof metaName === "string" && metaName) || user.email?.split("@")[0] || "Host";
  return {
    id: user.id,
    email: user.email ?? "",
    name,
  };
}

function kickOffClaim() {
  onAccountSignedIn();
}

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<DemoUser | null>(null);

  const refresh = useCallback(async () => {
    if (isDemoMode) {
      setUser(auth.ensureUser());
      return;
    }
    const next = await supabaseAuth.ready();
    setUser(next);
  }, []);

  useEffect(() => {
    if (isDemoMode) {
      setUser(auth.ensureUser());
      setReady(true);
      return;
    }

    let unsub: (() => void) | undefined;
    let cancelled = false;

    void (async () => {
      const next = await supabaseAuth.ready();
      if (cancelled) return;
      setUser(next);
      // Unblock the app immediately — do not await claim/sync.
      if (!cancelled) setReady(true);

      if (next?.id) {
        kickOffClaim();
      } else {
        onAccountSignedOut();
      }

      const sb = getSupabase();
      if (!sb) return;
      const {
        data: { subscription },
      } = sb.auth.onAuthStateChange((event, session) => {
        // Prefer the session from the event — don't rely on a separate cache race.
        setUser(session?.user ? mapDemoUser(session.user) : null);
        if (event === "SIGNED_IN") {
          kickOffClaim();
        }
        if (event === "SIGNED_OUT") {
          onAccountSignedOut();
        }
      });
      unsub = () => subscription.unsubscribe();
    })();

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  const afterAuthSuccess = useCallback(async () => {
    const next = await supabaseAuth.ready();
    setUser(next);
    // Claim in background so login navigation is not blocked on upserts.
    kickOffClaim();
  }, []);

  const signInWithPassword = useCallback(
    async (email: string, password: string) => {
      if (isDemoMode) return { error: "Demo Mode does not use email sign-in." };
      const result = await supabaseAuth.signInWithPassword(email, password);
      if (!result.error) await afterAuthSuccess();
      return result;
    },
    [afterAuthSuccess],
  );

  const signUpWithPassword = useCallback(
    async (email: string, password: string) => {
      if (isDemoMode) return { error: "Demo Mode does not use email sign-in." };
      const result = await supabaseAuth.signUpWithPassword(email, password);
      if (!result.error) await afterAuthSuccess();
      return result;
    },
    [afterAuthSuccess],
  );

  const signOut = useCallback(async () => {
    if (isDemoMode) return;
    await supabaseAuth.signOut();
    setUser(null);
    onAccountSignedOut();
  }, []);

  const value = useMemo<AuthSessionValue>(
    () => ({
      ready,
      user,
      isDemoMode,
      modeLabel: modeLabel(),
      signedIn: isDemoMode ? Boolean(user) : Boolean(user?.id && user.id !== "unauthenticated"),
      signInWithPassword,
      signUpWithPassword,
      signOut,
      refresh,
    }),
    [ready, user, signInWithPassword, signUpWithPassword, signOut, refresh],
  );

  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>;
}

export function useAuthSession() {
  const ctx = useContext(AuthSessionContext);
  if (!ctx) throw new Error("useAuthSession must be used within AuthSessionProvider");
  return ctx;
}
