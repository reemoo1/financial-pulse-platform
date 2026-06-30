import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "fp-green": "#0B3D2E",
        "fp-green-light": "#13573F",
        "fp-gold": "#C9A227",
        "fp-gold-light": "#E0C158",
        "fp-ink": "#0F1115",
        "fp-paper": "#FAFAF8",
        "fp-slate": "#5B6470",
        "risk-low": "#1E8E5A",
        "risk-medium": "#D9A441",
        "risk-high": "#C1462F",
      },
      fontFamily: {
        arabic: ["var(--font-tajawal)", "Tajawal", "sans-serif"],
        "arabic-head": ["var(--font-kufi)", "Noto Kufi Arabic", "sans-serif"],
      },
      boxShadow: {
        card: "0 4px 24px rgba(11, 61, 46, 0.08)",
        "card-lg": "0 12px 40px rgba(11, 61, 46, 0.12)",
      },
      backgroundImage: {
        "gold-gradient": "linear-gradient(135deg, #C9A227 0%, #E0C158 100%)",
        "green-gradient": "linear-gradient(135deg, #0B3D2E 0%, #13573F 100%)",
      },
    },
  },
  plugins: [],
};
export default config;
