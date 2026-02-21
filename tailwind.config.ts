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
        // Core Brand (Northwestern Maroon Theme)
        nu: {
          50: '#f9eaea',
          100: '#f0caca',
          200: '#e5a3a3',
          300: '#d57474',
          400: '#c64d4d',
          500: '#b02a2a', // Primary
          600: '#911f1f',
          700: '#7a1818',
          800: '#651717',
          900: '#531818',
          950: '#2b0909',
        },
        // Deep Dark Theme Backgrounds
        dark: {
          bg: '#0a0a0f',      // Near black (Main background)
          surface: '#12121a', // Dark navy (Cards, Sidebars)
          border: 'rgba(255,255,255,0.08)',
        },
        // Keep some of the old ones just in case they are hard-coded somewhere and we'll clean them up slowly
        nwu: {
          red: "#7b1113", // Deep Red / Maroon
          gold: "#FFD700", // Gold
        },
        primary: {
          DEFAULT: "#b02a2a", // Match nu-500
          foreground: "#FFFFFF",
        },
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
      boxShadow: {
        'glow-red': '0 0 20px -5px rgba(176, 42, 42, 0.4)',
        'glow-emerald': '0 0 20px -5px rgba(16, 185, 129, 0.4)',
        'glass-lift': '0 10px 40px -10px rgba(0,0,0,0.5)',
      },
      keyframes: {
        'gradient-x': {
          '0%, 100%': {
            'background-size': '200% 200%',
            'background-position': 'left center',
          },
          '50%': {
            'background-size': '200% 200%',
            'background-position': 'right center',
          },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'scale-in': {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(0.8)', opacity: '0.5' },
          '100%': { transform: 'scale(1.3)', opacity: '0' },
        },
        snowfall: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '20%': { opacity: '1' },
          '100%': { transform: 'translateY(50px)', opacity: '0' },
        }
      },
      animations: {
        'gradient-x': 'gradient-x 3s ease infinite',
        'float': 'float 6s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'slide-up': 'slide-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'scale-in': 'scale-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'pulse-ring': 'pulse-ring 2s cubic-bezier(0.215, 0.61, 0.355, 1) infinite',
        'snowfall': 'snowfall 2s linear infinite',
      },
    },
  },
  plugins: [],
};
export default config;
