import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#F5A623',
          light: '#FFD180',
          dark: '#E09000',
        },
        text: {
          DEFAULT: '#333333',
          secondary: '#666666',
        },
        surface: '#F5F5F5',
      },
    },
  },
  plugins: [],
};

export default config;
