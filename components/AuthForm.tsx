"use client";

import {
  WarningCircleIcon as AlertCircle,
  ArrowRightIcon as ArrowRight,
  CircleNotchIcon as Loader2,
  XIcon as X,
} from "@phosphor-icons/react";
import { FormEvent, useState } from "react";

export type AuthUser = { id: string; name: string | null; email: string };

type AuthMode = "login" | "register";

export function AuthForm({
  onSuccess,
  onClose,
  initialMode = "login",
}: {
  onSuccess: (user: AuthUser) => void;
  onClose?: () => void;
  initialMode?: AuthMode;
}) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const isRegister = mode === "register";

  function switchMode(next: AuthMode) {
    setMode(next);
    setError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    setError("");
    setIsSubmitting(true);
    try {
      const endpoint = isRegister ? "/api/auth/register" : "/api/auth/login";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isRegister ? { name, email, password } : { email, password }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        user?: AuthUser;
        error?: string;
      };
      if (!response.ok || !payload.user) {
        setError(payload.error || "Could not continue. Please try again.");
        return;
      }
      onSuccess(payload.user);
    } catch {
      setError("Connection failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="relative bg-panel rounded-panel border border-border shadow-card" style={{ padding: "var(--pad)" }}>
      {onClose && (
        <button
          className="absolute right-3 top-3 rounded-[8px] p-1.5 text-muted transition hover:bg-inset hover:text-text"
          onClick={onClose}
          type="button"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>
      )}

      <h1 className="text-[20px] font-bold text-text tracking-[-0.01em]">
        {isRegister ? "Create account" : "Sign in"}
      </h1>
      <p className="mt-1 text-[13px] text-text-muted">
        {isRegister
          ? "Create your account to start analyzing documents."
          : "Access your document analysis workspace."}
      </p>

      <form className="mt-6 space-y-3.5" onSubmit={handleSubmit}>
        {isRegister && (
          <Field label="Name">
            <input
              className={inputClass}
              autoComplete="name"
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              required
              value={name}
            />
          </Field>
        )}
        <Field label="Email">
          <input
            className={inputClass}
            autoComplete="email"
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            type="email"
            value={email}
          />
        </Field>
        <Field label="Password">
          <input
            className={inputClass}
            autoComplete={isRegister ? "new-password" : "current-password"}
            minLength={isRegister ? 8 : undefined}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={isRegister ? "At least 8 characters" : "••••••••"}
            required
            type="password"
            value={password}
          />
        </Field>

        {error && (
          <div
            className="flex gap-2 rounded-[11px] border p-3 text-[13px]"
            style={{
              borderColor: "color-mix(in oklab, var(--danger) 30%, transparent)",
              background: "color-mix(in oklab, var(--danger) 8%, transparent)",
              color: "var(--danger)",
            }}
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <button
          className="w-full flex items-center justify-center gap-2 rounded-[12px] bg-accent text-on-accent text-[13.5px] font-semibold transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ height: "44px" }}
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <>
              {isRegister ? "Create account" : "Sign in"}
              <ArrowRight className="size-4" />
            </>
          )}
        </button>
      </form>

      <p className="mt-4 text-center text-[12.5px] text-muted">
        {isRegister ? "Already have an account? " : "Don't have an account? "}
        <button
          className="font-semibold text-accent hover:underline"
          onClick={() => switchMode(isRegister ? "login" : "register")}
          type="button"
        >
          {isRegister ? "Sign in" : "Create account"}
        </button>
      </p>
    </div>
  );
}

const inputClass =
  "w-full h-[40px] rounded-[10px] bg-inset border border-border px-3.5 text-[13.5px] text-text placeholder:text-muted outline-none transition focus:border-accent";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted">
        {label}
      </span>
      {children}
    </label>
  );
}
