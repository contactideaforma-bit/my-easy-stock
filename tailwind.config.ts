import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0d2b4e',
        coral: {
          50: '#fff4ee',
          100: '#ffe6d9',
          200: '#ffc9ad',
          300: '#ffa578',
          400: '#ff8a55',
          500: '#ff7a45',
          600: '#f05e23',
          700: '#c74815',
          800: '#9e3a14',
          900: '#7f3214'
        },
        crystal: {
          50: '#eff8ff',
          100: '#dbeefe',
          200: '#bfe3fe',
          300: '#93d2fd',
          400: '#60b8fa',
          500: '#3b9af6',
          600: '#257ceb',
          700: '#1d65d8',
          800: '#1e52af',
          900: '#1e478a',
          950: '#172c54'
        }
      },
      borderRadius: {
        glass: '1.5rem'
      }
    }
  },
  plugins: []
};
export default config;
