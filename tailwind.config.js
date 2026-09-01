/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['Syne', 'system-ui', 'sans-serif'],
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
      },
      colors: {
        void: {
          950: '#050505',
          900: '#0c0c0c',
          850: '#111111',
          800: '#161616',
          700: '#1e1e1e',
          600: '#2a2a2a',
          500: '#3d3d3d',
          400: '#525252',
        },
        cream: {
          50: '#fdfcf9',
          100: '#f8f6f0',
          200: '#ebe7dc',
          300: '#d4cfc0',
          400: '#a8a191',
        },
        accent: {
          DEFAULT: '#0ea5e9',
          light: '#38bdf8',
          dark: '#0284c7',
          muted: 'rgba(14, 165, 233, 0.15)',
        },
        glow: {
          accent: 'rgba(14, 165, 233, 0.25)',
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'noise': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
      },
      animation: {
        'fade-in': 'fadeIn 0.6s ease-out forwards',
        'slide-up': 'slideUp 0.5s ease-out forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      boxShadow: {
        'glow': '0 0 40px -10px rgba(14, 165, 233, 0.3)',
        'glow-sm': '0 0 20px -5px rgba(14, 165, 233, 0.2)',
        'inner-glow': 'inset 0 0 60px -20px rgba(14, 165, 233, 0.08)',
      },
    },
  },
  plugins: [],
};
