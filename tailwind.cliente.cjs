// Mesmo tema do app da empresa, aplicado ao app do cliente.
const base = require('./tailwind.config.cjs')
const ext = base.theme.extend
module.exports = {
  ...base,
  content: ['./cliente/index.html', './cliente/src/**/*.{ts,tsx}', './src/components/Mascot.tsx'],
  theme: {
    extend: {
      ...ext,
      keyframes: { ...ext.keyframes, up: { '0%': { transform: 'translateY(40px)', opacity: 0 }, '100%': { transform: 'none', opacity: 1 } } },
      animation: { ...ext.animation, up: 'up .25s ease-out' },
    },
  },
}
