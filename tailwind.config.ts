import type { Config } from 'tailwindcss';

// Tailwind n'est pas utilisé (styles « verre liquide » dans src/app/globals.css).
const config: Config = { content: ['./src/**/*.{ts,tsx}'], theme: { extend: {} }, plugins: [] };
export default config;
