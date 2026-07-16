/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#15221F',
        cream: '#F8F7F3',
        moss: '#245B4F',
        coral: '#E8664B',
        sand: '#EDE8DE',
      },
      boxShadow: { glow: '0 20px 50px rgba(36, 91, 79, 0.16)' },
      animation: { drift: 'drift 7s ease-in-out infinite', pulseRoute: 'pulseRoute 2.5s ease-in-out infinite' },
      keyframes: {
        drift: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-12px)' } },
        pulseRoute: { '0%,100%': { opacity: '0.45' }, '50%': { opacity: '1' } },
      },
    },
  },
  plugins: [],
};
