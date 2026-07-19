/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#070707",
        surface: "#101010",
        card: "#161616",
        hover: "#1C1C1C",
        accent: "#57E389", // Spotify Green
        danger: "#FF5F57",
        warning: "#FFB020",
        blue: "#5B8CFF",
        secondaryText: "#8A8A8A",
      },
      borderColor: {
        DEFAULT: "rgba(255,255,255,0.06)",
      },
      fontFamily: {
        sans: ["Inter", "Geist", "sans-serif"],
      },
    },
  },
  plugins: [],
}
