import { useLocation, useNavigate } from "react-router-dom";
import { useAuthSession } from "@/auth/AuthSession";
import { isDemoMode, isSignInRequired } from "@/services";

type GateOptions = {
  /**
   * `download` — respects `VITE_REQUIRE_SIGN_IN` (default true).
   * `account` — always requires sign-in in Connected Mode (Publish / Share).
   */
  mode?: "download" | "account";
  /** Flush draft / pending work before leaving for /signin (Connected guests). */
  beforeRedirect?: () => void | Promise<void>;
};

/**
 * Gates sensitive actions in Connected Mode.
 * - Download: config via `VITE_REQUIRE_SIGN_IN`
 * - Publish / Share: always require an account
 * Demo Mode never gates.
 */
export function useRequireSignIn() {
  const { signedIn } = useAuthSession();
  const navigate = useNavigate();
  const location = useLocation();

  return function allowSignedInAction(options?: GateOptions): boolean {
    const mode = options?.mode ?? "download";
    const needsAuth =
      mode === "account" ? !isDemoMode : isSignInRequired();

    if (!needsAuth || signedIn) return true;

    const from = `${location.pathname}${location.search}${location.hash}`;
    const go = () => {
      navigate("/signin", { state: { from } });
    };
    const prep = options?.beforeRedirect?.();
    if (prep != null && typeof (prep as Promise<void>).then === "function") {
      void Promise.resolve(prep).finally(go);
    } else {
      go();
    }
    return false;
  };
}
