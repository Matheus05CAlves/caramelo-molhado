import { useEffect, useMemo, useState } from 'react'
import { Lock, Phone, Plus } from 'lucide-react'
import { TONES, statusTone } from '../lib/domain'
import { Appt, Exception, blockAt, dayRange, isOpenAt } from '../lib/schedule'
import type { Hours } from '../lib/store'
import { WEEKDAYS_SHORT, cls, endTime, fromMin, parseISO, todayISO, toMin } from '../lib/util'

const ROW = 54 // altura (px) de cada intervalo da agenda

interface Props {
  days: string[]
  appts: Appt[]
  exceptions: Exception[]
  hours: Hours
  interval: number
  capacity: number
  canCreate: boolean
  showCancelled?: boolean
  onSlot: (date: string, time: string) => void
  onAppt: (id: number) => void
}

function layout(list: Appt[]) {
  // distribui atendimentos simultâneos lado a lado
  const sorted = [...list].sort((a, b) => toMin(a.start_time) - toMin(b.start_time))
  const lanes: number[] = []
  const out = sorted.map((a) => {
    const s = toMin(a.start_time)
    let lane = lanes.findIndex((end) => end <= s)
    if (lane === -1) { lane = lanes.length; lanes.push(0) }
    lanes[lane] = s + a.duration_min
    return { a, lane }
  })
  return out.map((o) => {
    const s = toMin(o.a.start_time), e = s + o.a.duration_min
    const group = out.filter((p) => toMin(p.a.start_time) < e && toMin(p.a.start_time) + p.a.duration_min > s)
    return { ...o, total: Math.max(...group.map((g) => g.lane)) + 1 }
  })
}

export function AgendaGrid({ days, appts, exceptions, hours, interval, capacity, canCreate, showCancelled, onSlot, onAppt }: Props) {
  const [now, setNow] = useState(new Date())
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(t) }, [])
  const today = todayISO()

  const { start, end } = useMemo(() => {
    let s = Infinity, e = -Infinity
    for (const d of days) {
      const r = dayRange(d, hours, exceptions)
      if (r.open) { s = Math.min(s, r.start); e = Math.max(e, r.end) }
      for (const a of appts.filter((x) => x.date === d)) { s = Math.min(s, toMin(a.start_time)); e = Math.max(e, toMin(a.start_time) + a.duration_min) }
    }
    if (!isFinite(s)) { s = 8 * 60; e = 18 * 60 }
    s = Math.floor(s / interval) * interval
    e = Math.ceil(e / interval) * interval
    return { start: s, end: e }
  }, [days, appts, exceptions, hours, interval])

  const rows = Math.max(1, Math.round((end - start) / interval))
  const height = rows * ROW
  const labels = Array.from({ length: rows }, (_, i) => start + i * interval)
  const single = days.length === 1

  return (
    <div className="overflow-x-auto rounded-2xl border border-paper-line bg-white"><div className="min-w-[640px]">
      <div className="grid border-b border-paper-line bg-paper/60" style={{ gridTemplateColumns: `64px repeat(${days.length}, minmax(0, 1fr))` }}>
        <div />
        {days.map((d) => {
          const dt = parseISO(d)
          const r = dayRange(d, hours, exceptions)
          const isToday = d === today
          return (
            <div key={d} className="border-l border-paper-line px-3 py-3 text-center">
              <p className={cls('text-xs font-semibold', isToday ? 'text-brand-600' : 'text-ink-muted')}>{WEEKDAYS_SHORT[dt.getDay()]}</p>
              <p className={cls('mx-auto mt-0.5 grid h-8 w-8 place-items-center rounded-full text-base font-extrabold', isToday ? 'bg-brand-500 text-white' : 'text-ink')}>{dt.getDate()}</p>
              {!r.open && <p className="mt-0.5 text-[11px] font-semibold text-ink-muted">Fechado</p>}
            </div>
          )
        })}
      </div>

      <div className="max-h-[560px] overflow-y-auto">
        <div className="grid" style={{ gridTemplateColumns: `64px repeat(${days.length}, minmax(0, 1fr))` }}>
          <div className="relative" style={{ height }}>
            {labels.map((m, i) => (
              <span key={m} className="absolute right-3 -translate-y-1/2 text-[11px] font-semibold text-ink-muted" style={{ top: i * ROW + (i === 0 ? 8 : 0) }}>{fromMin(m)}</span>
            ))}
          </div>

          {days.map((d) => {
            const dayAppts = appts.filter((a) => a.date === d && (showCancelled || a.status !== 'Cancelado'))
            const active = appts.filter((a) => a.date === d && a.status !== 'Cancelado')
            const placed = layout(dayAppts)
            const nowMin = now.getHours() * 60 + now.getMinutes()
            return (
              <div key={d} className="relative border-l border-paper-line" style={{ height }}>
                {labels.map((m, i) => {
                  const open = isOpenAt(d, m, m + interval, hours, exceptions)
                  const blk = blockAt(d, m, m + interval, exceptions)
                  const used = active.filter((a) => toMin(a.start_time) <= m && m < toMin(a.start_time) + a.duration_min).length
                  const full = used >= capacity
                  const past = d < today || (d === today && m + interval <= nowMin)
                  const free = open && !blk && !full
                  return (
                    <button
                      key={m}
                      disabled={!canCreate || !free}
                      onClick={() => onSlot(d, fromMin(m))}
                      aria-label={free ? `Novo agendamento em ${d} às ${fromMin(m)}` : undefined}
                      style={{ top: i * ROW, height: ROW }}
                      className={cls('group absolute inset-x-0 border-t border-paper-line/80 text-left transition',
                        !open && 'bg-[repeating-linear-gradient(135deg,#F5F6F8,#F5F6F8_6px,#EEF0F3_6px,#EEF0F3_12px)]',
                        blk && 'bg-[repeating-linear-gradient(135deg,#FDECEC,#FDECEC_6px,#FBDCDC_6px,#FBDCDC_12px)]',
                        free && canCreate && 'hover:bg-brand-50', free && past && 'bg-gray-50/70')}
                    >
                      {blk && <span className="flex items-center gap-1 px-2 pt-1 text-[11px] font-semibold text-red-600"><Lock size={11} />{blk.reason || 'Bloqueado'}</span>}
                      {free && canCreate && <span className="hidden h-full items-center justify-center text-brand-500 group-hover:flex"><Plus size={18} /></span>}
                    </button>
                  )
                })}

                {placed.map(({ a, lane, total }) => {
                  const tone = TONES[statusTone(a.status)]
                  const top = ((toMin(a.start_time) - start) / interval) * ROW
                  const h = (a.duration_min / interval) * ROW - 3
                  return (
                    <button
                      key={a.id}
                      onClick={() => onAppt(a.id)}
                      style={{ top: top + 1, height: h, left: `calc(${(lane / total) * 100}% + 3px)`, width: `calc(${100 / total}% - 6px)`, background: tone.soft, borderLeft: `4px solid ${tone.ring}` }}
                      className={cls('absolute z-10 overflow-hidden rounded-xl px-2.5 py-1.5 text-left shadow-sm ring-1 ring-black/5 transition hover:z-20 hover:shadow-lift', a.status === 'Cancelado' && 'opacity-60')}
                      title={`${a.pet_name} · ${a.service_name} · ${a.status}`}
                    >
                      <p className={cls('truncate text-[13px] font-extrabold leading-tight text-ink', a.status === 'Cancelado' && 'line-through')}>{a.pet_name}</p>
                      <p className="truncate text-[11.5px] font-semibold leading-tight" style={{ color: tone.ring }}>{a.service_name}</p>
                      {h > 70 && <p className="mt-0.5 truncate text-[11px] text-ink-soft">{a.start_time}–{endTime(a.start_time, a.duration_min)} · {a.client_name}</p>}
                      {h > 100 && a.client_phone && <p className="flex items-center gap-1 truncate text-[11px] text-ink-muted"><Phone size={10} />{a.client_phone}</p>}
                      {h > 130 && single && <p className="mt-0.5 text-[11px] font-semibold text-ink-soft">{a.status}</p>}
                    </button>
                  )
                })}

                {d === today && nowMin >= start && nowMin <= end && (
                  <div className="pointer-events-none absolute inset-x-0 z-20" style={{ top: ((nowMin - start) / interval) * ROW }}>
                    <div className="relative h-0.5 bg-red-500"><span className="absolute -left-1 -top-[3px] h-2 w-2 rounded-full bg-red-500" /></div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
    </div>
  )
}

export function StatusLegend() {
  const items: [string, keyof typeof TONES][] = [['Confirmado', 'green'], ['Aguardando', 'orange'], ['Em atendimento', 'blue'], ['Pronto p/ retirada', 'purple'], ['Cancelado', 'red']]
  return (
    <div className="flex flex-wrap items-center gap-4">
      {items.map(([l, t]) => (
        <span key={l} className="flex items-center gap-1.5 text-xs font-semibold text-ink-soft"><span className={cls('h-2.5 w-2.5 rounded-full', TONES[t].solid)} />{l}</span>
      ))}
    </div>
  )
}
