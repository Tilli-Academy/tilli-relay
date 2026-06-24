"use client";

import { useState, useEffect, useMemo, FormEvent } from "react";
import { api, getApiBase, setSessionToken } from "@/lib/apiBase";
import { LOGO_SRC } from "@/lib/logo";
import { useThemeProvider, ThemeCtx } from "@/hooks/useTheme";

function PasswordRules({ password }: { password: string }) {
  const rules = useMemo(() => [
    { label: "8+ characters", met: password.length >= 8 },
    { label: "Uppercase letter", met: /[A-Z]/.test(password) },
    { label: "Lowercase letter", met: /[a-z]/.test(password) },
    { label: "Number", met: /[0-9]/.test(password) },
    { label: "Symbol (!@#$%...)", met: /[^A-Za-z0-9]/.test(password) },
  ], [password]);

  if (!password) return null;

  const metCount = rules.filter((r) => r.met).length;

  return (
    <div data-testid="password-strength" className="mt-3 space-y-1.5">
      <div className="flex gap-1">
        {rules.map((rule, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              rule.met ? "bg-emerald-500" : "bg-border-primary"
            }`}
          />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        {rules.map((rule) => (
          <div key={rule.label} className="flex items-center gap-1.5 text-[11px]">
            <svg
              width={12}
              height={12}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`shrink-0 transition-colors ${rule.met ? "text-emerald-500" : "text-content-faint"}`}
            >
              {rule.met ? (
                <polyline points="20 6 9 17 4 12" />
              ) : (
                <circle cx="12" cy="12" r="6" />
              )}
            </svg>
            <span className={`transition-colors ${rule.met ? "text-emerald-400" : "text-content-dim"}`}>
              {rule.label}
            </span>
          </div>
        ))}
      </div>
      <p className={`text-[10px] transition-colors ${metCount === 5 ? "text-emerald-500" : "text-content-dim"}`}>
        {metCount === 5 ? "Strong password" : `${metCount}/5 requirements met`}
      </p>
    </div>
  );
}

function LoginForm() {
  const prefix = process.env.NEXT_PUBLIC_ASSET_PREFIX || "";
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState<string | null>(null);

  // Read search params client-side (avoids Suspense/SSR bailout)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("mode") === "signup") setMode("signup");
    if (params.get("error")) setError(params.get("error") || "");
  }, []);
  const [loading, setLoading] = useState(false);
  const [signupPassword, setSignupPassword] = useState("");

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setErrorCode(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const email = (form.get("email") as string || "").trim();
    const password = form.get("password") as string || "";

    if (!email || !password) {
      setError("Email and password are required");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(api("/api/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.sessionToken) setSessionToken(data.sessionToken);
        window.location.href = getApiBase() + "/";
      } else {
        setError(data.error || "Login failed");
        setErrorCode(data.code || null);
      }
    } catch {
      setError("Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const email = (form.get("email") as string || "").trim();
    const password = form.get("password") as string || "";
    const confirmPassword = form.get("confirmPassword") as string || "";

    if (!email || !password) {
      setError("Email and password are required");
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(api("/api/auth/signup"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.sessionToken) setSessionToken(data.sessionToken);
        window.location.href = getApiBase() + "/";
      } else {
        setError(data.error || "Signup failed");
      }
    } catch {
      setError("Signup failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full rounded-[10px] border border-border-primary bg-surface-secondary px-3.5 py-2.5 text-sm text-content-primary placeholder-content-muted transition-all focus:border-tilli focus:outline-none focus:ring-2 focus:ring-tilli-glow";

  return (
    <div className="w-full max-w-[420px]">
      {/* Logo */}
      <div className="mb-8 text-center">
        <img src={LOGO_SRC} alt="Tilli LLC" className="mx-auto mb-4 h-16 w-16 rounded-2xl object-contain bg-white shadow-lg shadow-tilli/10" />
        <h1 className="text-2xl font-bold tracking-tight text-content-primary">Relay</h1>
        <p className="mt-1.5 text-sm text-content-muted">curl-first API development tool</p>
      </div>

      {/* Card */}
      <div className="rounded-2xl border border-border-secondary bg-surface-primary p-8 shadow-2xl">
        {/* Toggle */}
        <div className="mb-6 flex rounded-[10px] bg-surface-secondary p-1">
          <button
            data-testid="auth-mode-login"
            type="button"
            onClick={() => { setMode("login"); setError(""); setErrorCode(null); setSignupPassword(""); }}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${
              mode === "login"
                ? "tilli-gradient text-white shadow-md shadow-tilli/25"
                : "text-content-muted hover:text-content-secondary"
            }`}
          >
            Log in
          </button>
          <button
            data-testid="auth-mode-signup"
            type="button"
            onClick={() => { setMode("signup"); setError(""); setErrorCode(null); setSignupPassword(""); }}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${
              mode === "signup"
                ? "tilli-gradient text-white shadow-md shadow-tilli/25"
                : "text-content-muted hover:text-content-secondary"
            }`}
          >
            Sign up
          </button>
        </div>

        {/* Login Form */}
        {mode === "login" && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="login-email" className="mb-1.5 block text-xs font-medium text-content-tertiary">
                Email
              </label>
              <input
                id="login-email"
                data-testid="login-email"
                name="email"
                type="email"
                required
                autoComplete="email"
                className={inputClass}
                placeholder="you@company.com"
              />
            </div>
            <div>
              <label htmlFor="login-password" className="mb-1.5 block text-xs font-medium text-content-tertiary">
                Password
              </label>
              <input
                id="login-password"
                data-testid="login-password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className={inputClass}
                placeholder="Enter your password"
              />
            </div>

            {error && (
              <div data-testid="login-error" className="rounded-[10px] border border-status-error-text/30 bg-status-error-bg px-4 py-3">
                <div className="flex items-start gap-2.5">
                  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0 text-status-error-text">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <div>
                    <p className="text-xs font-medium text-status-error-text">{error}</p>
                    {errorCode === "USER_NOT_FOUND" && (
                      <button
                        type="button"
                        onClick={() => { setMode("signup"); setError(""); setErrorCode(null); setSignupPassword(""); }}
                        className="mt-2 inline-flex items-center gap-1 rounded-lg bg-tilli/15 px-3 py-1.5 text-[11px] font-medium text-tilli-light transition-colors hover:bg-tilli/25"
                      >
                        Create an account
                        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <line x1="5" y1="12" x2="19" y2="12" />
                          <polyline points="12 5 19 12 12 19" />
                        </svg>
                      </button>
                    )}
                    {errorCode === "WRONG_PASSWORD" && (
                      <p className="mt-1 text-[11px] text-content-muted">
                        Check your password and try again.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <button
              data-testid="login-submit"
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-[10px] tilli-gradient py-2.5 text-sm font-semibold text-white shadow-lg shadow-tilli/20 transition-all hover:shadow-xl hover:shadow-tilli/30 hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-lg"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Logging in...
                </span>
              ) : "Log in"}
            </button>
          </form>
        )}

        {/* Signup Form */}
        {mode === "signup" && (
          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label htmlFor="signup-email" className="mb-1.5 block text-xs font-medium text-content-tertiary">
                Email
              </label>
              <input
                id="signup-email"
                data-testid="signup-email"
                name="email"
                type="email"
                required
                autoComplete="email"
                className={inputClass}
                placeholder="you@company.com"
              />
            </div>
            <div>
              <label htmlFor="signup-password" className="mb-1.5 block text-xs font-medium text-content-tertiary">
                Password
              </label>
              <input
                id="signup-password"
                data-testid="signup-password"
                name="password"
                type="password"
                required
                autoComplete="new-password"
                value={signupPassword}
                onChange={(e) => setSignupPassword(e.target.value)}
                className={inputClass}
                placeholder="Create a strong password"
              />
              <PasswordRules password={signupPassword} />
            </div>
            <div>
              <label htmlFor="signup-confirm" className="mb-1.5 block text-xs font-medium text-content-tertiary">
                Confirm Password
              </label>
              <input
                id="signup-confirm"
                data-testid="signup-confirm-password"
                name="confirmPassword"
                type="password"
                required
                autoComplete="new-password"
                className={inputClass}
                placeholder="Re-enter your password"
              />
            </div>

            {error && (
              <div data-testid="signup-error" className="rounded-[10px] border border-status-error-text/30 bg-status-error-bg px-4 py-3">
                <div className="flex items-start gap-2.5">
                  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0 text-status-error-text">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <p className="text-xs font-medium text-status-error-text">{error}</p>
                </div>
              </div>
            )}

            <button
              data-testid="signup-submit"
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-[10px] tilli-gradient py-2.5 text-sm font-semibold text-white shadow-lg shadow-tilli/20 transition-all hover:shadow-xl hover:shadow-tilli/30 hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-lg"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Creating account...
                </span>
              ) : "Create account"}
            </button>
          </form>
        )}
      </div>

      {/* Footer */}
      <p className="mt-6 text-center text-[11px] text-content-dim">
        Powered by <span className="text-content-muted">Tilli LLC</span>
      </p>
    </div>
  );
}

export default function LoginPage() {
  const themeCtx = useThemeProvider();

  return (
    <ThemeCtx.Provider value={themeCtx}>
      <div className="flex min-h-screen items-center justify-center bg-surface-base px-4">
        <LoginForm />
      </div>
    </ThemeCtx.Provider>
  );
}
