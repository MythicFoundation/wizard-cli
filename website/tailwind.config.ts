import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        wiz: {
          bg: '#000000',
          'bg-1': '#08080C',
          'bg-2': '#0F0F15',
          'bg-3': '#16161F',
          card: '#08080C',
          border: 'rgba(255,255,255,0.06)',
          text: '#A0A0B0',
          'text-dim': '#686878',
          'text-muted': '#404050',
          purple: '#9945FF',
          'purple-bright': '#B06FFF',
          'purple-deep': '#7B2FCC',
          green: '#14F195',
          'green-dim': '#0CC878',
        },
      },
      fontFamily: {
        display: ['var(--font-sora)', 'Sora', 'sans-serif'],
        sans: ['var(--font-inter)', 'Inter', 'sans-serif'],
        mono: ['var(--font-jetbrains)', 'JetBrains Mono', 'monospace'],
      },
      borderRadius: { none: '0' },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4,0,0.6,1) infinite',
      },
    },
  },
  plugins: [],
}
export default config
