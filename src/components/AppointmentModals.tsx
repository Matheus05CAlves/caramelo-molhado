import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CalendarClock, MessageCircle, PawPrint, Plus, ShieldAlert, Trash2 } from 'lucide-react'
import { Badge, Button, Input, Modal, PetAvatar, Select, Textarea, Toggle, InfoRow } from './ui'
import { ClientPicker } from './ClientModals'
import { PetForm } from './PetModals'
import { db, useAction, useApp, useQuery } from '../lib/store'
import { APPT_SELECT, NEXT_STATUS, changeStatus } from '../lib/appointments'
import { notify } from '../lib/notify'
import { checkConflict, startOptions } from '../lib/schedule'
import { STATUSES, statusTone } from '../lib/domain'
import { brl, cls, endTime, fmtDate, longDate, todayISO, waLink } from '../lib/util'

export interface Preset { date?: string; time?: string; clientId?: number | null; petId?: number | null; serviceId?: number | null }

export function useEmployees() {
  const [list, setList] = useState<any[]>([])
  useEffect(() => { window.api.users.list().then((r: any[]) => setList(r.filter((u) => u.active))).catch(() => {}) }, [])
  return list
}

export function AppointmentForm({ open, onClose, appt, preset, mode = 'edit', onSaved }: { open: boolean; onClose: () => void; appt?: any; preset?: Preset; mode?: 'edit' | 'reschedule'; onSaved?: (id: number) => void }) {
  const { user, isAdmin, settings, toast, can } = useApp()
  const run = useAction()
  const employees = useEmployees()
  const [f, setF] = useState<any>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [petForm, setPetForm] = useState(false)
  const [busy, setBusy] = useState(false)
  const set = (k: string) => (v: any) => setF((s: any) => ({ ...s, [k]: v }))

  useEffect(() => {
    if (!open) return
    setErrors({})
    if (appt) setF({ ...appt, override: 0 })
    else setF({ client_id: preset?.clientId || null, pet_id: preset?.petId || null, service_id: preset?.serviceId || '', date: preset?.date || todayISO(), start_time: preset?.time || '', employee_id: user.id, notes: '', price: '', duration_min: 30, pickup: 0, delivery: 0, override: 0 })
  }, [open, appt, preset, user.id])

  const services = useQuery('SELECT * FROM services WHERE active=1 ORDER BY sort, name', [], open).rows
  const pets = useQuery('SELECT id, name, breed FROM pets WHERE client_id=? ORDER BY name', [f.client_id || 0], open && !!f.client_id).rows
  const dayAppts = useQuery('SELECT id, date, start_time, duration_min, status, pet_id, employee_id FROM appointments WHERE date=?', [f.date || ''], open && !!f.date).rows
  const exceptions = useQuery('SELECT * FROM schedule_exceptions WHERE date=?', [f.date || ''], open && !!f.date).rows

  // ao escolher o serviço, preenche duração e preço padrão
  const pickService = (id: string) => {
    const s: any = services.find((x: any) => String(x.id) === id)
    setF((st: any) => ({ ...st, service_id: id, duration_min: s ? s.duration_min : st.duration_min, price: s ? s.price : st.price, start_time: appt ? st.start_time : '' }))
  }
  useEffect(() => { // pré-seleção vinda do atalho de serviço
    if (open && !appt && preset?.serviceId && services.length && f.service_id === preset.serviceId) pickService(String(preset.serviceId))
  }, [open, services.length]) // eslint-disable-line

  const duration = Number(f.duration_min) || 30
  const options = useMemo(
    () => (f.date && f.pet_id ? startOptions(f.date, duration, f.pet_id, f.employee_id ? Number(f.employee_id) : null, dayAppts as any, settings.hours, exceptions as any, settings.capacity, settings.slot_interval, appt?.id) : []),
    [f.date, f.pet_id, f.employee_id, duration, dayAppts, exceptions, settings, appt?.id],
  )
  const conflicts = useMemo(
    () => (f.date && f.start_time && f.pet_id ? checkConflict({ date: f.date, start_time: f.start_time, duration_min: duration, pet_id: f.pet_id, employee_id: f.employee_id ? Number(f.employee_id) : null, ignoreId: appt?.id }, dayAppts as any, settings.hours, exceptions as any, settings.capacity) : []),
    [f.date, f.start_time, f.pet_id, f.employee_id, duration, dayAppts, exceptions, settings, appt?.id],
  )
  const freeCount = options.filter((o) => !o.msgs.length).length

  const save = async () => {
    const er: Record<string, string> = {}
    if (!f.client_id) er.client_id = 'Selecione o cliente.'
    if (!f.pet_id) er.pet_id = 'Selecione o cachorro.'
    if (!f.service_id) er.service_id = 'Selecione o serviço.'
    if (!f.date) er.date = 'Escolha a data.'
    if (!f.start_time) er.start_time = 'Escolha o horário.'
    if (!f.employee_id) er.employee_id = 'Escolha o funcionário responsável.'
    setErrors(er)
    if (Object.keys(er).length) return toast('Confira os campos destacados.', 'error')
    setBusy(true)
    const ok = await run(async () => {
      // confere de novo no banco, caso outro agendamento tenha sido criado enquanto o formulário estava aberto
      const fresh = await db.all('SELECT id, date, start_time, duration_min, status, pet_id, employee_id FROM appointments WHERE date=?', [f.date])
      const exc = await db.all('SELECT * FROM schedule_exceptions WHERE date=?', [f.date])
      const msgs = checkConflict({ date: f.date, start_time: f.start_time, duration_min: duration, pet_id: f.pet_id, employee_id: Number(f.employee_id), ignoreId: appt?.id }, fresh as any, settings.hours, exc as any, settings.capacity)
      const exception = msgs.length > 0
      if (exception && !(isAdmin && f.override)) throw new Error(msgs[0] + (isAdmin ? ' Marque "Autorizar exceção" para agendar mesmo assim.' : ' Peça a um administrador para autorizar uma exceção.'))
      const svc: any = services.find((s: any) => String(s.id) === String(f.service_id))
      const data: any = {
        client_id: f.client_id, pet_id: f.pet_id, service_id: Number(f.service_id), service_name: svc?.name ?? f.service_name, category: svc?.category ?? f.category,
        employee_id: Number(f.employee_id), date: f.date, start_time: f.start_time, duration_min: duration, price: Number(String(f.price).replace(',', '.')) || 0,
        notes: f.notes || '', pickup: f.pickup ? 1 : 0, delivery: f.delivery ? 1 : 0, override: exception ? 1 : 0, updated_at: new Date().toISOString().slice(0, 16).replace('T', ' '),
      }
      const petName = (pets.find((p: any) => p.id === f.pet_id) as any)?.name || appt?.pet_name || 'Pet'
      if (appt) {
        await db.update('appointments', appt.id, data)
        await db.audit(mode === 'reschedule' ? 'Remarcou agendamento' : 'Editou agendamento', 'Agendamento', `${petName} · ${fmtDate(f.date)} ${f.start_time}${exception ? ' (exceção autorizada)' : ''}`)
        if (appt.date !== f.date || appt.start_time !== f.start_time) await notify('horario', `Agendamento remarcado: ${petName}`, `${data.service_name}: ${fmtDate(appt.date)} ${appt.start_time} → ${fmtDate(f.date)} ${f.start_time}.`, 'appointments')
        return appt.id
      }
      const id = await db.insert('appointments', { ...data, status: 'Agendado', created_by: user.id })
      await db.audit('Criou agendamento', 'Agendamento', `${petName} · ${data.service_name} · ${fmtDate(f.date)} ${f.start_time}${exception ? ' (exceção autorizada)' : ''}`)
      await notify('agenda', `Novo agendamento: ${petName}`, `${data.service_name} em ${fmtDate(f.date)} às ${f.start_time}.`, 'appointments')
      return id
    }, mode === 'reschedule' ? 'Agendamento remarcado.' : appt ? 'Agendamento atualizado.' : 'Agendamento criado.')
    setBusy(false)
    if (ok) { onSaved?.(ok); onClose() }
  }

  const title = mode === 'reschedule' ? 'Remarcar agendamento' : appt ? 'Editar agendamento' : 'Novo agendamento'
  const timeOptions = options.map((o) => ({ value: o.time, label: `${o.time} às ${endTime(o.time, duration)}${o.msgs.length ? '  ·  indisponível' : ''}`, disabled: o.msgs.length > 0 && !isAdmin && o.time !== appt?.start_time }))
  if (f.start_time && !timeOptions.some((o) => o.value === f.start_time)) timeOptions.unshift({ value: f.start_time, label: `${f.start_time} (atual)`, disabled: false })

  return (
    <>
      <Modal open={open} onClose={onClose} size="lg" title={title} subtitle={appt && mode === 'reschedule' ? `Atual: ${fmtDate(appt.date)} às ${appt.start_time}` : 'Escolha cliente, pet, serviço e um horário livre.'}
        footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button onClick={save} loading={busy}>{mode === 'reschedule' ? 'Confirmar nova data' : 'Salvar agendamento'}</Button></>}>
        <div className="m-stack grid grid-cols-2 gap-x-5 gap-y-4">
          <ClientPicker value={f.client_id} onChange={(id) => setF((s: any) => ({ ...s, client_id: id, pet_id: null }))} error={errors.client_id} />
          <div>
            <div className="flex items-end gap-2">
              <Select className="flex-1" label="Cachorro" required value={f.pet_id} onChange={(v) => set('pet_id')(v ? Number(v) : null)} error={errors.pet_id} disabled={!f.client_id}
                options={pets.map((p: any) => ({ value: p.id, label: `${p.name}${p.breed ? ` · ${p.breed}` : ''}` }))} placeholder={f.client_id ? (pets.length ? 'Selecione o cachorro' : 'Cliente sem pets') : 'Escolha o cliente primeiro'} />
              {f.client_id && can('pets_edit') && <Button variant="soft" className="mb-px !px-3" onClick={() => setPetForm(true)} title="Cadastrar novo pet" aria-label="Cadastrar novo pet"><Plus size={18} /></Button>}
            </div>
          </div>
          <Select label="Serviço" required value={f.service_id} onChange={pickService} error={errors.service_id} placeholder="Selecione o serviço"
            options={services.map((s: any) => ({ value: s.id, label: `${s.name} · ${s.duration_min} min · ${brl(s.price)}` }))} />
          <Select label="Funcionário responsável" required value={f.employee_id} onChange={set('employee_id')} error={errors.employee_id} placeholder="Selecione"
            options={employees.map((u: any) => ({ value: u.id, label: `${u.name}${u.job_title ? ` · ${u.job_title}` : ''}` }))} />
          <Input label="Data" type="date" required value={f.date} onChange={(v) => setF((s: any) => ({ ...s, date: v, start_time: '' }))} error={errors.date} hint={f.date ? longDate(f.date) : undefined} />
          <Select label="Horário" required value={f.start_time} onChange={set('start_time')} error={errors.start_time} disabled={!f.pet_id || !f.date}
            placeholder={!f.pet_id ? 'Escolha o pet primeiro' : timeOptions.length ? `${freeCount} horário(s) livre(s)` : 'Agenda fechada neste dia'} options={timeOptions}
            hint={f.start_time ? `Saída prevista às ${endTime(f.start_time, duration)}` : undefined} />

          {conflicts.length > 0 && (
            <div className="col-span-2 rounded-2xl border border-red-200 bg-red-50 p-4">
              <div className="flex gap-3">
                <ShieldAlert className="mt-0.5 shrink-0 text-red-500" size={20} />
                <div className="flex-1 text-sm">
                  <p className="font-bold text-red-700">Este horário não está disponível</p>
                  <ul className="mt-1 list-disc pl-4 text-red-700">{conflicts.map((m) => <li key={m}>{m}</li>)}</ul>
                  {isAdmin ? <div className="mt-2"><Toggle checked={!!f.override} onChange={(v) => set('override')(v ? 1 : 0)} label="Autorizar exceção de administrador" hint="Agenda mesmo com o conflito. A exceção fica registrada." /></div>
                    : <p className="mt-2 text-red-600">Escolha outro horário ou peça a um administrador para autorizar uma exceção.</p>}
                </div>
              </div>
            </div>
          )}

          <Input label="Duração (minutos)" type="number" min={10} step={5} value={f.duration_min} onChange={set('duration_min')} hint="Preenchida pelo serviço; ajuste se este atendimento for diferente." />
          <Input label="Valor (R$)" inputMode="decimal" value={f.price} onChange={set('price')} />
          <div className="col-span-2 grid grid-cols-2 gap-x-5 rounded-2xl bg-paper px-5 py-2">
            <Toggle checked={!!f.pickup} onChange={(v) => set('pickup')(v ? 1 : 0)} label="Busca" hint="Coletar o pet na casa do cliente" />
            <Toggle checked={!!f.delivery} onChange={(v) => set('delivery')(v ? 1 : 0)} label="Entrega" hint="Levar o pet de volta para casa" />
          </div>
          <Textarea className="col-span-2" label="Observações" value={f.notes} onChange={set('notes')} placeholder="Ex.: cuidado com as orelhas, cliente pediu laço azul" rows={2} />
        </div>
      </Modal>
      <PetForm open={petForm} clientId={f.client_id} onClose={() => setPetForm(false)} onSaved={(id) => setF((s: any) => ({ ...s, pet_id: id }))} />
    </>
  )
}

export function AppointmentDetail({ id, onClose, onEdit }: { id: number; onClose: () => void; onEdit: (appt: any, mode: 'edit' | 'reschedule') => void }) {
  const { can, confirm, go } = useApp()
  const run = useAction()
  const a: any = useQuery(`${APPT_SELECT} WHERE a.id=?`, [id]).rows[0]
  const [staffNotes, setStaffNotes] = useState('')
  useEffect(() => { if (a) setStaffNotes(a.staff_notes || '') }, [a?.id, a?.staff_notes])
  if (!a) return null
  const canEdit = can('appointments_edit')
  const next = NEXT_STATUS[a.status]

  const setStatus = async (s: string) => {
    if (s === a.status) return
    if (s === 'Cancelado' && !(await confirm({ title: 'Cancelar este agendamento?', message: `${a.pet_name} · ${a.service_name} em ${fmtDate(a.date)} às ${a.start_time}. O horário ficará livre na agenda.`, confirmLabel: 'Cancelar agendamento', danger: true }))) return
    run(() => changeStatus(a, s), s === 'Cancelado' ? 'Agendamento cancelado.' : `Status: ${s}`)
  }
  const saveNotes = () => run(async () => { await db.update('appointments', a.id, { staff_notes: staffNotes }); await db.audit('Registrou observação de atendimento', 'Agendamento', a.pet_name) }, 'Observação salva.')
  const del = async () => {
    if (!(await confirm({ title: 'Excluir agendamento?', message: 'Isso apaga o registro do histórico do pet. Para apenas liberar o horário, prefira cancelar.', confirmLabel: 'Excluir', danger: true }))) return
    run(async () => { await db.remove('appointments', a.id); await db.audit('Excluiu agendamento', 'Agendamento', a.pet_name); onClose() }, 'Agendamento excluído.')
  }

  return (
    <Modal open onClose={onClose} size="lg" title="Atendimento" subtitle={`${longDate(a.date)} · ${a.start_time} às ${endTime(a.start_time, a.duration_min)}`}
      footer={canEdit && <>
        {can('delete_records') && <Button variant="danger" icon={Trash2} onClick={del} className="mr-auto">Excluir</Button>}
        {a.status !== 'Cancelado' && <Button variant="secondary" icon={CalendarClock} onClick={() => onEdit(a, 'reschedule')}>Remarcar</Button>}
        <Button variant="secondary" onClick={() => onEdit(a, 'edit')}>Editar dados</Button>
      </>}>
      <div className="mb-5 flex flex-wrap items-center gap-4">
        <PetAvatar src={a.pet_photo} name={a.pet_name} size={72} rounded="rounded-3xl" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><h3 className="text-xl font-extrabold">{a.pet_name}</h3><Badge tone={statusTone(a.status)} dot>{a.status}</Badge>{a.origin === 'app' && <Badge tone="green">Agendado pelo app</Badge>}</div>
          <p className="text-sm text-ink-muted">{[a.pet_breed, a.pet_size].filter(Boolean).join(' · ')}</p>
          <p className="text-sm font-semibold">Tutor: {a.client_name} · {a.client_phone}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" icon={PawPrint} onClick={() => { onClose(); go('pets', { petId: a.pet_id }) }}>Ficha do pet</Button>
          {a.client_whatsapp && <Button size="sm" variant="secondary" icon={MessageCircle} onClick={() => window.api.app.openExternal(waLink(a.client_whatsapp))}>WhatsApp</Button>}
        </div>
      </div>

      {(a.pet_allergies || a.pet_restrictions) && (
        <div className="mb-4 flex gap-3 rounded-2xl border border-brand-200 bg-brand-50 p-4 text-sm"><AlertTriangle className="shrink-0 text-brand-600" size={20} />
          <div>{a.pet_allergies && <p><b>Alergias:</b> {a.pet_allergies}</p>}{a.pet_restrictions && <p><b>Restrições:</b> {a.pet_restrictions}</p>}</div></div>
      )}

      <div className="m-two grid grid-cols-4 gap-x-6 rounded-2xl bg-paper px-5 py-2">
        <InfoRow label="Serviço">{a.service_name}</InfoRow>
        <InfoRow label="Responsável">{a.employee_name}</InfoRow>
        <InfoRow label="Valor">{brl(a.price)}</InfoRow>
        <InfoRow label="Transporte">{[a.pickup && 'Busca', a.delivery && 'Entrega'].filter(Boolean).join(' + ') || 'Cliente traz e retira'}</InfoRow>
      </div>
      {a.notes && <p className="mt-3 rounded-2xl border border-paper-line p-4 text-sm"><b>Observações do agendamento:</b> {a.notes}</p>}
      {a.cancel_reason && <p className="mt-3 rounded-2xl bg-red-50 p-4 text-sm text-red-700"><b>Cancelamento:</b> {a.cancel_reason}</p>}
      {!!a.override && <p className="mt-3 text-xs font-semibold text-yellow-700">Agendado como exceção autorizada por um administrador.</p>}

      {canEdit && (
        <>
          <h4 className="mb-2 mt-6 text-sm font-extrabold">Andamento</h4>
          <div className="flex flex-wrap gap-2">
            {STATUSES.map((s) => (
              <button key={s.name} onClick={() => setStatus(s.name)} className={cls('rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition', a.status === s.name ? 'border-transparent bg-brand-500 text-white' : 'border-paper-line bg-white text-ink-soft hover:border-brand-300', s.name === 'Cancelado' && a.status !== s.name && 'text-red-600')}>{s.name}</button>
            ))}
          </div>
          {next && <Button className="mt-3" onClick={() => setStatus(next)}>Avançar para “{next}”</Button>}
          <div className="mt-6">
            <Textarea label="Observações da equipe sobre o atendimento" value={staffNotes} onChange={setStaffNotes} rows={2} placeholder="Ex.: pelagem com nós, ficou agitado no secador" />
            <Button className="mt-2" size="sm" variant="secondary" onClick={saveNotes} disabled={staffNotes === (a.staff_notes || '')}>Salvar observação</Button>
          </div>
        </>
      )}
      {!canEdit && a.staff_notes && <p className="mt-4 text-sm"><b>Observações da equipe:</b> {a.staff_notes}</p>}
    </Modal>
  )
}
