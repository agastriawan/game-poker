import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        felt: {
          DEFAULT: "#0b3b24",
          dark: "#062315",
          light: "#125435",
          accent: "#1a7549",
        },
        gold: {
          DEFAULT: "#f59e0b",
          light: "#fbbf24",
          dark: "#b45309",
        },
      },
      keyframes: {
        cardPop: {
          "0%": { transform: "scale(0.8) translateY(20px)", opacity: "0" },
          "100%": { transform: "scale(1) translateY(0)", opacity: "1" },
        },
        bombShake: {
          "0%, 100%": { transform: "translateX(0)" },
          "20%, 60%": { transform: "translateX(-8px) rotate(-2deg)" },
          "40%, 80%": { transform: "translateX(8px) rotate(2deg)" },
        },
      },
      animation: {
        "card-pop": "cardPop 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "bomb-shake": "bombShake 0.45s ease-in-out",
      },
    },
  },
  plugins: [],
};

export default config;

