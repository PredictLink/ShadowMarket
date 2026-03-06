import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        shadow: {
          "900": "#0a0a0f",
          "800": "#111118",
          "700": "#1a1a2e",
          accent: "#7c3aed",
          glow: "#a855f7",
        },
      },
      fontFamily: {
        gothic: ["Georgia", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;
