/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['"Plus Jakarta Sans Variable"', 'Segoe UI', 'system-ui', 'sans-serif'] },
      colors: {
        brand: { 50: '#FFF5EB', 100: '#FFE7D0', 200: '#FFCFA0', 300: '#FFB06B', 400: '#FF9440', 500: '#FF7A1A', 600: '#EE6500', 700: '#C75000' },
        leaf: { 50: '#E8F8F0', 100: '#CFF0E0', 500: '#1FA971', 600: '#168B5C', 700: '#117049' },
        ink: { DEFAULT: '#2A2F38', soft: '#4B5360', muted: '#7A8391' },
        paper: { DEFAULT: '#F5F6F8', line: '#E7E9EE' },
      },
      boxShadow: {
        soft: '0 8px 28px -12px rgba(42,47,56,.16), 0 1px 2px rgba(42,47,56,.04)',
        lift: '0 18px 40px -16px rgba(42,47,56,.28)',
      },
      keyframes: {
        pop: { '0%': { opacity: 0, transform: 'translateY(8px) scale(.985)' }, '100%': { opacity: 1, transform: 'none' } },
        fade: { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
        slide: { '0%': { opacity: 0, transform: 'translateX(14px)' }, '100%': { opacity: 1, transform: 'none' } },
      },
      animation: { pop: 'pop .22s ease-out', fade: 'fade .18s ease-out', slide: 'slide .24s ease-out' },
    },
  },
  plugins: [],
}
