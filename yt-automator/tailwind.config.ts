import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: [
    "./src/**/*.{ts,tsx}",
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        insta: {
          primary: "#E1306C",
          secondary: "#FD1F1F",
          accent: "#A855F7",
          background: "#F0F2F5",
          text: "#262626",
          card: "#FFFFFF",
          muted: "#6E767A",
          success: "#3FBB85",
          warning: "#F8AA2A",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;