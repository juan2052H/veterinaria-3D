/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#effefa', 100: '#c8fff1', 200: '#91fee4', 300: '#53f5d4', 400: '#20e0bf',
          500: '#08c4a6', 600: '#039e88', 700: '#087e6f', 800: '#0c645a', 900: '#0f534b', 950: '#01332f',
        },
        ink: {
          50: '#f6f7f9', 100: '#eceef2', 200: '#d5d9e2', 300: '#b0b8c9', 400: '#8592ab', 500: '#667491',
          600: '#515d78', 700: '#424b62', 800: '#2a3040', 850: '#1f2431', 900: '#171b25', 950: '#0e1118',
        },
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'] },
      keyframes: { fadein: { from: { opacity: 0, transform: 'translateY(4px)' }, to: { opacity: 1, transform: 'none' } } },
      animation: { fadein: 'fadein .25s ease-out' },
    },
  },
  plugins: [],
};
