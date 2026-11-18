import { useEffect, useMemo, useState } from 'react'
import { Bath, CalendarClock, CalendarPlus, ChevronLeft, ChevronRight, Clock, Droplets, Ear, Eye, EyeOff, Hand, Scissors, Settings2, Sparkles, Wallet, PawPrint, CheckCircle2, Hourglass } from 'lucide-react'
import { Badge, Button, Card, Empty, PetAvatar, Segmented } from '../components/ui'
import { AgendaGrid, StatusLegend } from '../components/AgendaGrid'
import { AppointmentDetail, AppointmentForm, Preset } from '../components/AppointmentModals'
import { ScheduleManager } from '../components/ScheduleModals'
import { Mascot } from '../components/Mascot'
import { useApp, useQuery } from '../lib/store'
import { APPT_SELECT } from '../lib/appointments'
import { READY, WAITING, statusTone } from '../lib/domain'
import { addDays, brl, cls, endTime, fmtDate, longDate, startOfWeek, todayISO, toMin } from '../lib/util'

const iconFor = (name: string) => {
  const n = name.toLowerCase()
  if (n.includes('banho')) return Bath
  if (n.includes('tosa')) return Scissors
  if (n.includes('unha')) return Hand
  if (n.includes('ouvido')) return Ear
  if (n.includes('hidrata')) return Droplets
  return Sparkles
}

export default function Dashboard() {
  const { user, can, settings } = useApp()
  const [view, setView] = useState<'day' | 'week'>('week')
  const [anchor, setAnchor] = useState(todayISO())
  const [showCancelled, setShowCancelled] = useState(false)
  const [form, setForm] = useState<{ open: boolean; appt?: any; preset?: Preset; mode?: 'edit' | 'reschedule' }>({ open: false })
  const [detail, setDetail] = useState<number | null>(null)
  const [schedule, setSchedule] = useState(false)
  const today = todayISO()

  const days = useMemo(() => {
    if (view === 'day') return [anchor]
    const mon = startOfWeek(anchor)
    return [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(mon, i)).filter((d, i) => i < 6 || settings.hours['0']?.open || d === anchor)
  }, [view, anchor, settings.hours])

  const range = [days[0], days[days.length - 1]]
  const appts = useQuery(`${APPT_SELECT} WHERE a.date BETWEEN ? AND ? ORDER BY a.start_time`, range).rows
  const exceptions = useQuery('SELECT * FROM schedule_exceptions WHERE date BETWEEN ? AND ?', range).rows
  const todays = useQuery(`${APPT_SELECT} WHERE a.date=? AND a.status<>'Cancelado' ORDER BY a.start_time`, [today]).rows
  const upcoming = useQuery(`${APPT_SELECT} WHERE a.status IN ('Agendado','Confirmado','Aguardando chegada') AND (a.date>? OR (a.date=? AND a.start_time>=?)) ORDER BY a.date, a.start_time LIMIT 8`, [today, today, new Date().toTimeString().slice(0, 5)]).rows
  const services = useQuery('SELECT * FROM services WHERE active=1 ORDER BY sort, name LIMIT 6').rows

  const stats = useMemo(() => ({
    baths: todays.filter((a: any) => a.category === 'Banho').length,
    grooms: todays.filter((a: any) => a.category === 'Tosa').length,
    waiting: todays.filter((a: any) => WAITING.includes(a.status)).length,
    inService: todays.filter((a: any) => a.status === 'Em atendimento').length,
    ready: todays.filter((a: any) => READY.includes(a.status)).length,
    revenue: todays.filter((a: any) => ['Finalizado', 'Aguardando retirada', 'Entregue'].includes(a.status)).reduce((s: number, a: any) => s + (a.price || 0), 0),
  }), [todays])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'
  const step = view === 'day' ? 1 : 7
  const canCreate = can('appointments_edit')
  const title = view === 'day' ? longDate(anchor) : `${fmtDate(days[0]).slice(0, 5)} a ${fmtDate(days[days.length - 1]).slice(0, 5)}`

  const cards = [
    { label: 'Banhos hoje', value: stats.baths, icon: Bath, tint: 'bg-blue-50 text-blue-600' },
    { label: 'Tosas hoje', value: stats.grooms, icon: Scissors, tint: 'bg-purple-50 text-purple-600' },
    { label: 'Aguardando atendimento', value: stats.waiting, icon: Hourglass, tint: 'bg-brand-50 text-brand-600' },
    { label: 'Em atendimento', value: stats.inService, icon: PawPrint, tint: 'bg-blue-50 text-blue-600' },
    { label: 'Prontos para retirada', value: stats.ready, icon: CheckCircle2, tint: 'bg-leaf-50 text-leaf-600' },
    ...(can('revenue_view') ? [{ label: 'Faturamento do dia', value: brl(stats.revenue), icon: Wallet, tint: 'bg-leaf-50 text-leaf-600' }] : []),
  ]

  return (
    <div className="space-y-7">
      {/* banner */}
      <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-r from-brand-500 to-brand-400 px-6 py-6 text-white shadow-soft sm:px-9 sm:py-8">
        <div className="absolute -right-10 -top-16 h-72 w-72 rounded-full bg-white/10" />
        <div className="absolute bottom-[-90px] right-44 h-52 w-52 rounded-full bg-white/10" />
        <div className="relative z-10 flex items-center justify-between gap-6">
          <div>
            <p className="text-sm font-semibold text-white/85">{greeting}, {user.name.split(' ')[0]}!</p>
            <h1 className="mt-1 max-w-xl text-[22px] font-extrabold leading-tight tracking-tight sm:text-[30px]">
              {todays.length === 0 ? 'Nenhum atendimento marcado para hoje.' : `Hoje tem ${todays.length} ${todays.length === 1 ? 'atendimento' : 'atendimentos'} na agenda.`}
            </h1>
            <p className="mt-1.5 text-[15px] text-white/85">{stats.waiting} aguardando · {stats.inService} em atendimento · {stats.ready} {stats.ready === 1 ? 'pronto' : 'prontos'} para retirada</p>
            {canCreate && <button onClick={() => setForm({ open: true, preset: { date: today } })} className="mt-5 inline-flex items-center gap-2 rounded-full bg-yellow-300 px-6 py-3 text-sm font-extrabold text-ink shadow-[0_10px_24px_-10px_rgba(0,0,0,.45)] transition hover:scale-[1.03] active:scale-95"><CalendarPlus size={18} />Novo agendamento</button>}
          </div>
          <Mascot size={150} className="hidden drop-shadow-[0_14px_20px_rgba(150,60,0,.35)] sm:block" />
        </div>
      </div>

      {/* resumo do dia */}
      <div className={cls('m-two grid gap-3 sm:gap-4', cards.length === 6 ? 'grid-cols-6' : 'grid-cols-5')}>
        {cards.map((c) => (
          <Card key={c.label} className="p-4">
            <span className={cls('mb-3 grid h-10 w-10 place-items-center rounded-2xl', c.tint)}><c.icon size={20} /></span>
            <p className="text-[26px] font-extrabold leading-none tracking-tight">{c.value}</p>
            <p className="mt-1.5 text-xs font-semibold text-ink-muted">{c.label}</p>
          </Card>
        ))}
      </div>

      {/* atalhos de serviço, no estilo das categorias do app de referência */}
      {canCreate && services.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-extrabold">Agendar rápido</h2></div>
          <div className="flex gap-5 overflow-x-auto pb-1">
            {services.map((s: any) => {
              const Icon = iconFor(s.name)
              return (
                <button key={s.id} onClick={() => setForm({ open: true, preset: { date: today, serviceId: s.id } })} className="group flex w-[104px] shrink-0 flex-col items-center gap-2">
                  <span className="grid h-[76px] w-[76px] place-items-center rounded-full border border-paper-line bg-white text-brand-600 shadow-soft transition group-hover:-translate-y-0.5 group-hover:border-brand-300 group-hover:bg-brand-50"><Icon size={30} /></span>
                  <span className="text-center text-[13px] font-semibold leading-tight text-ink-soft">{s.name}</span>
                </button>
              )
            })}
          </div>
        </section>
      )}

      {/* próximos agendamentos */}
      <section>
        <h2 className="mb-3 text-lg font-extrabold">Próximos agendamentos</h2>
        {upcoming.length === 0 ? <Card><Empty icon={CalendarClock} title="Nada marcado para os próximos dias" text="Clique em um horário livre da agenda para criar um agendamento." /></Card> : (
          <div className="flex gap-4 overflow-x-auto pb-2">
            {upcoming.map((a: any) => (
              <button key={a.id} onClick={() => setDetail(a.id)} className="w-[250px] shrink-0 rounded-3xl border border-paper-line/70 bg-white p-4 text-left shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift">
                <div className="flex items-center justify-between">
                  <Badge tone="orange"><Clock size={12} />{a.date === today ? 'Hoje' : fmtDate(a.date).slice(0, 5)} · {a.start_time}</Badge>
                  <Badge tone={statusTone(a.status)} dot>{a.status}</Badge>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <PetAvatar src={a.pet_photo} name={a.pet_name} size={52} />
                  <div className="min-w-0"><p className="truncate text-[15px] font-extrabold">{a.pet_name}</p><p className="truncate text-xs text-ink-muted">{a.client_name}</p></div>
                </div>
                <div className="mt-3 flex items-end justify-between">
                  <div><p className="text-sm font-bold">{a.service_name}</p><p className="text-xs text-ink-muted">Saída prevista {endTime(a.start_time, a.duration_min)}</p></div>
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-500 text-white"><ChevronRight size={17} /></span>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* agenda */}
      <section>
        <Card className="p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold">Agenda</h2>
              <p className="text-sm text-ink-muted">Clique em um horário livre para agendar, ou em um atendimento para ver detalhes.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Segmented value={view} onChange={setView} options={[{ value: 'day', label: 'Dia' }, { value: 'week', label: 'Semana' }]} />
              <div className="flex items-center gap-1 rounded-xl bg-paper p-1">
                <button onClick={() => setAnchor(addDays(anchor, -step))} aria-label="Anterior" className="grid h-8 w-8 place-items-center rounded-lg hover:bg-white"><ChevronLeft size={18} /></button>
                <button onClick={() => setAnchor(today)} className="rounded-lg px-3 py-1.5 text-[13px] font-semibold hover:bg-white">Hoje</button>
                <button onClick={() => setAnchor(addDays(anchor, step))} aria-label="Próximo" className="grid h-8 w-8 place-items-center rounded-lg hover:bg-white"><ChevronRight size={18} /></button>
              </div>
              <span className="min-w-36 text-center text-sm font-bold">{title}</span>
              <Button variant="ghost" size="sm" icon={showCancelled ? EyeOff : Eye} onClick={() => setShowCancelled((s) => !s)}>{showCancelled ? 'Ocultar cancelados' : 'Mostrar cancelados'}</Button>
              {can('schedule_edit') && <Button variant="secondary" size="sm" icon={Settings2} onClick={() => setSchedule(true)}>Horários da agenda</Button>}
            </div>
          </div>
          <div className="mb-3"><StatusLegend /></div>
          <AgendaGrid days={days} appts={appts as any} exceptions={exceptions as any} hours={settings.hours} interval={settings.slot_interval} capacity={settings.capacity} canCreate={canCreate} showCancelled={showCancelled}
            onSlot={(date, time) => setForm({ open: true, preset: { date, time } })} onAppt={setDetail} />
        </Card>
      </section>

      <AppointmentForm open={form.open} appt={form.appt} preset={form.preset} mode={form.mode} onClose={() => setForm({ open: false })} />
      {detail && <AppointmentDetail id={detail} onClose={() => setDetail(null)} onEdit={(appt, mode) => { setDetail(null); setForm({ open: true, appt, mode }) }} />}
      <ScheduleManager open={schedule} onClose={() => setSchedule(false)} />
    </div>
  )
}
