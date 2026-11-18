const { app, BrowserWindow, ipcMain, dialog, shell, session, net, Menu } = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')
const db = require('../server/db')
const seed = require('../server/seed')
const core = require('../server/core')
const { createServer, lanAddresses } = require('../server/http')

const isDev = process.env.NODE_ENV === 'development'
const UA = 'CarameloMolhadoPetShop/2.0 (sistema interno desktop)'
let win = null

app.commandLine.appendSwitch('lang', 'pt-BR')
app.setPath('userData', path.join(app.getPath('appData'), 'CarameloMolhadoPetShop'))

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })
}

/* ---------- utilitários ---------- */
const stamp = () => {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
}

// Sessão do desktop: um usuário por janela (o servidor HTTP tem as próprias sessões, por token).
const ctx = { userId: null, device: 'desktop' }
const requireAdmin = () => {
  const u = core.sessionUser(ctx)
  if (!u || u.role !== 'admin') throw new Error('Apenas administradores podem fazer isso.')
  return u
}

// Registra um handler que devolve { ok, data } ou { ok:false, error } (o preload transforma em exceção).
function handle(channel, fn, { publicChannel = false } = {}) {
  ipcMain.handle(channel, async (_e, ...args) => {
    try {
      if (!publicChannel && !core.sessionUser(ctx)) throw new Error('Sua sessão expirou. Entre novamente.')
      return { ok: true, data: await fn(...args) }
    } catch (err) {
      return { ok: false, error: err.message || String(err) }
    }
  })
}

// Todos os canais de dados vêm do núcleo compartilhado (server/core.js).
for (const [channel, fn] of Object.entries(core.staff)) {
  if (channel.startsWith('backup:')) continue // no desktop o backup usa as janelas de salvar/abrir arquivo
  handle(channel, (...args) => fn(ctx, ...args), { publicChannel: core.staffPublic.has(channel) })
}

/* ---------- servidor para os apps de celular ---------- */
let server = null
let serverState = { running: false, port: 0, error: '' }
function startServer() {
  if (server) { try { server.close() } catch {} server = null }
  const enabled = db.get("SELECT value FROM settings WHERE key='server_enabled'")?.value !== '0'
  const port = Number(db.get("SELECT value FROM settings WHERE key='server_port'")?.value) || 3737
  serverState = { running: false, port, error: '' }
  if (!enabled) return
  server = createServer({ version: app.getVersion(), webDir: path.join(__dirname, '..', 'dist-cliente') })
  server.on('error', (e) => { serverState = { running: false, port, error: e.code === 'EADDRINUSE' ? `A porta ${port} já está em uso por outro programa.` : e.message } })
  server.listen(port, '0.0.0.0', () => { serverState = { running: true, port, error: '' } })
}
handle('server:apply', () => { requireAdmin(); startServer(); return new Promise((r) => setTimeout(() => r(serverState), 400)) })

/* ---------- backup e restauração ---------- */
const backupDir = () => path.join(app.getPath('userData'), 'backups')

function autoBackup() {
  try {
    fs.mkdirSync(backupDir(), { recursive: true })
    const target = path.join(backupDir(), `automatico-${stamp().slice(0, 8)}.sqlite`)
    if (!fs.existsSync(target)) fs.writeFileSync(target, db.exportBytes())
    const files = fs.readdirSync(backupDir()).filter((f) => f.startsWith('automatico-')).sort()
    files.slice(0, Math.max(0, files.length - 10)).forEach((f) => fs.unlinkSync(path.join(backupDir(), f)))
  } catch (e) {
    console.error('Falha no backup automático', e)
  }
}

handle('app:info', () => ({
  version: app.getVersion(),
  dataFile: db.file(),
  backupDir: backupDir(),
  demoLoaded: db.get("SELECT value FROM settings WHERE key='demo_loaded'")?.value === '1',
  autoBackups: fs.existsSync(backupDir()) ? fs.readdirSync(backupDir()).length : 0,
  platform: 'desktop',
  server: { ...serverState, urls: serverState.running ? lanAddresses(serverState.port) : [] },
}))

handle('app:backup', async () => {
  const u = requireAdmin()
  const r = await dialog.showSaveDialog(win, { title: 'Salvar backup', defaultPath: `caramelo-backup-${stamp()}.sqlite`, filters: [{ name: 'Backup Caramelo Molhado', extensions: ['sqlite'] }] })
  if (r.canceled || !r.filePath) return null
  fs.writeFileSync(r.filePath, db.exportBytes())
  core.audit('Gerou backup manual', 'Sistema', r.filePath, u)
  return r.filePath
})

handle('app:restore', async () => {
  const u = requireAdmin()
  const r = await dialog.showOpenDialog(win, { title: 'Escolher backup para restaurar', properties: ['openFile'], filters: [{ name: 'Backup Caramelo Molhado', extensions: ['sqlite'] }] })
  if (r.canceled || !r.filePaths[0]) return false
  const ok = await dialog.showMessageBox(win, {
    type: 'warning', buttons: ['Restaurar', 'Cancelar'], defaultId: 1, cancelId: 1,
    title: 'Restaurar backup',
    message: 'Os dados atuais serão substituídos pelo backup escolhido.',
    detail: 'Uma cópia de segurança dos dados atuais será salva antes. Você precisará entrar novamente.',
  })
  if (ok.response !== 0) return false
  fs.mkdirSync(backupDir(), { recursive: true })
  fs.writeFileSync(path.join(backupDir(), `antes-de-restaurar-${stamp()}.sqlite`), db.exportBytes())
  db.replaceWith(fs.readFileSync(r.filePaths[0]))
  ctx.userId = null
  core.audit('Restaurou backup', 'Sistema', path.basename(r.filePaths[0]), u)
  win.webContents.reload()
  return true
})

handle('app:openBackupFolder', () => { fs.mkdirSync(backupDir(), { recursive: true }); shell.openPath(backupDir()); return true })

/* ---------- exportações ---------- */
handle('export:pdf', async (html, name, landscape) => {
  const r = await dialog.showSaveDialog(win, { title: 'Salvar PDF', defaultPath: `${name || 'relatorio'}.pdf`, filters: [{ name: 'PDF', extensions: ['pdf'] }] })
  if (r.canceled || !r.filePath) return null
  const tmp = path.join(os.tmpdir(), `cm-relatorio-${Date.now()}.html`)
  fs.writeFileSync(tmp, html)
  const w = new BrowserWindow({ show: false, webPreferences: { sandbox: true, javascript: false } })
  try {
    await w.loadFile(tmp)
    const pdf = await w.webContents.printToPDF({ pageSize: 'A4', printBackground: true, landscape: !!landscape, margins: { marginType: 'default' } })
    fs.writeFileSync(r.filePath, pdf)
  } finally {
    w.destroy()
    fs.unlink(tmp, () => {})
  }
  return r.filePath
})

handle('export:file', async (base64, name, ext, label) => {
  const r = await dialog.showSaveDialog(win, { title: 'Salvar arquivo', defaultPath: `${name}.${ext}`, filters: [{ name: label || ext.toUpperCase(), extensions: [ext] }] })
  if (r.canceled || !r.filePath) return null
  fs.writeFileSync(r.filePath, Buffer.from(base64, 'base64'))
  return r.filePath
})

handle('app:showItem', (p) => { shell.showItemInFolder(p); return true })
handle('app:openExternal', (url) => {
  if (!/^https?:\/\//i.test(String(url))) throw new Error('Link inválido.')
  shell.openExternal(url)
  return true
})

/* ---------- janela ---------- */
function createWindow() {
  win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1180, minHeight: 720,
    show: false, backgroundColor: '#F5F6F8', title: 'Caramelo Molhado Pet Shop Inc.',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  })
  win.once('ready-to-show', () => win.show())
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file://') && !url.startsWith('http://localhost:5173')) e.preventDefault()
  })
  if (isDev) win.loadURL('http://localhost:5173')
  else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
}

app.whenReady().then(async () => {
  if (!isDev) Menu.setApplicationMenu(null)
  session.defaultSession.setSpellCheckerLanguages(['pt-BR'])
  // Os servidores do OpenStreetMap exigem Referer e User-Agent identificando o aplicativo.
  session.defaultSession.webRequest.onBeforeSendHeaders({ urls: ['https://*.tile.openstreetmap.org/*', 'https://tile.openstreetmap.org/*'] }, (details, cb) => {
    details.requestHeaders['Referer'] = 'https://caramelo-molhado.app/'
    details.requestHeaders['User-Agent'] = UA
    cb({ requestHeaders: details.requestHeaders })
  })

  const info = await db.open(app.getPath('userData'))
  if (info.isNew) {
    seed.seedDefaults()
    seed.seedDemo()
    db.saveNow()
  }
  autoBackup()
  startServer()
  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

app.on('before-quit', () => { try { server && server.close() } catch {} db.saveNow() })
app.on('window-all-closed', () => app.quit())
