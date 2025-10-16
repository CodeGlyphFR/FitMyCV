module.exports = {
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  theme: {
    extend: {
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
      },
      animation: {
        'spin-slow': 'spin-slow 2s linear infinite',
        shimmer: 'shimmer 1s ease-in-out infinite',
        'gold-shimmer': 'gold-shimmer 3s ease-in-out infinite',
      },
      backgroundImage: {
        'gold-gradient': 'linear-gradient(90deg, #b8860b 0%, #d4af37 25%, #f0c419 50%, #d4af37 75%, #b8860b 100%)',
      },
    },
  },
  darkMode: "class",
  plugins: [],
};
