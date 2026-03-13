/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base: '#09121f',
        ocean: '#0f766e',
        sky: '#38bdf8',
        mint: '#5eead4',
        slateglass: 'rgba(255,255,255,0.08)'
      },
      boxShadow: {
        glow: '0 30px 80px rgba(56,189,248,0.28)'
      },
      backgroundImage: {
        'hero-radial':
          'radial-gradient(circle at 15% 20%, rgba(56,189,248,0.45), transparent 35%), radial-gradient(circle at 80% 15%, rgba(94,234,212,0.35), transparent 28%), radial-gradient(circle at 50% 80%, rgba(15,118,110,0.5), transparent 45%)'
      }
    }
  },
  plugins: []
};
