/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primary dark theme colors
        background: {
          DEFAULT: '#0B0F1A',
          secondary: '#111827',
          tertiary: '#1F2937',
          card: '#151B2B',
          hover: '#1E2538',
        },
        // Accent colors
        accent: {
          purple: '#8B5CF6',
          blue: '#3B82F6',
          green: '#22C55E',
          orange: '#F97316',
          red: '#EF4444',
          cyan: '#06B6D4',
          pink: '#EC4899',
        },
        // Specialty colors (matching UI design)
        specialty: {
          coder: '#3B82F6',
          designer: '#8B5CF6',
          writer: '#22C55E',
          data_analyst: '#F97316',
          tester: '#EF4444',
        },
        // Text colors
        text: {
          primary: '#F9FAFB',
          secondary: '#9CA3AF',
          muted: '#6B7280',
        },
        // Border colors
        border: {
          DEFAULT: '#1F2937',
          light: '#374151',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-in': 'slideIn 0.3s ease-out',
        'fade-in': 'fadeIn 0.2s ease-out',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        slideIn: {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(139, 92, 246, 0.5)' },
          '100%': { boxShadow: '0 0 20px rgba(139, 92, 246, 0.8)' },
        },
      },
    },
  },
  plugins: [],
}
