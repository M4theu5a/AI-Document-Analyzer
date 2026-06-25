"use client";

import { WarningCircleIcon as AlertCircle } from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-5 text-text">
      <section className="w-full max-w-[440px] rounded-panel border border-border bg-panel p-6 text-center shadow-card">
        <div
          className="mx-auto flex size-12 items-center justify-center rounded-[14px]"
          style={{
            background: "color-mix(in oklab, var(--danger) 10%, transparent)",
            color: "var(--danger)",
          }}
        >
          <AlertCircle className="size-6" />
        </div>
        <h1 className="mt-4 text-[20px] font-bold">Something went wrong</h1>
        <p className="mt-2 text-[13px] leading-6 text-text-muted">
          The workspace hit an unexpected error. You can retry without losing your session.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <button
            className="rounded-[10px] bg-accent px-4 py-2 text-[13px] font-semibold text-on-accent transition hover:opacity-90"
            onClick={reset}
            type="button"
          >
            Try again
          </button>
          <Link
            className="rounded-[10px] border border-border px-4 py-2 text-[13px] font-semibold text-text-muted transition hover:border-accent hover:text-accent"
            href="/"
          >
            Workspace
          </Link>
        </div>
      </section>
    </main>
  );
}
