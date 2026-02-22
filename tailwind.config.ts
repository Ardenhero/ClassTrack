import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        udemy: {
          indigo: "#2D2F31", // Deep Indigo
          purple: "#A435F0", // Vibrant Purple
        },
        nwu: {
          red: "#7b1113", // Deep Red / Maroon
          gold: "#FFD700", // Gold
        },
        primary: {
          DEFAULT: "#A435F0",
          foreground: "#FFFFFF",
        },
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
    },
  },
  plugins: [],
};
export default config;
