import { useEffect, useMemo, useState } from 'react'
import { Ban, CalendarClock, CalendarPlus, Pencil } from 'lucide-react'
import { Badge, Button, Card, Empty, IconButton, Input, PageHeader, PetAvatar, SearchInput, Select, Spinner, Tabs } from '../components/ui'
import { AppointmentDetail, AppointmentForm, Preset } from '../components/AppointmentModals'
import { ServicesManager } from '../components/ServicesManager'
import { db, useAction, useApp, useQuery } from '../lib/store'
import { APPT_SELECT, changeStatus } from '../lib/appointments'
import { STATUSES, statusTone } from '../lib/domain'
import { addDays, brl, endTime, fmtDate, todayISO, WEEKDAYS_SHORT, parseISO } from '../lib/util'

export default function Appointments() {
  const { can, params, confirm } = useApp()
  const run = useAction()
  const [tab, setTab] = useState<'list' | 'services'>('list')
  const [from, setFrom] = useState(todayISO())
  const [to, setTo] = useState(addDays(todayISO(), 14))
  const [status, setStatus] = useState('')
  const [q, setQ] = useState('')
  const [form, setForm] = useState<{ open: boolean; appt?: any; preset?: Preset; mode?: 'edit' | 'reschedule' }>({ open: false })
  const [detail, setDetail] = useState<number | null>(null)
  const canEdit = can('appointments_edit')

  useEffect(() => { // vindo da ficha de um cliente ou pet
    if (params?.newFor && canEdit) { setTab('list'); setForm({ open: true, preset: { clientId: params.newFor.clientId, petId: params.newFor.petId } }) }
  }, [params]) // eslint-disable-line

  const { rows, loading } = useQuery(`${APPT_SELECT} WHERE a.date BETWEEN ? AND ? ORDER BY a.date, a.start_time`, [from, to])
  const list = useMemo(() => {
    const t = q.trim().toLowerCase()
    return rows.filter((a: any) => (!status || a.status === status) && (!t || [a.pet_name, a.client_name, a.service_name, a.employee_name].some((x) => (x || '').toLowerCase().includes(t))))
  }, [rows, status, q])
  const total = list.filter((a: any) => a.status !== 'Cancelado').reduce((s: number, a: any) => s + (a.price || 0), 0)

  const cancel = async (a: any) => {
    if (!(await confirm({ title: 'Cancelar este agendamento?', message: `${a.pet_name} · ${a.service_name} em ${fmtDate(a.date)} às ${a.start_time}.`, confirmLabel: 'Cancelar agendamento', danger: true }))) return
    run(() => changeStatus(a, 'Cancelado'), 'Agendamento cancelado.')
  }

  return (
    <>
      <PageHeader title="Agendamentos" subtitle="Banho, tosa e demais serviços">
        {canEdit && tab === 'list' && <Button icon={CalendarPlus} onClick={() => setForm({ open: true })}>Novo agendamento</Button>}
      </PageHeader>
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'list', label: 'Agendamentos' }, { value: 'services', label: 'Serviços e preços' }]} />
      <div className="pt-6">
        {tab === 'services' ? <ServicesManager /> : (
          <>
            <div className="mb-5 flex flex-wrap items-end gap-3">
              <Input label="De" type="date" value={from} onChange={setFrom} className="w-44" />
              <Input label="Até" type="date" value={to} onChange={setTo} className="w-44" />
              <Select label="Status" value={status} onChange={setStatus} options={STATUSES.map((s) => s.name)} placeholder="Todos" className="w-52" />
              <div className="min-w-64 flex-1"><span className="mb-1.5 block text-[13px] font-semibold text-ink-soft">Buscar</span><SearchInput value={q} onChange={setQ} placeholder="Pet, tutor, serviço ou funcionário" /></div>
              <div className="flex gap-1.5 pb-0.5">
                <Button variant="secondary" size="sm" onClick={() => { setFrom(todayISO()); setTo(todayISO()) }}>Hoje</Button>
                <Button variant="secondary" size="sm" onClick={() => { setFrom(todayISO()); setTo(addDays(todayISO(), 7)) }}>7 dias</Button>
                <Button variant="secondary" size="sm" onClick={() => { setFrom(addDays(todayISO(), -30)); setTo(todayISO()) }}>Últimos 30</Button>
              </div>
            </div>
            <Card className="overflow-hidden">
              {loading ? <Spinner /> : list.length === 0 ? <Empty icon={CalendarClock} title="Nenhum agendamento neste período" text="Ajuste as datas ou os filtros, ou crie um novo agendamento." action={canEdit && <Button icon={CalendarPlus} onClick={() => setForm({ open: true })}>Novo agendamento</Button>} /> : (
                <table className="w-full text-sm">
                  <thead className="bg-paper text-left text-xs font-semibold text-ink-muted"><tr><th className="px-5 py-3">Data e hora</th><th>Pet</th><th>Tutor</th><th>Serviço</th><th>Responsável</th><th>Valor</th><th>Status</th><th /></tr></thead>
                  <tbody>
                    {list.map((a: any) => {
                      const d = parseISO(a.date)
                      return (
                        <tr key={a.id} onClick={() => setDetail(a.id)} className="cursor-pointer border-t border-paper-line transition hover:bg-brand-50/40">
                          <td className="px-5 py-3"><p className="font-bold">{WEEKDAYS_SHORT[d.getDay()]}, {fmtDate(a.date).slice(0, 5)}</p><p className="text-xs text-ink-muted">{a.start_time} às {endTime(a.start_time, a.duration_min)}</p></td>
                          <td><span className="flex items-center gap-2.5"><PetAvatar src={a.pet_photo} name={a.pet_name} size={34} rounded="rounded-xl" /><b>{a.pet_name}</b></span></td>
                          <td><p>{a.client_name}</p><p className="text-xs text-ink-muted">{a.client_phone}</p></td>
                          <td>{a.service_name}{a.origin === 'app' && <Badge tone="green" className="ml-1.5">App</Badge>}</td><td className="text-ink-soft">{a.employee_name || '—'}</td><td className="font-semibold">{brl(a.price)}</td>
                          <td onClick={(e) => e.stopPropagation()}>
                            {canEdit ? (
                              <select value={a.status} onChange={(e) => e.target.value === 'Cancelado' ? cancel(a) : run(() => changeStatus(a, e.target.value), `Status: ${e.target.value}`)} aria-label="Alterar status" className="cursor-pointer rounded-full border-0 bg-paper py-1.5 pl-3 pr-2 text-xs font-bold text-ink focus:outline-none focus:ring-2 focus:ring-brand-200">
                                {STATUSES.map((s) => <option key={s.name}>{s.name}</option>)}
                              </select>
                            ) : <Badge tone={statusTone(a.status)} dot>{a.status}</Badge>}
                          </td>
                          <td className="pr-3 text-right" onClick={(e) => e.stopPropagation()}>
                            {canEdit && a.status !== 'Cancelado' && <span className="inline-flex"><IconButton icon={CalendarClock} label="Remarcar" onClick={() => setForm({ open: true, appt: a, mode: 'reschedule' })} /><IconButton icon={Pencil} label="Editar" onClick={() => setForm({ open: true, appt: a, mode: 'edit' })} /><IconButton icon={Ban} tone="danger" label="Cancelar" onClick={() => cancel(a)} /></span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot><tr className="border-t border-paper-line bg-paper/60 text-xs font-semibold text-ink-soft"><td className="px-5 py-3" colSpan={5}>{list.length} {list.length === 1 ? 'agendamento' : 'agendamentos'} (exceto cancelados no valor)</td><td colSpan={3} className="font-extrabold text-ink">{can('revenue_view') ? `Total previsto ${brl(total)}` : ''}</td></tr></tfoot>
                </table>
              )}
            </Card>
          </>
        )}
      </div>
      <AppointmentForm open={form.open} appt={form.appt} preset={form.preset} mode={form.mode} onClose={() => setForm({ open: false })} />
      {detail && <AppointmentDetail id={detail} onClose={() => setDetail(null)} onEdit={(appt, mode) => { setDetail(null); setForm({ open: true, appt, mode }) }} />}
    </>
  )
}
