import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "fp-green": "#0B1F3A",
        "fp-green-light": "#13294B",
        "fp-gold": "#C9793B",
        "fp-gold-light": "#D88945",
        "fp-purple": "#13294B",
        "fp-ink": "#0F172A",
        "fp-paper": "#F8FAFC",
        "fp-slate": "#64748B",
        "risk-low": "#1F8A5B",
        "risk-medium": "#C9793B",
        "risk-high": "#C23A3A",
      },
      fontFamily: {
        arabic: ["Inter", "IBM Plex Sans Arabic", "sans-serif"],
        "arabic-head": ["Inter", "IBM Plex Sans Arabic", "sans-serif"],
      },
      boxShadow: {
        card: "0 4px 14px rgba(11, 31, 58, 0.04)",
        "card-lg": "0 8px 24px rgba(11, 31, 58, 0.06)",
      },
      backgroundImage: {
        "gold-gradient":
          "linear-gradient(105deg, #0B1F3A 0%, #13294B 100%)",
        "green-gradient":
          "linear-gradient(135deg, #0B1F3A 0%, #13294B 100%)",
      },
    },
  },
  plugins: [],
};
export default config;
