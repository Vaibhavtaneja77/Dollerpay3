import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#050505",
        paper: "#fbfbfa",
        muted: "#71717a",
        line: "#e4e4e7",
        success: "#107c41",
        warning: "#a16207",
        danger: "#b91c1c"
      },
      boxShadow: {
        soft: "0 18px 50px rgba(0,0,0,.08)"
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(.98)" },
          "100%": { opacity: "1", transform: "scale(1)" }
        },
        "slide-in": {
          "0%": { opacity: "0", transform: "translateX(8px)" },
          "100%": { opacity: "1", transform: "translateX(0)" }
        }
      },
      animation: {
        "fade-up": "fade-up .22s ease-out both",
        "scale-in": "scale-in .18s ease-out both",
        "slide-in": "slide-in .2s ease-out both"
      }
    }
  },
  plugins: []
};

export default config;
