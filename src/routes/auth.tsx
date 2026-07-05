import { createFileRoute, useRouter, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Repurpose" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Honeypot: real users never see/fill this. Bots blindly fill every input.
  const [website, setWebsite] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    if (website) {
      // Silent reject — no toast, no a11y announcement. The bot sees a no-op.
      return;
    }
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/app" },
        });
        if (error) throw error;
        if (!data.session) {
          toast.success("Check your email to confirm your account.");
          return;
        }
        toast.success("Account created. Redirecting…");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      router.navigate({ to: "/app" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  const [googleLoading, setGoogleLoading] = useState(false);
  async function handleGoogle() {
    if (googleLoading) return;
    setGoogleLoading(true);
    try {
      // `redirect_uri` MUST be a public same-origin URL, not a protected route.
      // After the session hydrates, the `_authenticated` gate or our own
      // navigate sends them on to `/app`.
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin + "/auth",
      });
      if (result.error) {
        toast.error(result.error.message || "Google sign-in failed");
        return;
      }
      if (result.redirected) return;
      router.navigate({ to: "/app" });
    } finally {
      setGoogleLoading(false);
    }
  }

  const isSignup = mode === "signup";

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div aria-hidden="true" className="absolute inset-0 bg-grid" />
      <div aria-hidden="true" className="absolute inset-0 bg-aurora opacity-70" />
      <div className="relative w-full max-w-md animate-fade-up">
        <Link
          to="/"
          className="mx-auto mb-8 flex w-fit items-center gap-2.5 rounded-md font-display text-2xl font-semibold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <span
            className="grid h-9 w-9 place-items-center rounded-xl text-primary-foreground shadow-glow animate-pulse-ring"
            style={{ background: "var(--gradient-primary)" }}
            aria-hidden="true"
          >
            <span className="text-sm font-bold">R</span>
          </span>
          Repurpose
        </Link>
        <div className="animate-fade-up stagger-1 rounded-2xl border border-border/60 bg-card/80 p-6 shadow-elegant backdrop-blur-xl sm:p-8">

          <h1 className="mb-1 font-serif text-2xl tracking-tight">
            {isSignup ? "Create account" : "Welcome back"}
          </h1>
          <p className="mb-6 text-sm text-muted-foreground">
            {isSignup ? "Start repurposing in under a minute." : "Sign in to your library."}
          </p>

          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-full"
            onClick={handleGoogle}
            disabled={googleLoading || loading}
            aria-busy={googleLoading}
          >
            {googleLoading ? "Opening Google…" : "Continue with Google"}
          </Button>
          <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            <span aria-hidden="true">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleEmail} className="space-y-4" aria-busy={loading}>
            {/* Honeypot — hidden from real users, attractive to bots. */}
            <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden" tabIndex={-1}>
              <label htmlFor="website">Website</label>
              <input
                id="website"
                name="website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="min-h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete={isSignup ? "new-password" : "current-password"}
                required
                minLength={isSignup ? 8 : 6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-describedby={isSignup ? "password-hint" : undefined}
                className="min-h-11"
              />
              {isSignup && (
                <p id="password-hint" className="text-xs text-muted-foreground">
                  Minimum 8 characters.
                </p>
              )}
            </div>
            <Button
              type="submit"
              className="min-h-11 w-full shadow-sm"
              disabled={loading}
            >
              {loading ? "Please wait…" : isSignup ? "Create account" : "Sign in"}
            </Button>
          </form>

          <button
            type="button"
            onClick={() => {
              setMode(isSignup ? "signin" : "signup");
              setPassword("");
            }}
            className="mt-5 w-full rounded-md py-2 text-center text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {isSignup ? "Have an account? Sign in" : "New here? Create an account"}
          </button>
        </div>
      </div>
    </main>
  );
}
