#!/usr/bin/env node
// Servidor standalone: use quando o banco deve ficar em um servidor/nuvem em vez do PC da loja.
//   node server/index.js                       (dados em ./data, porta 3737)
//   PORT=8080 DATA_DIR=/var/lib/caramelo node server/index.js
const path = require('path')
const fs = require('fs')
const db = require('./db')
const seed = require('./seed')
const { createServer, lanAddresses } = require('./http')
const pkg = require('../package.json')

const PORT = Number(process.env.PORT) || 3737
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, '..', 'data'))
const WEB_DIR = path.resolve(process.env.WEB_DIR || path.join(__dirname, '..', 'dist-cliente'))
const DEMO = process.env.DEMO !== '0'

function backupDaily() {
  try {
    const dir = path.join(DATA_DIR, 'backups')
    fs.mkdirSync(dir, { recursive: true })
    const d = new Date()
    const target = path.join(dir, `automatico-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.sqlite`)
    if (!fs.existsSync(target)) fs.writeFileSync(target, db.exportBytes())
    const files = fs.readdirSync(dir).filter((f) => f.startsWith('automatico-')).sort()
    files.slice(0, Math.max(0, files.length - 10)).forEach((f) => fs.unlinkSync(path.join(dir, f)))
  } catch (e) { console.error('Falha no backup automático', e) }
}

;(async () => {
  const info = await db.open(DATA_DIR)
  if (info.isNew) {
    seed.seedDefaults()
    if (DEMO) seed.seedDemo()
    db.saveNow()
  }
  backupDaily()
  setInterval(backupDaily, 6 * 3600000)
  createServer({ version: pkg.version, webDir: WEB_DIR }).listen(PORT, '0.0.0.0', () => {
    console.log(`Caramelo Molhado — servidor ${pkg.version}`)
    console.log(`Banco: ${info.file}`)
    console.log(`Ouvindo na porta ${PORT}:`)
    ;[`http://localhost:${PORT}`, ...lanAddresses(PORT)].forEach((u) => console.log('  ' + u))
  })
  const stop = () => { db.saveNow(); process.exit(0) }
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)
})().catch((e) => { console.error(e); process.exit(1) })
