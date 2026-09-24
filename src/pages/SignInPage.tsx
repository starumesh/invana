import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuthSession } from "@/auth/AuthSession";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";

export function SignInPage() {
  const { isDemoMode, signedIn, ready, signInWithEmailOtp } = useAuthSession();
  const navigate = useNavigate();
  const location = useLocation();
  const from =
    (location.state as { from?: string } | null)?.from &&
    typeof (location.state as { from?: string }).from === "string"
      ? (location.state as { from: string }).from
      : "/dashboard";

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [message, setMessage] = useState("");

  if (ready && isDemoMode) {
    return <Navigate to="/dashboard" replace />;
  }

  if (ready && signedIn) {
    return <Navigate to={from} replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setMessage("");
    const result = await signInWithEmailOtp(email, otp);
    if (result.error) {
      setStatus("error");
      setMessage(result.error);
      return;
    }
    navigate(from, { replace: true });
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-16">
      <h1 className="font-serif text-4xl">Sign in</h1>
      <p className="mt-3 text-ink-muted">
        Enter your email and the one-time code to continue — then you can download your invitation.
      </p>

      <form onSubmit={(e) => void onSubmit(e)} className="mt-8 space-y-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={status === "submitting"}
          />
        </div>
        <div>
          <Label htmlFor="otp">One-time code</Label>
          <Input
            id="otp"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            placeholder="Enter code"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            disabled={status === "submitting"}
          />
        </div>
        <Button type="submit" variant="gold" className="w-full" disabled={status === "submitting"}>
          {status === "submitting" ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      {message ? (
        <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800">{message}</p>
      ) : null}

      <p className="mt-8 text-center text-sm text-ink-muted">
        <Link to="/" className="underline hover:text-ink">
          Back home
        </Link>
      </p>
    </main>
  );
}
