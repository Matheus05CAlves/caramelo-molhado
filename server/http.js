// Servidor HTTP do Caramelo Molhado (sem dependências externas: só o módulo http do Node).
//
//   GET  /api/health                      → status do servidor
//   POST /api/rpc/<canal>                 → app da EQUIPE (mesmos canais do desktop). Body: { args: [...] }
//   POST /api/cliente/<ação>              → app do CLIENTE. Body: JSON
//   GET  /                                → versão web do app do cliente (se a pasta dist-cliente existir)
//
// Autenticação: header "Authorization: Bearer <token>" devolvido no login.
const http = require('http')
const fs = require('fs')
const path = require('path')
const os = require('os')
const core = require('./core')

const MAX_BODY = 30 * 1024 * 1024 // backups e fotos chegam em base64
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' }

function send(res, status, body) {
  const data = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Device',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  })
  res.end(data)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (c) => {
      size += c.length
      if (size > MAX_BODY) { reject(Object.assign(new Error('Arquivo grande demais.'), { status: 413 })); req.destroy() }
      else chunks.push(c)
    })
    req.on('end', () => {
      if (!chunks.length) return resolve({})
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))) } catch { reject(Object.assign(new Error('JSON inválido.'), { status: 400 })) }
    })
    req.on('error', reject)
  })
}

const bearer = (req) => (String(req.headers.authorization || '').match(/^Bearer\s+(.+)$/i) || [])[1] || ''

function serveStatic(dir, req, res) {
  if (!dir || !fs.existsSync(dir)) return false
  const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  let file = path.normalize(path.join(dir, urlPath))
  if (!file.startsWith(path.normalize(dir))) return false
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dir, 'index.html')
  if (!fs.existsSync(file)) return false
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' })
  fs.createReadStream(file).pipe(res)
  return true
}

/**
 * Cria o servidor. `info` é exibido em /api/health (nome e versão).
 * `webDir` (opcional) é a pasta do app do cliente compilado para web.
 */
function createServer({ version = '2.0.0', webDir } = {}) {
  return http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') return send(res, 204, {})
    const url = new URL(req.url, 'http://x')
    const device = String(req.headers['x-device'] || '').slice(0, 120)
    try {
      if (url.pathname === '/api/health') {
        return send(res, 200, { ok: true, app: 'caramelo-molhado', version, shop: core.db.get("SELECT value FROM settings WHERE key='shop_name'")?.value || '' })
      }

      /* ----- app da equipe ----- */
      const rpc = url.pathname.match(/^\/api\/rpc\/([a-zA-Z]+:[a-zA-Z]+)$/)
      if (rpc && req.method === 'POST') {
        const channel = rpc[1]
        const fn = core.staff[channel]
        if (!fn) return send(res, 404, { ok: false, error: 'Função não encontrada.' })
        const token = bearer(req)
        const s = core.resolveSession(token, 'staff')
        const ctx = { userId: s ? s.subject_id : null, device }
        if (!core.staffPublic.has(channel) && !ctx.userId) return send(res, 401, { ok: false, error: 'Sua sessão expirou. Entre novamente.' })
        const body = await readBody(req)
        const data = await fn(ctx, ...(Array.isArray(body.args) ? body.args : []))
        if (channel === 'auth:login') return send(res, 200, { ok: true, data, token: core.createSession('staff', ctx.userId, device) })
        if (channel === 'auth:logout') core.dropSession(token)
        return send(res, 200, { ok: true, data })
      }

      /* ----- app do cliente ----- */
      const cli = url.pathname.match(/^\/api\/cliente\/([a-z:]+)$/)
      if (cli && (req.method === 'POST' || req.method === 'GET')) {
        const action = cli[1]
        const fn = core.client[action]
        if (!fn) return send(res, 404, { ok: false, error: 'Função não encontrada.' })
        const token = bearer(req)
        const s = core.resolveSession(token, 'client')
        const ctx = { accountId: s ? s.subject_id : null, token, device }
        if (!core.clientPublic.has(action) && !ctx.accountId) return send(res, 401, { ok: false, error: 'Sua sessão expirou. Entre novamente.' })
        const body = req.method === 'POST' ? await readBody(req) : Object.fromEntries(url.searchParams)
        return send(res, 200, { ok: true, data: await fn(ctx, body) })
      }

      if (url.pathname.startsWith('/api/')) return send(res, 404, { ok: false, error: 'Rota não encontrada.' })
      if (req.method === 'GET' && serveStatic(webDir, req, res)) return
      return send(res, 404, { ok: false, error: 'Não encontrado.' })
    } catch (err) {
      const status = err.status || 500
      if (status >= 500) console.error('[api]', err)
      return send(res, status, { ok: false, error: status >= 500 && !err.status ? `Erro no servidor: ${err.message}` : err.message })
    }
  })
}

/** Endereços desta máquina na rede local (para configurar os celulares). */
function lanAddresses(port) {
  const out = []
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list || []) if (a.family === 'IPv4' && !a.internal) out.push(`http://${a.address}:${port}`)
  }
  return out
}

module.exports = { createServer, lanAddresses }
