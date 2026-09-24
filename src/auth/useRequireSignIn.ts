import { useLocation, useNavigate } from "react-router-dom";
import { useAuthSession } from "@/auth/AuthSession";
import { isSignInRequired } from "@/services";

type GateOptions = {
  /** Flush draft / pending work before leaving for /signin (Connected guests). */
  beforeRedirect?: () => void | Promise<void>;
};

/**
 * Gates Download / Publish / Share when Connected Mode requires sign-in.
 * Respects `VITE_REQUIRE_SIGN_IN` (default true). Demo Mode never gates.
 * Preserves return path via location state `from`.
 */
export function useRequireSignIn() {
  const { signedIn } = useAuthSession();
  const navigate = useNavigate();
  const location = useLocation();

  return function allowSignedInAction(options?: GateOptions): boolean {
    if (!isSignInRequired() || signedIn) return true;
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
