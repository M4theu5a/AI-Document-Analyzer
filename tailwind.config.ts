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
        "doc-dark": "#09081A",
        "doc-purple": "#534AB7",
        "doc-purple-light": "#7F77DD",
      },
      boxShadow: {
        soft: "0 18px 60px rgba(23, 19, 41, 0.12)",
        "glow-purple": "0 0 20px rgba(127, 119, 221, 0.5)",
      },
      keyframes: {
        "float-slow": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(30px)" },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 20px rgba(127, 119, 221, 0.5)" },
          "50%": { boxShadow: "0 0 40px rgba(127, 119, 221, 0.8)" },
        },
      },
      animation: {
        "float-slow": "float-slow 6s ease-in-out infinite",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
