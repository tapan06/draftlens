import type { Config } from 'tailwindcss';

/**
 * DraftLens Design System — Tailwind theme.
 * Все цвета берутся из CSS-переменных (src/index.css) в формате "R G B",
 * поэтому работают модификаторы прозрачности: bg-primary/20, ring-win-high/40 и т.д.
 */
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: token('bg'), // #0B0E14 — основной фон
        surface: {
          DEFAULT: token('surface'), // #131822 — карточки и панели
          2: token('surface-2'), // #1A2130 — вложенные элементы, hover
          3: token('surface-3'), // #222B3D — инпуты, активные табы
        },
        line: 'rgba(255, 255, 255, 0.08)', // тонкая обводка карточек
        'line-strong': 'rgba(255, 255, 255, 0.14)',
        fg: {
          DEFAULT: token('fg'), // основной текст
          muted: token('fg-muted'), // вторичный текст
          dim: token('fg-dim'), // подписи, плейсхолдеры
        },
        primary: {
          DEFAULT: token('primary'), // #E23636 — главные CTA, контрпики, опасность
          bright: token('primary-bright'), // #FF4655 — hover / свечение
        },
        accent: token('accent'), // #38BDF8 — аналитика, нейтральные теги, союзники
        win: {
          high: token('win-high'), // #10B981 — WR > 53%
          mid: token('win-mid'), // #F59E0B — WR 49–53%
          low: token('win-low'), // #EF4444 — WR < 49%
        },
        attr: {
          str: token('attr-str'),
          agi: token('attr-agi'),
          int: token('attr-int'),
          all: token('attr-all'),
        },
      },
      fontFamily: {
        sans: ['Inter', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      borderRadius: {
        card: '14px',
      },
      boxShadow: {
        card: '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 8px 24px -12px rgba(0,0,0,0.6)',
        'glow-red': '0 0 0 1px rgb(var(--primary) / 0.5), 0 8px 32px -8px rgb(var(--primary) / 0.55)',
        'glow-cyan': '0 0 0 1px rgb(var(--accent) / 0.45), 0 8px 32px -10px rgb(var(--accent) / 0.5)',
        'glow-green': '0 0 0 1px rgb(var(--win-high) / 0.6), 0 6px 24px -8px rgb(var(--win-high) / 0.55)',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' },
        },
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          from: { transform: 'translateX(100%)' },
          to: { transform: 'translateX(0)' },
        },
        'pop-in': {
          '0%': { transform: 'scale(0.85)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.4s linear infinite',
        'fade-in': 'fade-in 220ms ease-out both',
        'slide-in-right': 'slide-in-right 280ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'pop-in': 'pop-in 180ms ease-out both',
      },
    },
  },
  plugins: [],
} satisfies Config;
