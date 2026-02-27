/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        kz: {
          blue: '#00AFCA',
          gold: '#FFD700',
          darkblue: '#0D1B2A',
          navy: '#1B2838',
          panel: '#1E293B',
          surface: '#0F172A',
          border: '#334155',
        },
        risk: {
          low: '#22C55E',
          medium: '#F59E0B',
          high: '#EF4444',
          critical: '#DC2626',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
