/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#fff3e8",
          100: "#ffe0c7",
          500: "#ff7a1a",
          700: "#d85a00",
          900: "#7a2f00"
        }
      }
    }
  },
  plugins: []
};
