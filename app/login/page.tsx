"use client";

import { FileMagnifyingGlassIcon as BrandMark } from "@phosphor-icons/react";
import { useEffect } from "react";
import { AuthForm } from "@/components/AuthForm";

const THEME_STORAGE_KEY = "diw:theme";

export default function LoginPage() {
  // Apply the saved theme so the auth screen matches the workspace.
  useEffect(() => {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    const dark =
      saved === "dark" ||
      (!saved && window.matchMedia?.("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", Boolean(dark));
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg text-text" style={{ padding: "24px" }}>
      <div className="w-full max-w-[420px]">
        <div className="flex items-center justify-center gap-2.5">
          <div className="size-[34px] shrink-0 flex items-center justify-center rounded-[10px] bg-accent">
            <BrandMark className="size-[17px] text-on-accent" />
          </div>
          <div>
            <p className="text-[15px] font-bold text-text leading-snug">Document Intelligence</p>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
              Workspace
            </p>
          </div>
        </div>

        <div className="mt-7">
          <AuthForm onSuccess={() => { window.location.href = "/"; }} />
        </div>
      </div>
    </div>
  );
}
