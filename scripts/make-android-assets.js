// Gera ícones e telas de abertura dos dois APKs a partir do mascote (src/assets/mascot.svg).
//   node scripts/make-android-assets.js
const fs = require('fs')
const path = require('path')
const sharp = require('sharp')

const svg = fs.readFileSync(path.join(__dirname, '..', 'src', 'assets', 'mascot.svg'))
const APPS = {
  empresa: { bg: '#2A2F38', label: 'EQUIPE' }, // fundo escuro: diferencia o app da equipe na tela do celular
  cliente: { bg: '#FF7A1A', label: '' },
}
const DENS = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 }

async function mascot(size) { return sharp(svg, { density: 384 }).resize(size, size).png().toBuffer() }

async function icon(size, bg, round) {
  const m = await mascot(Math.round(size * 0.78))
  const mask = Buffer.from(round
    ? `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}"/></svg>`
    : `<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${size * 0.22}"/></svg>`)
  const base = await sharp({ create: { width: size, height: size, channels: 4, background: bg } })
    .composite([{ input: m, gravity: 'center' }]).png().toBuffer()
  return sharp(base).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer()
}

async function run() {
  for (const [app, cfg] of Object.entries(APPS)) {
    const res = path.join(__dirname, '..', 'mobile', app, 'android', 'app', 'src', 'main', 'res')
    if (!fs.existsSync(res)) { console.log(`pulei ${app} (rode "npx cap add android" antes)`); continue }
    for (const [d, k] of Object.entries(DENS)) {
      const dir = path.join(res, `mipmap-${d}`)
      fs.writeFileSync(path.join(dir, 'ic_launcher.png'), await icon(Math.round(48 * k), cfg.bg, false))
      fs.writeFileSync(path.join(dir, 'ic_launcher_round.png'), await icon(Math.round(48 * k), cfg.bg, true))
      const fg = Math.round(108 * k) // ícone adaptativo: mascote dentro da zona segura (66%)
      fs.writeFileSync(path.join(dir, 'ic_launcher_foreground.png'),
        await sharp({ create: { width: fg, height: fg, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
          .composite([{ input: await mascot(Math.round(fg * 0.62)), gravity: 'center' }]).png().toBuffer())
    }
    fs.writeFileSync(path.join(res, 'values', 'ic_launcher_background.xml'),
      `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${cfg.bg}</color>\n</resources>\n`)
    // telas de abertura: todas as variações de splash.png
    const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(dir, e.name)) : e.name === 'splash.png' ? [path.join(dir, e.name)] : [])
    for (const f of walk(res)) {
      const { width, height } = await sharp(f).metadata()
      const m = await mascot(Math.round(Math.min(width, height) * 0.42))
      const parts = [{ input: m, gravity: 'center' }]
      if (cfg.label) {
        const fs2 = Math.round(Math.min(width, height) * 0.06)
        parts.push({ input: Buffer.from(`<svg width="${width}" height="${fs2 * 2}"><text x="50%" y="${fs2 * 1.4}" font-family="sans-serif" font-weight="800" font-size="${fs2}" fill="#FF9440" text-anchor="middle" letter-spacing="${fs2 * 0.3}">${cfg.label}</text></svg>`), top: Math.round(height / 2 + Math.min(width, height) * 0.25), left: 0 })
      }
      await sharp({ create: { width, height, channels: 3, background: cfg.bg } }).composite(parts).png().toFile(f + '.tmp')
      fs.renameSync(f + '.tmp', f)
    }
    console.log(`ícones e splash prontos: ${app}`)
  }
}
run().catch((e) => { console.error(e); process.exit(1) })
