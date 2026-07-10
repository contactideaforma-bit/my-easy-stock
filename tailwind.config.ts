import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
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
