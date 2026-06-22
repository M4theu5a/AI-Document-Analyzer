import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        panel: "var(--panel)",
        inset: "var(--inset)",
        sidebar: "var(--sidebar)",
        border: "var(--border)",
        text: "var(--text)",
        "text-muted": "var(--text-muted)",
        muted: "var(--muted)",
        accent: "var(--accent)",
        "on-accent": "var(--on-accent)",
        danger: "var(--danger)",
        gold: "var(--gold)",
        ok: "var(--ok)",
        calm: "var(--calm)",
      },
      borderRadius: {
        panel: "var(--radius)",
      },
      fontFamily: {
        sans: ["var(--font-hanken)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        card: "var(--shadow-card)",
      },
    },
  },
  plugins: [],
};

export default config;
