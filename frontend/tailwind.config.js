/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f7fc',
          100: '#e0f2fe',
          200: '#fbcfe8',
          300: '#eed47d',
          400: '#f472b6',
          500: '#ec4899',
          600: '#db2777',
          700: '#0284c7',
          800: '#0369a1',
          900: '#0f172a',
          primary: '#0284c7',
          secondary: '#ec4899',
          dark: '#1e293b',
        }
      }
    },
  },
  plugins: [],
}
