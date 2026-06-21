import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#171329",
        xen: {
          purple: "#2a1f5a",
          indigo: "#4f46e5",
          rose: "#ee87cb",
          gold: "#fff1be",
        },
      },
      boxShadow: {
        soft: "0 18px 60px rgba(23, 19, 41, 0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
