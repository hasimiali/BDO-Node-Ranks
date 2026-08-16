/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/client/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        obsidian: "#090b10",
        panel: "#111827",
        brass: "#c99a45",
        jade: "#63d297"
      }
    }
  },
  plugins: []
};
