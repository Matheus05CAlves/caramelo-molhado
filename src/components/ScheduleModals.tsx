import { useEffect, useState } from 'react'
import { Lock, Plus, Sun, Trash2 } from 'lucide-react'
import { Badge, Button, Empty, IconButton, Input, Modal, Select, Tabs, Toggle } from './ui'
import { Hours, db, saveSetting, useAction, useApp, useQuery } from '../lib/store'
import { notify } from '../lib/notify'
import { WEEKDAYS, fmtDate, todayISO, toMin } from '../lib/util'

export function HoursEditor() {
  const { settings, toast } = useApp()
  const run = useAction()
  const [hours, setHours] = useState<Hours>(settings.hours)
  const [interval, setInterval_] = useState(String(settings.slot_interval))
  const [capacity, setCapacity] = useState(String(settings.capacity))
  useEffect(() => { setHours(settings.hours); setInterval_(String(settings.slot_interval)); setCapacity(String(settings.capacity)) }, [settings.hours, settings.slot_interval, settings.capacity])
  const upd = (d: number, patch: any) => setHours((h) => ({ ...h, [d]: { ...h[d], ...patch } }))

  const save = async () => {
    for (const d of [1, 2, 3, 4, 5, 6, 0]) if (hours[d].open && toMin(hours[d].end) <= toMin(hours[d].start)) return toast(`${WEEKDAYS[d]}: o fechamento precisa ser depois da abertura.`, 'error')
    const cap = Math.max(1, Math.min(20, Number(capacity) || 1))
    await run(async () => {
      await saveSetting('hours', hours); await saveSetting('slot_interval', interval); await saveSetting('capacity', String(cap))
      await db.audit('Alterou horários de funcionamento', 'Agenda', '')
      await notify('horario', 'Horários de funcionamento alterados', 'Confira a agenda antes de agendar novos atendimentos.', 'dashboard')
    }, 'Horários salvos.')
  }
  return (
    <div>
      <div className="divide-y divide-paper-line rounded-2xl border border-paper-line">
        {[1, 2, 3, 4, 5, 6, 0].map((d) => (
          <div key={d} className="flex items-center gap-4 px-5 py-3">
            <div className="w-40"><Toggle checked={hours[d]?.open} onChange={(v) => upd(d, { open: v })} label={WEEKDAYS[d]} /></div>
            {hours[d]?.open ? (
              <div className="flex items-center gap-3"><Input type="time" value={hours[d].start} onChange={(v) => upd(d, { start: v })} aria-label="Abertura" /><span className="text-ink-muted">até</span><Input type="time" value={hours[d].end} onChange={(v) => upd(d, { end: v })} aria-label="Fechamento" /></div>
            ) : <span className="text-sm text-ink-muted">Fechado</span>}
          </div>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <Select label="Intervalo da agenda" value={interval} onChange={setInterval_} options={[{ value: '15', label: '15 minutos' }, { value: '30', label: '30 minutos' }, { value: '60', label: '1 hora' }]} />
        <Input label="Atendimentos simultâneos" type="number" min={1} max={20} value={capacity} onChange={setCapacity} hint="1 = nunca dois pets no mesmo horário. Aumente se houver mais de um banhista." />
      </div>
      <div className="mt-5 flex justify-end"><Button onClick={save}>Salvar horários</Button></div>
    </div>
  )
}

export function ExceptionsManager() {
  const run = useAction()
  const { toast, user } = useApp()
  const { rows } = useQuery('SELECT * FROM schedule_exceptions WHERE date >= ? ORDER BY date, start_time', [todayISO()])
  const [f, setF] = useState({ date: todayISO(), start_time: '12:00', end_time: '13:00', kind: 'block', reason: '' })
  const set = (k: string) => (v: string) => setF((s) => ({ ...s, [k]: v }))
  const add = async () => {
    if (!f.date) return toast('Escolha a data.', 'error')
    if (toMin(f.end_time) <= toMin(f.start_time)) return toast('O fim precisa ser depois do início.', 'error')
    await run(async () => {
      await db.insert('schedule_exceptions', { ...f, created_by: user.id })
      await db.audit(f.kind === 'block' ? 'Bloqueou horário' : 'Abriu horário extra', 'Agenda', `${fmtDate(f.date)} ${f.start_time}-${f.end_time} ${f.reason}`)
      await notify('horario', f.kind === 'block' ? 'Horário bloqueado na agenda' : 'Horário extra aberto na agenda', `${fmtDate(f.date)}, ${f.start_time} às ${f.end_time}${f.reason ? ` · ${f.reason}` : ''}.`, 'dashboard')
      setF((s) => ({ ...s, reason: '' }))
    }, f.kind === 'block' ? 'Horário bloqueado.' : 'Horário extra aberto.')
  }
  return (
    <div>
      <div className="m-stack grid grid-cols-6 items-end gap-3 rounded-2xl bg-paper p-4">
        <Select className="col-span-2" label="O que fazer" value={f.kind} onChange={set('kind')} options={[{ value: 'block', label: 'Bloquear horário' }, { value: 'extra', label: 'Abrir horário extra' }]} />
        <Input className="col-span-2" label="Data" type="date" value={f.date} onChange={set('date')} />
        <Input label="Início" type="time" value={f.start_time} onChange={set('start_time')} />
        <Input label="Fim" type="time" value={f.end_time} onChange={set('end_time')} />
        <Input className="col-span-4" label="Motivo (opcional)" value={f.reason} onChange={set('reason')} placeholder="Ex.: almoço, manutenção, mutirão de sábado" />
        <Button className="col-span-2" icon={Plus} onClick={add}>Adicionar</Button>
      </div>
      <div className="mt-4">
        {rows.length === 0 ? <Empty icon={Lock} title="Nenhum bloqueio ou horário extra" text="Bloqueie um período (almoço, feriado) ou abra um horário fora do expediente." /> : rows.map((e: any) => (
          <div key={e.id} className="flex items-center gap-3 border-b border-paper-line py-2.5 last:border-0">
            <span className={`grid h-9 w-9 place-items-center rounded-xl ${e.kind === 'block' ? 'bg-red-50 text-red-500' : 'bg-leaf-50 text-leaf-600'}`}>{e.kind === 'block' ? <Lock size={17} /> : <Sun size={17} />}</span>
            <div className="flex-1 text-sm"><b>{fmtDate(e.date)}</b> · {e.start_time} às {e.end_time}{e.reason && <span className="text-ink-muted"> · {e.reason}</span>}</div>
            <Badge tone={e.kind === 'block' ? 'red' : 'green'}>{e.kind === 'block' ? 'Bloqueado' : 'Horário extra'}</Badge>
            <IconButton icon={Trash2} tone="danger" label="Remover" onClick={() => run(async () => { await db.remove('schedule_exceptions', e.id); await db.audit('Removeu bloqueio/horário extra', 'Agenda', fmtDate(e.date)) }, 'Removido.')} />
          </div>
        ))}
      </div>
    </div>
  )
}

export function ScheduleManager({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<'hours' | 'blocks'>('blocks')
  return (
    <Modal open={open} onClose={onClose} size="lg" title="Horários da agenda" subtitle="Altere o expediente, bloqueie períodos ou abra horários extras.">
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'blocks', label: 'Bloqueios e horários extras' }, { value: 'hours', label: 'Horário de funcionamento' }]} />
      <div className="pt-5">{tab === 'hours' ? <HoursEditor /> : <ExceptionsManager />}</div>
    </Modal>
  )
}
