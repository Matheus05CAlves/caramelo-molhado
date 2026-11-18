import { useEffect, useRef, useState } from 'react'
import { Bell, BadgeCheck, CalendarCheck, CheckCheck, HeartHandshake, LayoutDashboard, LogOut, MapPinned, Menu, PawPrint, Search, Settings as Cog, Smartphone, UserRound, Users, X } from 'lucide-react'
import { bump, db, useApp, useQuery } from '../lib/store'
import { cls, fmtDateTime, longDate, todayISO } from '../lib/util'
import type { Page } from '../lib/domain'
import { Avatar, PetAvatar } from './ui'
import { LogoMark } from './Mascot'
import { clientSearch } from '../lib/search'

const NAV: { page: Page; label: string; icon: any; perm?: string; admin?: boolean }[] = [
  { page: 'dashboard', label: 'Dashboard / Agenda', icon: LayoutDashboard },
  { page: 'pets', label: 'Pets', icon: PawPrint },
  { page: 'clients', label: 'Clientes', icon: Users },
  { page: 'appointments', label: 'Agendamentos', icon: CalendarCheck },
  { page: 'requests', label: 'Pedidos pelo App', icon: Smartphone },
  { page: 'adoption', label: 'Adoção e Doações', icon: HeartHandshake },
  { page: 'map', label: 'Mapa de Clientes', icon: MapPinned, perm: 'map_view' },
  { page: 'staff', label: 'Funcionários', icon: BadgeCheck, admin: true },
  { page: 'profile', label: 'Meu Perfil', icon: UserRound },
  { page: 'settings', label: 'Configurações', icon: Cog, admin: true },
]

export function Sidebar({ open, onClose }: { open?: boolean; onClose?: () => void }) {
  const { page, go, user, setUser, can, isAdmin, settings } = useApp()
  const pending = useQuery("SELECT COUNT(*) AS n FROM appointments WHERE origin='app' AND status='Agendado' AND date>=?", [todayISO()]).rows[0]?.n || 0
  const logout = async () => {
    await window.api.auth.logout().catch(() => {})
    setUser(null)
  }
  return (
    <>
    {open && <div className="fixed inset-0 z-40 animate-fade bg-ink/40 lg:hidden" onClick={onClose} />}
    <aside className={cls('fixed inset-y-0 left-0 z-50 flex h-full w-[264px] shrink-0 flex-col border-r border-paper-line bg-white px-4 pb-5 pt-[max(1.25rem,env(safe-area-inset-top))] transition-transform lg:static lg:translate-x-0', open ? 'translate-x-0 shadow-lift' : '-translate-x-full')}>
      <div className="mb-7 flex items-center gap-3 px-2">
        <LogoMark size={46} src={settings.shop_logo} />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-[15px] font-extrabold text-ink">{settings.shop_name.replace(/ Pet Shop Inc\.?/i, '')}</p>
          <p className="text-xs font-semibold text-brand-600">Pet Shop Inc.</p>
        </div>
        <button onClick={onClose} aria-label="Fechar menu" className="grid h-9 w-9 place-items-center rounded-xl text-ink-muted hover:bg-paper lg:hidden"><X size={20} /></button>
      </div>
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto" aria-label="Menu principal">
        {NAV.filter((n) => (!n.admin || isAdmin) && (!n.perm || can(n.perm))).map((n) => {
          const active = page === n.page
          return (
            <button
              key={n.page}
              onClick={() => go(n.page)}
              aria-current={active ? 'page' : undefined}
              className={cls('flex items-center gap-3 rounded-2xl px-3.5 py-3 text-left text-sm font-semibold transition', active ? 'bg-brand-500 text-white shadow-[0_10px_20px_-10px_rgba(255,122,26,.9)]' : 'text-ink-soft hover:bg-paper')}
            >
              <n.icon size={19} />
              <span className="flex-1">{n.label}</span>
              {n.page === 'requests' && pending > 0 && <span className={cls('grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] font-bold', active ? 'bg-white text-brand-600' : 'bg-brand-500 text-white')}>{pending}</span>}
            </button>
          )
        })}
      </nav>
      <div className="mt-4 flex items-center gap-3 rounded-2xl bg-paper p-3">
        <Avatar src={user.photo} name={user.name} size={40} />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm font-bold text-ink">{user.name}</p>
          <p className="truncate text-xs text-ink-muted">{user.role === 'admin' ? 'Administrador' : user.job_title || 'Funcionário'}</p>
        </div>
        <button onClick={logout} title="Sair da conta" aria-label="Sair da conta" className="grid h-9 w-9 place-items-center rounded-xl text-ink-muted transition hover:bg-white hover:text-red-500">
          <LogOut size={18} />
        </button>
      </div>
    </aside>
    </>
  )
}

function GlobalSearch() {
  const { go } = useApp()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const term = `%${q.trim()}%`
  const enabled = q.trim().length >= 2
  const cs = clientSearch(q, 'c')
  const clients = useQuery(`SELECT c.id, c.name, c.phone FROM clients c WHERE ${cs.where} ORDER BY c.name LIMIT 5`, cs.params, enabled)
  const pets = useQuery('SELECT p.id, p.name, p.photo, p.breed, c.name AS tutor FROM pets p JOIN clients c ON c.id=p.client_id WHERE p.name LIKE ? ORDER BY p.name LIMIT 5', [term], enabled)

  useEffect(() => {
    const h = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  const pick = (page: Page, params: any) => { setOpen(false); setQ(''); go(page, params) }
  const none = enabled && !clients.rows.length && !pets.rows.length

  return (
    <div ref={ref} className="relative w-full max-w-md">
      <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted" />
      <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true) }} onFocus={() => setOpen(true)} placeholder="Buscar cliente, CPF, telefone ou pet" className="w-full rounded-2xl border border-paper-line bg-white py-3 pl-11 pr-4 text-sm shadow-sm transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100" />
      {open && enabled && (
        <div className="absolute left-0 right-0 top-full z-40 mt-2 animate-pop overflow-hidden rounded-2xl border border-paper-line bg-white p-2 shadow-lift">
          {clients.rows.map((c: any) => (
            <button key={'c' + c.id} onClick={() => pick('clients', { clientId: c.id })} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-paper">
              <Avatar name={c.name} size={34} />
              <span className="min-w-0"><span className="block truncate text-sm font-bold">{c.name}</span><span className="block text-xs text-ink-muted">Cliente · {c.phone || 'sem telefone'}</span></span>
            </button>
          ))}
          {pets.rows.map((p: any) => (
            <button key={'p' + p.id} onClick={() => pick('pets', { petId: p.id })} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-paper">
              <PetAvatar src={p.photo} name={p.name} size={34} rounded="rounded-full" />
              <span className="min-w-0"><span className="block truncate text-sm font-bold">{p.name}</span><span className="block truncate text-xs text-ink-muted">Pet · {p.breed || 'sem raça'} · tutor {p.tutor}</span></span>
            </button>
          ))}
          {none && <p className="px-3 py-4 text-center text-sm text-ink-muted">Nada encontrado para “{q}”.</p>}
        </div>
      )}
    </div>
  )
}

function Notifications() {
  const { go } = useApp()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { rows } = useQuery('SELECT * FROM notifications ORDER BY id DESC LIMIT 40')
  const unread = rows.filter((n: any) => !n.read).length
  useEffect(() => {
    const h = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  const dot: Record<string, string> = { app: 'bg-leaf-500', vacina: 'bg-red-500', retirada: 'bg-purple-500', lembrete: 'bg-blue-500', agenda: 'bg-brand-500', cancelamento: 'bg-red-500', horario: 'bg-yellow-500' }
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-label="Notificações" className="relative grid h-11 w-11 place-items-center rounded-2xl border border-paper-line bg-white text-ink-soft shadow-sm transition hover:text-brand-600">
        <Bell size={20} />
        {unread > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-brand-500 px-1 text-[11px] font-bold text-white">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 w-[min(380px,calc(100vw-2rem))] animate-pop overflow-hidden rounded-3xl border border-paper-line bg-white shadow-lift">
          <div className="flex items-center justify-between border-b border-paper-line px-5 py-3.5">
            <p className="font-extrabold">Notificações</p>
            <button disabled={!unread} onClick={() => db.run('UPDATE notifications SET read=1 WHERE read=0')} className="flex items-center gap-1.5 text-xs font-semibold text-brand-600 disabled:text-ink-muted"><CheckCheck size={15} />Marcar todas como lidas</button>
          </div>
          <div className="max-h-[420px] overflow-y-auto p-2">
            {rows.length === 0 && <p className="px-4 py-10 text-center text-sm text-ink-muted">Nenhum aviso por enquanto.</p>}
            {rows.map((n: any) => (
              <button key={n.id} onClick={() => { db.run('UPDATE notifications SET read=1 WHERE id=?', [n.id]); setOpen(false); if (n.link_page) go(n.link_page) }} className={cls('flex w-full gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-paper', !n.read && 'bg-brand-50/60')}>
                <span className={cls('mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full', n.read ? 'bg-gray-300' : dot[n.type] || 'bg-brand-500')} />
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-ink">{n.title}</span>
                  {n.body && <span className="block text-[13px] text-ink-soft">{n.body}</span>}
                  <span className="mt-0.5 block text-xs text-ink-muted">{fmtDateTime(n.created_at)}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function Topbar({ onMenu }: { onMenu?: () => void }) {
  return (
    <header className="flex items-center justify-between gap-3 px-4 pb-2 pt-[max(1rem,env(safe-area-inset-top))] lg:gap-6 lg:px-8 lg:pt-6">
      <button onClick={onMenu} aria-label="Abrir menu" className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-paper-line bg-white text-ink-soft shadow-sm lg:hidden"><Menu size={20} /></button>
      <GlobalSearch />
      <div className="flex items-center gap-4">
        <p className="hidden text-sm font-semibold text-ink-muted lg:block">{longDate(todayISO())}</p>
        <Notifications />
      </div>
    </header>
  )
}
