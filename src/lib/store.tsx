import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { CheckCircle2, Info, XCircle } from 'lucide-react'
import { ConfirmDialog } from '../components/ui'
import { cls } from './util'
import type { Page } from './domain'

declare global {
  interface Window { api: any }
}

/* ---------- banco de dados ---------- */
let version = 0
const listeners = new Set<() => void>()
export const bump = () => {
  version++
  listeners.forEach((l) => l())
}
const useVersion = () => useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb) }, () => version)

export const db = {
  all: <T = any,>(sql: string, params: any[] = []): Promise<T[]> => window.api.db.all(sql, params),
  get: <T = any,>(sql: string, params: any[] = []): Promise<T | null> => window.api.db.get(sql, params),
  async run(sql: string, params: any[] = []) {
    const r = await window.api.db.run(sql, params)
    bump()
    return r
  },
  async batch(statements: { sql: string; params?: any[] }[]) {
    const r = await window.api.db.batch(statements)
    bump()
    return r
  },
  async insert(table: string, data: Record<string, any>): Promise<number> {
    const keys = Object.keys(data)
    const r = await db.run(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`, keys.map((k) => data[k]))
    return r.lastInsertRowid
  },
  async update(table: string, id: number, data: Record<string, any>) {
    const keys = Object.keys(data)
    await db.run(`UPDATE ${table} SET ${keys.map((k) => `${k}=?`).join(',')} WHERE id=?`, [...keys.map((k) => data[k]), id])
  },
  async remove(table: string, id: number) {
    await db.run(`DELETE FROM ${table} WHERE id=?`, [id])
  },
  audit: (action: string, entity: string, detail = '') => window.api.audit(action, entity, detail).catch(() => {}),
}

export function useQuery<T = any>(sql: string, params: any[] = [], enabled = true) {
  const v = useVersion()
  const [rows, setRows] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const key = sql + JSON.stringify(params)
  useEffect(() => {
    if (!enabled) { setRows([]); setLoading(false); return }
    let live = true
    window.api.db.all(sql, params)
      .then((r: T[]) => { if (live) { setRows(r); setLoading(false) } })
      .catch((e: Error) => { console.error(e); if (live) setLoading(false) })
    return () => { live = false }
  }, [v, key, enabled])
  return { rows, loading }
}

/* ---------- configurações ---------- */
export interface Hours { [day: string]: { open: boolean; start: string; end: string } }
export interface Settings {
  shop_name: string; shop_logo: string; shop_phone: string; shop_address: string
  hours: Hours; slot_interval: number; capacity: number; vaccine_alert_days: number; demo_loaded: boolean
}
const DEFAULT_HOURS: Hours = Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [d, { open: d >= 1 && d <= 6, start: '08:00', end: '18:00' }]))

export function useSettings(): Settings {
  const { rows } = useQuery<{ key: string; value: string }>('SELECT key, value FROM settings')
  return useMemo(() => {
    const m: Record<string, string> = {}
    rows.forEach((r) => (m[r.key] = r.value))
    let hours = DEFAULT_HOURS
    try { if (m.hours) hours = JSON.parse(m.hours) } catch {}
    return {
      shop_name: m.shop_name || 'Caramelo Molhado Pet Shop Inc.',
      shop_logo: m.shop_logo || '',
      shop_phone: m.shop_phone || '',
      shop_address: m.shop_address || '',
      hours,
      slot_interval: Number(m.slot_interval) || 30,
      capacity: Number(m.capacity) || 1,
      vaccine_alert_days: Number(m.vaccine_alert_days) || 30,
      demo_loaded: m.demo_loaded === '1',
    }
  }, [rows])
}
export const saveSetting = (key: string, value: any) =>
  db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, typeof value === 'string' ? value : JSON.stringify(value)])

/* ---------- contexto do app ---------- */
export interface User {
  id: number; name: string; username: string; role: 'admin' | 'employee'; job_title?: string; photo?: string | null
  email?: string; phone?: string; birth_date?: string; created_at?: string; permissions: Record<string, boolean>; must_change_password?: number
}
type ToastKind = 'ok' | 'error' | 'info'
interface Ctx {
  user: User
  setUser: (u: User | null) => void
  can: (perm: string) => boolean
  isAdmin: boolean
  page: Page
  params: any
  go: (page: Page, params?: any) => void
  toast: (msg: string, kind?: ToastKind) => void
  confirm: (o: { title: string; message: string; confirmLabel?: string; danger?: boolean }) => Promise<boolean>
  settings: Settings
}
const AppCtx = createContext<Ctx>(null as any)
export const useApp = () => useContext(AppCtx)

export function AppProvider({ user, setUser, children }: { user: User; setUser: (u: User | null) => void; children: React.ReactNode }) {
  const [page, setPage] = useState<Page>('dashboard')
  const [params, setParams] = useState<any>({})
  const [toasts, setToasts] = useState<{ id: number; msg: string; kind: ToastKind }[]>([])
  const [dialog, setDialog] = useState<any>(null)
  const settings = useSettings()

  const go = useCallback((p: Page, pr: any = {}) => { setPage(p); setParams({ ...pr, _t: Date.now() }) }, [])
  const toast = useCallback((msg: string, kind: ToastKind = 'ok') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, msg, kind }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 6000 : 3200)
  }, [])
  const confirm = useCallback((o: any) => new Promise<boolean>((resolve) => setDialog({ ...o, resolve })), [])
  const isAdmin = user.role === 'admin'
  const can = useCallback((perm: string) => isAdmin || !!user.permissions?.[perm], [isAdmin, user])

  const value = useMemo(() => ({ user, setUser, can, isAdmin, page, params, go, toast, confirm, settings }), [user, setUser, can, isAdmin, page, params, go, toast, confirm, settings])

  return (
    <AppCtx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-6 right-6 z-[70] flex flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className={cls('pointer-events-auto flex max-w-sm animate-slide items-center gap-2.5 rounded-2xl px-4 py-3 text-sm font-semibold text-white shadow-lift', t.kind === 'ok' ? 'bg-leaf-600' : t.kind === 'error' ? 'bg-red-500' : 'bg-ink')}>
            {t.kind === 'ok' ? <CheckCircle2 size={18} /> : t.kind === 'error' ? <XCircle size={18} /> : <Info size={18} />}
            {t.msg}
          </div>
        ))}
      </div>
      <ConfirmDialog
        open={!!dialog}
        title={dialog?.title || ''}
        message={dialog?.message || ''}
        confirmLabel={dialog?.confirmLabel}
        danger={dialog?.danger}
        onResult={(ok) => { dialog?.resolve(ok); setDialog(null) }}
      />
    </AppCtx.Provider>
  )
}

/* Executa uma ação assíncrona mostrando erro amigável */
export function useAction() {
  const { toast } = useApp()
  return useCallback(async <T,>(fn: () => Promise<T>, okMsg?: string): Promise<T | undefined> => {
    try {
      const r = await fn()
      if (okMsg) toast(okMsg)
      return r
    } catch (e: any) {
      toast(e?.message?.replace(/^Error invoking remote method '[^']+': Error: /, '') || 'Algo deu errado. Tente novamente.', 'error')
      return undefined
    }
  }, [toast])
}
