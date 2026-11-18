// Gera build/icon.png (512px) e build/icon.ico (multi-tamanho) a partir de build/icon.svg
const sharp = require('sharp')
const pngToIco = require('png-to-ico')
const fs = require('fs')
const path = require('path')
;(async () => {
  const svg = fs.readFileSync(path.join(__dirname, '..', 'build', 'icon.svg'))
  const sizes = [256, 128, 64, 48, 32, 16]
  const bufs = await Promise.all(sizes.map((s) => sharp(svg, { density: 384 }).resize(s, s).png().toBuffer()))
  fs.writeFileSync(path.join(__dirname, '..', 'build', 'icon.png'), await sharp(svg, { density: 384 }).resize(512, 512).png().toBuffer())
  const ico = await (pngToIco.default || pngToIco)(bufs)
  fs.writeFileSync(path.join(__dirname, '..', 'build', 'icon.ico'), ico)
  console.log('Ícones gerados em build/')
})()
