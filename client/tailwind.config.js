/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    fontFamily: {
        // Inter first, then excellent system fallbacks
        sans: ["Inter", "ui-sans-serif", "system-ui", "Segoe UI",
               "Roboto", "Helvetica Neue", "Arial", "Noto Sans",
               "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"]
    },
    extend: {
      colors: {
        brand: {
          DEFAULT: "#002e5a",
          50:  "#e6ecf3",
          100: "#cdd9e7",
          200: "#9bb3cf",
          300: "#6a8db8",
          400: "#3967a1",
          500: "#0d477f",
          600: "#0a3a66",
          700: "#082d4d",
          800: "#062134",
          900: "#04161f"
        }
      },
      boxShadow: {
        smooth: "0 10px 30px rgba(2,12,27,.08)"
      },
      borderRadius: {
        xl2: "1rem"
      }
    }
  },
  plugins: []
}
