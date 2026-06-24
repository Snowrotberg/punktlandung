import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./hooks/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      boxShadow: {
        neon: "0 0 24px rgba(99, 102, 241, 0.55)",
        good: "0 0 24px rgba(52, 211, 153, 0.4)",
        bad: "0 0 24px rgba(244, 63, 94, 0.4)"
      },
      fontFamily: {
        display: ["Impact", "Arial Black", "Inter", "system-ui", "sans-serif"]
      },
      borderWidth: {
        "3": "2px"
      }
    }
  },
  plugins: []
};

export default config;
