import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import { Crosshair, ExternalLink, MapPinOff, Route, WifiOff } from 'lucide-react'
import { Badge, Button, Card, Empty, PageHeader, Select } from '../components/ui'
import { useAction, useApp, useQuery } from '../lib/store'
import { fullAddress, geocodeClient } from '../lib/geo'
import { addressLine, cls, mapsLink, todayISO } from '../lib/util'

type Filter = 'all' | 'pickup' | 'delivery' | 'today'
const COLORS = { pickup: '#2F7DE1', delivery: '#1FA971', today: '#FF7A1A', none: '#8B93A1' }
const esc = (s: any) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))

export default function MapPage() {
  const { settings, params, toast } = useApp()
  const run = useAction()
  const mapEl = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const layer = useRef<L.LayerGroup | null>(null)
  const markers = useRef<Record<number, L.Marker>>({})
  const [filter, setFilter] = useState<Filter>('all')
  const [hood, setHood] = useState('')
  const [offline, setOffline] = useState(false)
  const [progress, setProgress] = useState<string>('')
  const today = todayISO()

  const clients = useQuery(`SELECT c.*, (SELECT GROUP_CONCAT(p.name, ', ') FROM pets p WHERE p.client_id=c.id) AS pet_names FROM clients c ORDER BY c.name`).rows
  const appts = useQuery(`SELECT client_id, pickup, delivery, status, start_time, service_name FROM appointments WHERE date=? AND status<>'Cancelado'`, [today]).rows

  const info = useMemo(() => {
    const m: Record<number, { pickup: boolean; delivery: boolean; today: boolean; lines: string[] }> = {}
    for (const a of appts as any[]) {
      const e = (m[a.client_id] ||= { pickup: false, delivery: false, today: false, lines: [] })
      e.today = true
      e.lines.push(`${a.start_time} · ${a.service_name} (${a.status})`)
      if (a.pickup && ['Agendado', 'Confirmado', 'Aguardando chegada'].includes(a.status)) e.pickup = true
      if (a.delivery && ['Finalizado', 'Aguardando retirada'].includes(a.status)) e.delivery = true
    }
    return m
  }, [appts])

  const neighborhoods = useMemo(() => [...new Set((clients as any[]).map((c) => c.neighborhood).filter(Boolean))].sort() as string[], [clients])
  const located = (clients as any[]).filter((c) => c.lat != null && c.lng != null)
  const missing = (clients as any[]).filter((c) => (c.lat == null || c.lng == null) && (c.street || c.cep))
  const shown = useMemo(() => located.filter((c) => {
    const i = info[c.id]
    if (hood && c.neighborhood !== hood) return false
    if (filter === 'pickup') return i?.pickup
    if (filter === 'delivery') return i?.delivery
    if (filter === 'today') return i?.today
    return true
  }), [located, info, filter, hood])

  /* cria o mapa uma vez */
  useEffect(() => {
    if (!mapEl.current || map.current) return
    const m = L.map(mapEl.current, { zoomControl: true }).setView([-23.5505, -46.6333], 12)
    const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; Colaboradores do <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>' }).addTo(m)
    let errors = 0
    tiles.on('tileerror', () => { errors++; if (errors > 3) setOffline(true) })
    tiles.on('tileload', () => { errors = 0; setOffline(false) })
    layer.current = L.layerGroup().addTo(m)
    map.current = m
    setTimeout(() => m.invalidateSize(), 150)
    return () => { m.remove(); map.current = null }
  }, [])

  /* desenha os marcadores conforme filtros */
  useEffect(() => {
    const m = map.current, lg = layer.current
    if (!m || !lg) return
    lg.clearLayers()
    markers.current = {}
    shown.forEach((c: any) => {
      const i = info[c.id]
      const color = i?.pickup ? COLORS.pickup : i?.delivery ? COLORS.delivery : i?.today ? COLORS.today : COLORS.none
      const tag = i?.pickup ? 'B' : i?.delivery ? 'E' : (c.name || '?')[0].toUpperCase()
      const icon = L.divIcon({ className: '', html: `<div class="pin" style="background:${color}"><span>${esc(tag)}</span></div>`, iconSize: [38, 38], iconAnchor: [19, 38], popupAnchor: [0, -36] })
      const mk = L.marker([c.lat, c.lng], { icon, title: c.name }).addTo(lg)
      mk.bindPopup(`
        <div style="padding:16px 18px 14px;font-family:inherit">
          <p style="margin:0;font-weight:800;font-size:15px;color:#2A2F38">${esc(c.name)}</p>
          <p style="margin:4px 0 0;font-size:12.5px;color:#7A8391">🐾 ${esc(c.pet_names || 'Sem pets cadastrados')}</p>
          <p style="margin:10px 0 0;font-size:13px;color:#4B5360">${esc(addressLine(c))}</p>
          ${c.reference ? `<p style="margin:2px 0 0;font-size:12px;color:#7A8391">Ref.: ${esc(c.reference)}</p>` : ''}
          <p style="margin:6px 0 0;font-size:13px;font-weight:700;color:#2A2F38">📞 ${esc(c.phone || '—')}</p>
          ${i ? `<div style="margin-top:8px;padding:8px 10px;border-radius:10px;background:#FFF5EB;font-size:12px;color:#C75000;font-weight:600">${i.lines.map(esc).join('<br/>')}</div>` : ''}
          <button data-route="${c.id}" style="margin-top:12px;width:100%;border:0;border-radius:12px;background:#FF7A1A;color:#fff;font-weight:700;font-size:13px;padding:10px;cursor:pointer">Abrir rota no Google Maps</button>
        </div>`)
      mk.on('popupopen', (e: any) => {
        e.popup.getElement()?.querySelector('[data-route]')?.addEventListener('click', () => window.api.app.openExternal(mapsLink(fullAddress(c), settings.shop_address || undefined)))
      })
      markers.current[c.id] = mk
    })
    if (shown.length) m.fitBounds(L.latLngBounds(shown.map((c: any) => [c.lat, c.lng] as [number, number])), { padding: [60, 60], maxZoom: 15 })
  }, [shown, info, settings.shop_address])

  /* foco vindo da ficha do cliente */
  useEffect(() => {
    if (!params?.clientId) return
    const t = setTimeout(() => { const mk = markers.current[params.clientId]; if (mk && map.current) { map.current.setView(mk.getLatLng(), 16); mk.openPopup() } }, 350)
    return () => clearTimeout(t)
  }, [params, shown])

  const locateAll = async () => {
    let ok = 0, notFound = 0, failed = 0
    for (let n = 0; n < missing.length; n++) {
      setProgress(`Localizando ${n + 1} de ${missing.length}...`)
      const r = await geocodeClient(missing[n].id, missing[n])
      r === 'ok' ? ok++ : r === 'notfound' ? notFound++ : failed++
      if (r === 'error') break
    }
    setProgress('')
    if (failed) toast('Sem conexão com o serviço de mapas. Verifique a internet e tente de novo.', 'error')
    else toast(`${ok} endereço(s) localizado(s)${notFound ? `, ${notFound} não encontrado(s). Confira CEP e número.` : '.'}`, notFound ? 'info' : 'ok')
  }

  const routeStops = shown.filter((c: any) => info[c.id]?.pickup || info[c.id]?.delivery)
  const openDayRoute = () => {
    const stops = routeStops.slice(0, 10).map((c: any) => fullAddress(c))
    if (!stops.length) return toast('Nenhuma coleta ou entrega pendente hoje neste filtro.', 'info')
    const dest = stops[stops.length - 1]
    window.api.app.openExternal(mapsLink(dest, settings.shop_address || undefined, stops.slice(0, -1)))
    if (routeStops.length > 10) toast('O Google Maps aceita até 10 paradas por rota. As primeiras 10 foram enviadas.', 'info')
  }

  const filters: [Filter, string, number][] = [
    ['all', 'Todos', located.length],
    ['pickup', 'Precisam de busca', located.filter((c: any) => info[c.id]?.pickup).length],
    ['delivery', 'Aguardando entrega', located.filter((c: any) => info[c.id]?.delivery).length],
    ['today', 'Agendamento hoje', located.filter((c: any) => info[c.id]?.today).length],
  ]

  return (
    <>
      <PageHeader title="Mapa de Clientes" subtitle="Coleta e entrega com base nos endereços cadastrados.">
        <Button icon={Route} onClick={openDayRoute} disabled={!routeStops.length}>Abrir rota do dia ({routeStops.length})</Button>
      </PageHeader>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {filters.map(([v, l, n]) => (
          <button key={v} onClick={() => setFilter(v)} className={cls('rounded-full px-4 py-2 text-[13px] font-semibold transition', filter === v ? 'bg-brand-500 text-white shadow-sm' : 'bg-white text-ink-soft ring-1 ring-paper-line hover:ring-brand-300')}>{l} · {n}</button>
        ))}
        <Select className="ml-2 w-56" value={hood} onChange={setHood} options={neighborhoods} placeholder="Todos os bairros" />
        <div className="ml-auto flex items-center gap-3 text-xs font-semibold text-ink-soft">
          {[['Busca', COLORS.pickup], ['Entrega', COLORS.delivery], ['Agenda hoje', COLORS.today], ['Cliente', COLORS.none]].map(([l, c]) => <span key={l} className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full" style={{ background: c }} />{l}</span>)}
        </div>
      </div>

      <div className="m-stack grid grid-cols-[320px_1fr] gap-5">
        <Card className="flex h-[calc(100vh-290px)] min-h-[480px] flex-col p-4">
          <p className="mb-2 px-1 text-sm font-extrabold">{shown.length} {shown.length === 1 ? 'cliente' : 'clientes'} no mapa</p>
          <div className="flex-1 space-y-1 overflow-y-auto">
            {shown.length === 0 && <Empty icon={Crosshair} title="Nenhum cliente neste filtro" text="Mude o filtro ou o bairro para ver outros clientes." />}
            {shown.map((c: any) => {
              const i = info[c.id]
              return (
                <button key={c.id} onClick={() => { const mk = markers.current[c.id]; if (mk && map.current) { map.current.setView(mk.getLatLng(), 16); mk.openPopup() } }} className="w-full rounded-2xl px-3 py-2.5 text-left transition hover:bg-paper">
                  <span className="flex items-center justify-between gap-2"><span className="truncate text-sm font-bold">{c.name}</span>{i?.pickup && <Badge tone="blue">Busca</Badge>}{i?.delivery && <Badge tone="green">Entrega</Badge>}</span>
                  <span className="block truncate text-xs text-ink-muted">{c.pet_names || 'Sem pets'} · {c.neighborhood || 'sem bairro'}</span>
                </button>
              )
            })}
          </div>
          {(missing.length > 0 || (clients as any[]).some((c) => !c.street && !c.cep)) && (
            <div className="mt-3 rounded-2xl bg-brand-50 p-3.5">
              <p className="flex items-center gap-2 text-[13px] font-bold text-brand-700"><MapPinOff size={16} />{missing.length} cliente(s) sem localização</p>
              <p className="mt-0.5 text-xs text-ink-soft">O mapa só mostra endereços reais. Clientes sem endereço completo não aparecem.</p>
              {missing.length > 0 && <Button className="mt-2.5 w-full" size="sm" onClick={() => run(locateAll)} loading={!!progress}>{progress || 'Localizar endereços agora'}</Button>}
            </div>
          )}
        </Card>
        <div className="relative">
          <div ref={mapEl} className="h-[calc(100vh-290px)] min-h-[480px] w-full overflow-hidden rounded-3xl border border-paper-line shadow-soft" />
          {offline && <div className="absolute left-16 top-4 z-[500] flex items-center gap-2 rounded-xl bg-white px-3.5 py-2 text-xs font-bold text-red-600 shadow-lift"><WifiOff size={15} />Sem internet: o fundo do mapa não carrega, mas os marcadores continuam aqui.</div>}
        </div>
      </div>
    </>
  )
}
