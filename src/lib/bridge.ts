/*
 * Ponte entre a interface e os dados.
 *  - No desktop (Electron) o preload já expõe window.api (IPC direto com o banco local).
 *  - No celular (APK) ou no navegador, instalamos aqui uma versão HTTP do mesmo window.api,
 *    que conversa com o servidor do Caramelo Molhado (no PC da loja ou na nuvem).
 * As telas não precisam saber em qual dos dois modos estão.
 */
const SERVER_KEY = 'cm_server'
const TOKEN_KEY = 'cm_token'

const ls = {
  get: (k: string) => { try { return localStorage.getItem(k) || '' } catch { return '' } },
  set: (k: string, v: string) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k) } catch {} },
}

export const isDesktop = () => (window as any).api?.platform === 'desktop'
export const isNative = () => !!(window as any).Capacitor?.isNativePlatform?.()

export function normalizeServer(url: string) {
  let u = url.trim().replace(/\/+$/, '')
  if (!u) return ''
  if (!/^https?:\/\//i.test(u)) u = 'http://' + u
  if (/^http:\/\/[^/:]+$/i.test(u) && /^\d+\.\d+\.\d+\.\d+$/.test(u.slice(7))) u += ':3737' // IP sem porta → porta padrão
  return u
}
export const getServer = () => ls.get(SERVER_KEY)
export const setServer = (u: string) => ls.set(SERVER_KEY, normalizeServer(u))

/** Testa se o endereço responde como um servidor do Caramelo Molhado. */
export async function pingServer(url: string): Promise<{ shop: string; version: string }> {
  const base = normalizeServer(url)
  if (!base) throw new Error('Informe o endereço do servidor.')
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 6000)
  try {
    const r = await fetch(`${base}/api/health`, { signal: ctrl.signal })
    const j = await r.json()
    if (j?.app !== 'caramelo-molhado') throw new Error('Este endereço não é um servidor do Caramelo Molhado.')
    return j
  } catch (e: any) {
    if (e?.message?.includes('Caramelo')) throw e
    throw new Error(`Não consegui falar com ${base}. Confira o endereço e se o computador da loja está ligado e na mesma rede Wi-Fi.`)
  } finally { clearTimeout(t) }
}

async function rpc(channel: string, ...args: any[]) {
  const base = getServer()
  if (!base) throw new Error('Configure o endereço do servidor na tela de login.')
  const token = ls.get(TOKEN_KEY)
  let r: Response
  try {
    r = await fetch(`${base}/api/rpc/${channel}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Device': isNative() ? 'app-empresa' : 'navegador', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ args }),
    })
  } catch {
    throw new Error('Sem conexão com o servidor. Verifique a internet/Wi-Fi e tente de novo.')
  }
  const j = await r.json().catch(() => ({ ok: false, error: `O servidor respondeu com erro ${r.status}.` }))
  if (r.status === 401 && !['auth:login', 'auth:session', 'auth:logout'].includes(channel)) {
    ls.set(TOKEN_KEY, '')
    window.dispatchEvent(new Event('cm:expired'))
  }
  if (!j.ok) throw new Error(j.error || 'Algo deu errado.')
  if (j.token) ls.set(TOKEN_KEY, j.token)
  return j.data
}

/* ---------- arquivos (relatórios, planilhas, backup) ---------- */
async function saveAndShare(base64: string, fileName: string, mime: string, title: string) {
  if (isNative()) {
    const { Filesystem, Directory } = await import('@capacitor/filesystem')
    const { Share } = await import('@capacitor/share')
    const w = await Filesystem.writeFile({ path: fileName, data: base64, directory: Directory.Cache })
    await Share.share({ title, files: [w.uri], dialogTitle: title }).catch(() => {})
    return fileName
  }
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([bytes], { type: mime }))
  a.download = fileName
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 10000)
  return fileName
}
function textToBase64(s: string) {
  const bytes = new TextEncoder().encode(s)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.onchange = () => resolve(input.files?.[0] || null)
    input.click()
  })
}
const fileToBase64 = (f: File) => new Promise<string>((resolve, reject) => {
  const r = new FileReader()
  r.onerror = () => reject(new Error('Não foi possível ler o arquivo.'))
  r.onload = () => resolve(String(r.result).split(',')[1] || '')
  r.readAsDataURL(f)
})
const stamp = () => new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '').replace(/^(\d{8})/, '$1-')

async function openExternal(url: string) {
  if (!/^https?:\/\//i.test(url)) throw new Error('Link inválido.')
  if (isNative()) {
    const { Browser } = await import('@capacitor/browser')
    await Browser.open({ url })
  } else window.open(url, '_blank', 'noopener')
  return true
}

export function installHttpApi() {
  if ((window as any).api) return
  ;(window as any).api = {
    platform: 'mobile',
    db: {
      all: (sql: string, params: any[] = []) => rpc('db:all', sql, params),
      get: (sql: string, params: any[] = []) => rpc('db:get', sql, params),
      run: (sql: string, params: any[] = []) => rpc('db:run', sql, params),
      batch: (statements: any[]) => rpc('db:batch', statements),
    },
    audit: (action: string, entity: string, detail: string) => rpc('audit:log', action, entity, detail),
    auth: {
      login: (u: string, p: string) => rpc('auth:login', u, p),
      logout: async () => { await rpc('auth:logout').catch(() => {}); ls.set(TOKEN_KEY, ''); return true },
      session: async () => (ls.get(TOKEN_KEY) && getServer() ? rpc('auth:session').catch(() => null) : null),
      register: (n: string, e: string, p: string) => rpc('auth:register', n, e, p),
      changePassword: (o: string, n: string) => rpc('auth:changePassword', o, n),
    },
    users: {
      list: () => rpc('users:list'),
      save: (u: any) => rpc('users:save', u),
      saveProfile: (u: any) => rpc('users:saveProfile', u),
      setPassword: (id: number, pw: string) => rpc('users:setPassword', id, pw),
    },
    demo: { load: () => rpc('demo:load'), remove: () => rpc('demo:remove') },
    clients: {
      appAccess: (id: number) => rpc('clients:appAccess', id),
      newInvite: (id: number) => rpc('clients:newInvite', id),
      setAppActive: (id: number, active: boolean) => rpc('clients:setAppActive', id, active),
    },
    server: { apply: async () => { throw new Error('O servidor é configurado no computador da loja.') } },
    app: {
      info: async () => {
        const base = getServer()
        const h = await fetch(`${base}/api/health`).then((r) => r.json()).catch(() => ({}))
        return { version: h.version || '—', dataFile: `No servidor ${base}`, platform: 'mobile', server: { running: true, urls: [base] }, autoBackups: '—' }
      },
      backup: async () => {
        const r = await rpc('backup:export')
        return saveAndShare(r.base64, `caramelo-backup-${stamp()}.sqlite`, 'application/x-sqlite3', 'Backup do Caramelo Molhado')
      },
      restore: async () => {
        const f = await pickFile('.sqlite,application/octet-stream,application/x-sqlite3')
        if (!f) return false
        if (!window.confirm('Os dados atuais do servidor serão substituídos por este backup. Continuar?')) return false
        await rpc('backup:restore', await fileToBase64(f))
        ls.set(TOKEN_KEY, '')
        window.location.reload()
        return true
      },
      openBackupFolder: async () => { throw new Error('A pasta de backups fica no computador/servidor da loja.') },
      openExternal,
      showItem: async () => true,
    },
    export: {
      pdf: (html: string, name: string) => saveAndShare(textToBase64(html), `${name || 'relatorio'}.html`, 'text/html', 'Relatório (abra e use "Imprimir → Salvar como PDF")'),
      file: (base64: string, name: string, ext: string) => saveAndShare(base64, `${name}.${ext}`, 'application/octet-stream', name),
    },
    geo: {
      cep: (cep: string) => rpc('geo:cep', cep),
      lookup: (client: any) => rpc('geo:lookup', client),
    },
  }
}
