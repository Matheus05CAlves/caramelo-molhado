// Comunicação do app do cliente com o servidor do pet shop.
const SERVER_KEY = 'cm_cli_server'
const TOKEN_KEY = 'cm_cli_token'
const BUILT_IN = (import.meta.env.VITE_SERVER_URL || '').replace(/\/+$/, '')

const ls = {
  get: (k: string) => { try { return localStorage.getItem(k) || '' } catch { return '' } },
  set: (k: string, v: string) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k) } catch {} },
}
export const isNative = () => !!(window as any).Capacitor?.isNativePlatform?.()

export function normalize(url: string) {
  let u = url.trim().replace(/\/+$/, '')
  if (!u) return ''
  if (!/^https?:\/\//i.test(u)) u = 'http://' + u
  if (/^http:\/\/\d+\.\d+\.\d+\.\d+$/.test(u)) u += ':3737'
  return u
}
/** Ordem: endereço escolhido pelo usuário → endereço embutido no APK → mesmo site (versão web servida pelo servidor). */
export function getServer() {
  const saved = ls.get(SERVER_KEY)
  if (saved) return saved
  if (BUILT_IN) return BUILT_IN
  if (!isNative() && /^https?:$/.test(location.protocol) && !/:(5174|4174)$/.test(location.host)) return location.origin
  return ''
}
export const setServer = (u: string) => ls.set(SERVER_KEY, normalize(u))
export const hasToken = () => !!ls.get(TOKEN_KEY)
export const clearToken = () => ls.set(TOKEN_KEY, '')

export async function ping(url: string) {
  const base = normalize(url)
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 6000)
  try {
    const j = await fetch(`${base}/api/health`, { signal: ctrl.signal }).then((r) => r.json())
    if (j?.app !== 'caramelo-molhado') throw new Error('x')
    return j
  } catch {
    throw new Error('Não encontramos o pet shop nesse endereço. Confira com a loja.')
  } finally { clearTimeout(t) }
}

export async function api<T = any>(action: string, body: any = {}): Promise<T> {
  const base = getServer()
  if (!base) throw new Error('Endereço do pet shop não configurado.')
  const token = ls.get(TOKEN_KEY)
  let r: Response
  try {
    r = await fetch(`${base}/api/cliente/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Device': isNative() ? 'app-cliente' : 'web-cliente', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error('Sem conexão com o pet shop. Verifique sua internet e tente de novo.')
  }
  const j = await r.json().catch(() => ({ ok: false, error: `Erro ${r.status} no servidor.` }))
  if (r.status === 401 && !['login', 'cadastro'].includes(action)) { clearToken(); window.dispatchEvent(new Event('cli:expired')) }
  if (!j.ok) throw new Error(j.error || 'Algo deu errado.')
  if (j.data?.token) ls.set(TOKEN_KEY, j.data.token)
  return j.data
}

export async function openLink(url: string) {
  if (isNative() && /^https?:/.test(url)) {
    const { Browser } = await import('@capacitor/browser')
    return Browser.open({ url })
  }
  window.open(url, '_blank')
}
