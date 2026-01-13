module.exports = {
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        'app-bg': 'rgb(2, 6, 23)', // Deep dark blue - application background
      },
      screens: {
        'sm': '1025px',
        'md': '1025px',
        'topbar': '1025px',
      },
      backdropBlur: {
        '4xl': '80px',
        '5xl': '120px',
      },
      keyframes: {
        'spin-slow': {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
        shimmer: {
          '0%, 100%': { opacity: '0.6' },
          '50%': { opacity: '1' },
        },
        'gold-shimmer': {
          '0%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
        'blob-float-1': {
          '0%': {
            transform: 'translate(0, 0) scale(1)',
            opacity: '0.4'
          },
          '25%': {
            transform: 'translate(40vw, -15vh) scale(1.1)',
            opacity: '0.6'
          },
          '50%': {
            transform: 'translate(20vw, 30vh) scale(0.9)',
            opacity: '0.5'
          },
          '75%': {
            transform: 'translate(-30vw, 10vh) scale(1.05)',
            opacity: '0.55'
          },
          '100%': {
            transform: 'translate(0, 0) scale(1)',
            opacity: '0.4'
          },
        },
        'blob-float-2': {
          '0%': {
            transform: 'translate(0, 0) scale(1)',
            opacity: '0.5'
          },
          '30%': {
            transform: 'translate(-35vw, 20vh) scale(1.15)',
            opacity: '0.65'
          },
          '60%': {
            transform: 'translate(25vw, -25vh) scale(0.85)',
            opacity: '0.45'
          },
          '85%': {
            transform: 'translate(10vw, 15vh) scale(1.08)',
            opacity: '0.58'
          },
          '100%': {
            transform: 'translate(0, 0) scale(1)',
            opacity: '0.5'
          },
        },
        'blob-float-3': {
          '0%': {
            transform: 'translate(0, 0) scale(1)',
            opacity: '0.45'
          },
          '20%': {
            transform: 'translate(15vw, -30vh) scale(0.95)',
            opacity: '0.6'
          },
          '50%': {
            transform: 'translate(-40vw, -10vh) scale(1.12)',
            opacity: '0.5'
          },
          '80%': {
            transform: 'translate(30vw, 25vh) scale(0.88)',
            opacity: '0.55'
          },
          '100%': {
            transform: 'translate(0, 0) scale(1)',
            opacity: '0.45'
          },
        },
      },
      animation: {
        'spin-slow': 'spin-slow 2s linear infinite',
        shimmer: 'shimmer 1s ease-in-out infinite',
        'gold-shimmer': 'gold-shimmer 3s ease-in-out infinite',
        'blob-1': 'blob-float-1 35s ease-in-out infinite',
        'blob-2': 'blob-float-2 40s ease-in-out infinite 5s',
        'blob-3': 'blob-float-3 38s ease-in-out infinite 10s',
      },
      backgroundImage: {
        'gold-gradient': 'linear-gradient(90deg, #b8860b 0%, #d4af37 25%, #f0c419 50%, #d4af37 75%, #b8860b 100%)',
      },
    },
  },
  darkMode: "class",
  plugins: [
    require('tailwind-scrollbar'),
  ],
};
