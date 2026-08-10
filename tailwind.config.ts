import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: 'class',
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        'deep-teal': '#0F2D2E',
        'primary-teal': '#16B39A',
        'light-mint': '#6EE7D1',
        'gold-accent': '#F5B62E',
        'bg-light': '#F7F8FA',
        'text-dark': '#1A1F23',
        'error': '#BA1A1A',
        'dark-surface': '#163B3C',
        'dark-elevated': '#1D4546',
      },
      fontFamily: {
        poppins: ['var(--font-poppins)', 'sans-serif'],
        inter: ['var(--font-inter)', 'sans-serif'],
      },
      borderRadius: {
        'card': '12px',
        'card-lg': '16px',
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
      },
    },
  },
  plugins: [],
};
export default config;
