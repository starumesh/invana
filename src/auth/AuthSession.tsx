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
import { claimLocalDrafts } from "@/lib/drafts";
import { auth, isDemoMode, modeLabel } from "@/services";
import { supabaseAuth } from "@/services/supabase/auth";
import type { DemoUser } from "@/types";

type AuthSessionValue = {
  ready: boolean;
  user: DemoUser | null;
  isDemoMode: boolean;
  modeLabel: string;
  signedIn: boolean;
  signInWithEmailOtp: (email: string, otp: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthSessionContext = createContext<AuthSessionValue | null>(null);

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
      await supabaseAuth.ready();
      if (cancelled) return;
      setUser(auth.currentUser());
      setReady(true);

      const sb = getSupabase();
      if (!sb) return;
      const {
        data: { subscription },
      } = sb.auth.onAuthStateChange((event) => {
        setUser(auth.currentUser());
        if (event === "SIGNED_IN") {
          void claimLocalDrafts();
        }
      });
      unsub = () => subscription.unsubscribe();
    })();

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  const signInWithEmailOtp = useCallback(async (email: string, otp: string) => {
    if (isDemoMode) return { error: "Demo Mode does not use email sign-in." };
    const result = await supabaseAuth.signInWithEmailOtp(email, otp);
    if (!result.error) {
      setUser(auth.currentUser());
      // Await claim so /builder/:id can load the draft after navigate.
      try {
        await claimLocalDrafts();
      } catch {
        // Builder still falls back to local claim on load.
      }
    }
    return result;
  }, []);

  const signOut = useCallback(async () => {
    if (isDemoMode) return;
    await supabaseAuth.signOut();
    setUser(null);
  }, []);

  const value = useMemo<AuthSessionValue>(
    () => ({
      ready,
      user,
      isDemoMode,
      modeLabel: modeLabel(),
      signedIn: isDemoMode ? Boolean(user) : Boolean(user?.id && user.id !== "unauthenticated"),
      signInWithEmailOtp,
      signOut,
      refresh,
    }),
    [ready, user, signInWithEmailOtp, signOut, refresh],
  );

  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>;
}

export function useAuthSession() {
  const ctx = useContext(AuthSessionContext);
  if (!ctx) throw new Error("useAuthSession must be used within AuthSessionProvider");
  return ctx;
}
