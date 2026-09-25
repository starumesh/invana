import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuthSession } from "@/auth/AuthSession";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";

type Mode = "signin" | "signup";

export function SignInPage() {
  const { isDemoMode, signedIn, ready, signInWithPassword, signUpWithPassword } = useAuthSession();
  const navigate = useNavigate();
  const location = useLocation();
  const from =
    (location.state as { from?: string } | null)?.from &&
    typeof (location.state as { from?: string }).from === "string"
      ? (location.state as { from: string }).from
      : "/dashboard";

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
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

    try {
      if (mode === "signup") {
        if (password !== confirm) {
          setStatus("error");
          setMessage("Passwords don’t match.");
          return;
        }
        const result = await signUpWithPassword(email, password);
        if (result.error) {
          setStatus("error");
          setMessage(result.error);
          return;
        }
        navigate(from, { replace: true });
        return;
      }

      const result = await signInWithPassword(email, password);
      if (result.error) {
        setStatus("error");
        setMessage(result.error);
        return;
      }
      navigate(from, { replace: true });
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setStatus((prev) => (prev === "submitting" ? "idle" : prev));
    }
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-16">
      <h1 className="font-serif text-4xl">{mode === "signin" ? "Sign in" : "Create account"}</h1>
      <p className="mt-3 text-ink-muted">
        {mode === "signin"
          ? "Use your email and password to publish, share, and manage your events."
          : "Create an account with email and password — then you can publish and share."}
      </p>

      <div className="mt-6 inline-flex rounded-full border border-stone-200 bg-white p-1">
        <button
          type="button"
          className={
            mode === "signin"
              ? "rounded-full bg-ink px-4 py-1.5 text-sm text-cream"
              : "rounded-full px-4 py-1.5 text-sm text-ink-muted hover:text-ink"
          }
          onClick={() => {
            setMode("signin");
            setMessage("");
            setStatus("idle");
          }}
        >
          Sign in
        </button>
        <button
          type="button"
          className={
            mode === "signup"
              ? "rounded-full bg-ink px-4 py-1.5 text-sm text-cream"
              : "rounded-full px-4 py-1.5 text-sm text-ink-muted hover:text-ink"
          }
          onClick={() => {
            setMode("signup");
            setMessage("");
            setStatus("idle");
          }}
        >
          Create account
        </button>
      </div>

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
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            required
            minLength={6}
            placeholder={mode === "signup" ? "At least 6 characters" : "Your password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={status === "submitting"}
          />
        </div>
        {mode === "signup" ? (
          <div>
            <Label htmlFor="confirm">Confirm password</Label>
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              placeholder="Repeat password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              disabled={status === "submitting"}
            />
          </div>
        ) : null}
        <Button type="submit" variant="gold" className="w-full" disabled={status === "submitting"}>
          {status === "submitting"
            ? mode === "signin"
              ? "Signing in…"
              : "Creating account…"
            : mode === "signin"
              ? "Sign in"
              : "Create account"}
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
