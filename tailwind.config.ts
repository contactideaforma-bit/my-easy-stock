import type { Config } from 'tailwindcss';

// Palette « rose poudré » : rose framboise en couleur principale,
// lavande et menthe en complémentaires douces, pêche/miel pour l'attention,
// corail pour les retards. Texte prune profond plutôt que noir : plus doux, toujours lisible.
const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#3a2233', soft: '#6b5061', mute: '#9a8391' },
        paper: { DEFAULT: '#fdf8f9', card: '#ffffff', line: '#f1e2e8', deep: '#faeef2' },
        rose: {
          50: '#fef3f7', 100: '#fde4ee', 200: '#fbc9dc', 300: '#f7a1c0', 400: '#f07aa6',
          500: '#e2568c', 600: '#cc3a73', 700: '#a92c5d', 800: '#86264c', 900: '#6d2240',
        },
        lilac: { 50: '#f6f3fd', 100: '#ece6fb', 200: '#d9cff6', 400: '#a996e6', 500: '#8f78d9', 600: '#7560c4', 700: '#5e4ca3' },
        mint: { 50: '#ecf8f2', 100: '#d3efe1', 500: '#4aa87c', 600: '#3a9068', 700: '#2e7455' },
        honey: { 50: '#fff6e8', 100: '#fde8c4', 500: '#dc9a32', 600: '#b97b1d' },
        clay: { 50: '#fdeeee', 100: '#f9d6d7', 500: '#e0585e', 600: '#cc4148', 700: '#a8333a' },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Georgia', 'serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(134,38,76,.04), 0 6px 20px rgba(204,58,115,.06)',
        pop: '0 14px 40px rgba(134,38,76,.16)',
        glow: '0 6px 18px rgba(204,58,115,.30)',
      },
    },
  },
  plugins: [],
};
export default config;
