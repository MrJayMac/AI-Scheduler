/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      keyframes: {
        rotate: {
          to: { transform: 'rotate(360deg)' },
        },
        float: {
          '0%': { transform: 'translate(0,0) scale(1)' },
          '100%': { transform: 'translate(30px,20px) scale(1.05)' },
        },
        float2: {
          '0%': { transform: 'translate(0,0) scale(1)' },
          '100%': { transform: 'translate(-30px,-20px) scale(1.05)' },
        },
      },
      animation: {
        'slow-rotate': 'rotate 30s linear infinite',
        float: 'float 14s ease-in-out infinite alternate',
        float2: 'float2 16s ease-in-out infinite alternate',
      },
    },
  },
  plugins: [],
}
