/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        nba: {
          blue: '#17408B',
          red: '#C9082A',
          silver: '#C0C0C0',
        },
      },
    },
  },
  plugins: [],
};
