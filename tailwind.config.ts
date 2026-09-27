import type { Config } from 'tailwindcss';

// Palette « cabinet serein » : ivoire, encre, vert sauge, terracotta pour les retards.
const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#1c2433', soft: '#4a5468', mute: '#7b8496' },
        paper: { DEFAULT: '#f6f5f1', card: '#ffffff', line: '#e6e2d9', deep: '#efece5' },
        sage: {
          50: '#eef6f3', 100: '#d6ebe4', 200: '#aed6c9', 300: '#7fbba8', 400: '#529c87',
          500: '#3a8a74', 600: '#2f7d6d', 700: '#276557', 800: '#215146', 900: '#1c433b',
        },
        clay: { 50: '#fcf1ec', 100: '#f8ddd1', 500: '#d0673c', 600: '#c2562d', 700: '#9d4424' },
        honey: { 50: '#fdf6e7', 100: '#faeac4', 500: '#c98a1c', 600: '#a8711a' },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Georgia', 'serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(28,36,51,.04), 0 4px 16px rgba(28,36,51,.04)',
        pop: '0 12px 40px rgba(28,36,51,.14)',
      },
    },
  },
  plugins: [],
};
export default config;
