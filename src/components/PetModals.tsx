import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CalendarPlus, Edit3, Pencil, Plus, ShieldCheck, Syringe, Trash2, Weight } from 'lucide-react'
import { Badge, Button, Empty, IconButton, InfoRow, Input, Modal, PetAvatar, PhotoPicker, SectionLabel, Select, Tabs, Textarea } from './ui'
import { ClientPicker } from './ClientModals'
import { db, useAction, useApp, useQuery } from '../lib/store'
import { SEXES, SIZES, SPECIES, STATUSES, VACCINE_LABEL, VACCINE_PRESETS, VACCINE_TONE, latestVaccine, statusTone, vaccineState } from '../lib/domain'
import { ageText, cls, fmtDate, todayISO } from '../lib/util'

const EMPTY = {
  client_id: null as number | null, name: '', species: 'Cachorro', breed: '', sex: '', birth_date: '', weight: '', size: '', color: '', microchip: '', photo: null as string | null,
  temperament: '', with_dogs: '', with_people: '', fears: '', allergies: '', restrictions: '', notes: '',
}
const suggestSize = (w: number) => (w < 10 ? 'Pequeno' : w < 25 ? 'Médio' : 'Grande')

export function PetForm({ open, onClose, pet, clientId, onSaved }: { open: boolean; onClose: () => void; pet?: any; clientId?: number | null; onSaved?: (id: number) => void }) {
  const { toast } = useApp()
  const run = useAction()
  const [f, setF] = useState<any>(EMPTY)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const set = (k: string) => (v: any) => setF((s: any) => ({ ...s, [k]: v }))

  useEffect(() => {
    if (open) { setF(pet ? { ...EMPTY, ...pet, weight: pet.weight ?? '' } : { ...EMPTY, client_id: clientId || null }); setErrors({}) }
  }, [open, pet, clientId])

  const save = async () => {
    const er: Record<string, string> = {}
    if (!f.client_id) er.client_id = 'Escolha o tutor. Todo pet precisa estar vinculado a um cliente.'
    if (!f.name.trim()) er.name = 'Informe o nome do pet.'
    if (f.weight !== '' && (isNaN(Number(String(f.weight).replace(',', '.'))) || Number(String(f.weight).replace(',', '.')) <= 0)) er.weight = 'Peso inválido.'
    if (f.birth_date && f.birth_date > todayISO()) er.birth_date = 'A data não pode ser no futuro.'
    setErrors(er)
    if (Object.keys(er).length) return toast('Confira os campos destacados.', 'error')
    setBusy(true)
    const data: any = {}
    for (const k of Object.keys(EMPTY)) data[k] = typeof f[k] === 'string' ? f[k].trim() : f[k]
    data.weight = f.weight === '' ? null : Number(String(f.weight).replace(',', '.'))
    const id = await run(async () => {
      let petId = pet?.id
      if (pet) { await db.update('pets', pet.id, data); await db.audit('Editou pet', 'Pet', data.name) }
      else { petId = await db.insert('pets', data); await db.audit('Cadastrou pet', 'Pet', data.name) }
      if (data.weight && (!pet || Number(pet.weight) !== data.weight)) await db.insert('weights', { pet_id: petId, date: todayISO(), weight: data.weight })
      return petId
    }, pet ? 'Pet atualizado.' : 'Pet cadastrado.')
    setBusy(false)
    if (id) { onSaved?.(id); onClose() }
  }

  const dogs = ['Sociável', 'Seletivo', 'Pode ficar agitado', 'Reativo', 'Não gosta de outros cães']
  const ppl = ['Sociável', 'Tímido', 'Desconfiado no início', 'Pode reagir mal']

  return (
    <Modal open={open} onClose={onClose} size="lg" title={pet ? `Editar ${pet.name}` : 'Novo pet'} subtitle="Ficha individual com dados básicos e comportamento."
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button onClick={save} loading={busy}>Salvar pet</Button></>}>
      <SectionLabel>Informações básicas</SectionLabel>
      <div className="m-stack grid grid-cols-6 gap-4">
        <div className="col-span-6"><PhotoPicker value={f.photo} onChange={set('photo')} label="Foto do pet" /></div>
        <div className="col-span-3"><ClientPicker label="Tutor" value={f.client_id} onChange={(id) => set('client_id')(id)} error={errors.client_id} disabled={!!clientId && !pet} /></div>
        <Input className="col-span-3" label="Nome" required value={f.name} onChange={set('name')} error={errors.name} />
        <Select className="col-span-2" label="Espécie" value={f.species} onChange={set('species')} options={SPECIES} />
        <Input className="col-span-2" label="Raça" value={f.breed} onChange={set('breed')} placeholder="Ex.: Vira-lata caramelo" />
        <Select className="col-span-2" label="Sexo" value={f.sex} onChange={set('sex')} options={SEXES} placeholder="Selecione" />
        <Input className="col-span-2" label="Data de nascimento" type="date" value={f.birth_date} onChange={set('birth_date')} error={errors.birth_date} hint={f.birth_date ? `Idade: ${ageText(f.birth_date)}` : 'A idade é calculada automaticamente.'} />
        <Input className="col-span-1" label="Peso (kg)" value={f.weight} onChange={(v) => { set('weight')(v); const n = Number(v.replace(',', '.')); if (n > 0 && !f.size) set('size')(suggestSize(n)) }} inputMode="decimal" error={errors.weight} />
        <Select className="col-span-1" label="Porte" value={f.size} onChange={set('size')} options={SIZES} placeholder="—" />
        <Input className="col-span-3" label="Cor" value={f.color} onChange={set('color')} />
        <Input className="col-span-3" label="Microchip (opcional)" value={f.microchip} onChange={set('microchip')} />
      </div>
      <div className="my-6 border-t border-paper-line" />
      <SectionLabel>Comportamento e cuidados</SectionLabel>
      <div className="m-stack grid grid-cols-2 gap-4">
        <Input label="Temperamento" value={f.temperament} onChange={set('temperament')} placeholder="Ex.: calmo, agitado, carinhoso" />
        <Input label="Medo ou sensibilidade" value={f.fears} onChange={set('fears')} placeholder="Ex.: barulho do secador" />
        <Select label="Comportamento com outros cães" value={f.with_dogs} onChange={set('with_dogs')} options={dogs} placeholder="Selecione" />
        <Select label="Comportamento com pessoas" value={f.with_people} onChange={set('with_people')} options={ppl} placeholder="Selecione" />
        <Input label="Alergias" value={f.allergies} onChange={set('allergies')} />
        <Input label="Restrições" value={f.restrictions} onChange={set('restrictions')} placeholder="Ex.: usar focinheira" />
        <Textarea className="col-span-2" label="Observações importantes" value={f.notes} onChange={set('notes')} />
      </div>
    </Modal>
  )
}

function VaccineForm({ petId, vaccine, open, onClose }: { petId: number; vaccine?: any; open: boolean; onClose: () => void }) {
  const run = useAction()
  const { toast } = useApp()
  const [f, setF] = useState<any>({})
  useEffect(() => { if (open) setF(vaccine || { name: '', applied_at: todayISO(), next_dose: '', vet: '', notes: '' }) }, [open, vaccine])
  const set = (k: string) => (v: any) => setF((s: any) => ({ ...s, [k]: v }))
  const save = async () => {
    if (!f.name?.trim()) return toast('Informe o nome da vacina.', 'error')
    if (f.next_dose && f.applied_at && f.next_dose < f.applied_at) return toast('A próxima dose deve ser depois da aplicação.', 'error')
    const data = { pet_id: petId, name: f.name.trim(), applied_at: f.applied_at || null, next_dose: f.next_dose || null, vet: f.vet || '', notes: f.notes || '' }
    const ok = await run(async () => { vaccine ? await db.update('vaccines', vaccine.id, data) : await db.insert('vaccines', data); await db.audit(vaccine ? 'Editou vacina' : 'Registrou vacina', 'Pet', data.name); return true }, 'Vacina salva.')
    if (ok) onClose()
  }
  return (
    <Modal open={open} onClose={onClose} size="sm" title={vaccine ? 'Editar vacina' : 'Registrar vacina'}
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button onClick={save}>Salvar vacina</Button></>}>
      <div className="m-stack grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Input label="Nome da vacina" required list="vac-presets" value={f.name} onChange={set('name')} />
          <datalist id="vac-presets">{VACCINE_PRESETS.map((v) => <option key={v} value={v} />)}</datalist>
        </div>
        <Input label="Data da aplicação" type="date" value={f.applied_at} onChange={set('applied_at')} />
        <Input label="Próxima dose" type="date" value={f.next_dose} onChange={set('next_dose')} />
        <Input className="col-span-2" label="Veterinário responsável" value={f.vet} onChange={set('vet')} />
        <Textarea className="col-span-2" label="Observações" value={f.notes} onChange={set('notes')} rows={2} />
      </div>
    </Modal>
  )
}

function WeightChart({ points }: { points: { date: string; weight: number }[] }) {
  if (points.length < 2) return null
  const w = 420, h = 110, pad = 14
  const min = Math.min(...points.map((p) => p.weight)), max = Math.max(...points.map((p) => p.weight))
  const span = max - min || 1
  const xy = points.map((p, i) => [pad + (i / (points.length - 1)) * (w - pad * 2), h - pad - ((p.weight - min) / span) * (h - pad * 2)])
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label="Gráfico do histórico de peso">
      <polyline points={xy.map((p) => p.join(',')).join(' ')} fill="none" stroke="#FF7A1A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {xy.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="4.5" fill="#fff" stroke="#FF7A1A" strokeWidth="3" />)}
    </svg>
  )
}

export function PetDetail({ petId, onClose, onEdit }: { petId: number; onClose: () => void; onEdit?: (pet: any) => void }) {
  const { can, go, confirm, settings, toast } = useApp()
  const run = useAction()
  const [tab, setTab] = useState<'resumo' | 'saude' | 'historico'>('resumo')
  const [vacForm, setVacForm] = useState<{ open: boolean; vaccine?: any }>({ open: false })
  const [weightForm, setWeightForm] = useState({ date: todayISO(), weight: '' })
  const [filter, setFilter] = useState<'tudo' | 'atendimentos' | 'vacinas' | 'peso'>('tudo')

  const pet = useQuery('SELECT p.*, c.name AS tutor, c.phone AS tutor_phone, c.id AS tutor_id FROM pets p JOIN clients c ON c.id=p.client_id WHERE p.id=?', [petId]).rows[0]
  const vaccines = useQuery(`SELECT v.*, CASE WHEN ${latestVaccine('v')} THEN 1 ELSE 0 END AS current FROM vaccines v WHERE v.pet_id=? ORDER BY v.applied_at DESC, v.id DESC`, [petId]).rows
  const weights = useQuery('SELECT * FROM weights WHERE pet_id=? ORDER BY date, id', [petId]).rows
  const appts = useQuery('SELECT a.*, u.name AS employee FROM appointments a LEFT JOIN users u ON u.id=a.employee_id WHERE a.pet_id=? ORDER BY a.date DESC, a.start_time DESC', [petId]).rows

  const worst = useMemo(() => {
    const states = vaccines.filter((v: any) => v.current).map((v: any) => vaccineState(v.next_dose, settings.vaccine_alert_days))
    return states.includes('overdue') ? 'overdue' : states.includes('soon') ? 'soon' : states.includes('ok') ? 'ok' : 'none'
  }, [vaccines, settings.vaccine_alert_days])

  const done = appts.filter((a: any) => ['Finalizado', 'Aguardando retirada', 'Entregue'].includes(a.status))
  const baths = done.filter((a: any) => a.category === 'Banho').length
  const grooms = done.filter((a: any) => a.category === 'Tosa').length

  const timeline = useMemo(() => {
    const items: { date: string; kind: string; title: string; text: string; tone: string }[] = []
    done.forEach((a: any) => items.push({ date: a.date, kind: 'atendimentos', title: a.service_name, text: [a.employee && `por ${a.employee}`, a.staff_notes].filter(Boolean).join(' · '), tone: a.category === 'Tosa' ? 'bg-purple-500' : 'bg-blue-500' }))
    vaccines.forEach((v: any) => v.applied_at && items.push({ date: v.applied_at, kind: 'vacinas', title: `Vacina: ${v.name}`, text: [v.vet, v.next_dose && `próxima dose em ${fmtDate(v.next_dose)}`].filter(Boolean).join(' · '), tone: 'bg-leaf-500' }))
    weights.forEach((w: any) => items.push({ date: w.date, kind: 'peso', title: `Pesagem: ${String(w.weight).replace('.', ',')} kg`, text: '', tone: 'bg-brand-500' }))
    return items.sort((a, b) => b.date.localeCompare(a.date)).filter((i) => filter === 'tudo' || i.kind === filter)
  }, [done, vaccines, weights, filter])

  if (!pet) return null
  const canEdit = can('pets_edit')

  const addWeight = async () => {
    const n = Number(weightForm.weight.replace(',', '.'))
    if (!(n > 0)) return toast('Informe um peso válido.', 'error')
    await run(async () => { await db.insert('weights', { pet_id: petId, date: weightForm.date, weight: n }); await db.update('pets', petId, { weight: n }); setWeightForm({ date: todayISO(), weight: '' }) }, 'Peso registrado.')
  }
  const del = async () => {
    if (!(await confirm({ title: `Excluir ${pet.name}?`, message: 'A ficha, as vacinas e os agendamentos deste pet serão apagados definitivamente.', confirmLabel: 'Excluir pet', danger: true }))) return
    await run(async () => { await db.remove('pets', petId); await db.audit('Excluiu pet', 'Pet', pet.name); onClose() }, 'Pet excluído.')
  }
  const delVaccine = async (v: any) => {
    if (await confirm({ title: 'Excluir este registro de vacina?', message: `${v.name} aplicada em ${fmtDate(v.applied_at)}.`, confirmLabel: 'Excluir', danger: true }))
      run(async () => { await db.remove('vaccines', v.id) }, 'Registro excluído.')
  }

  const alerts = [pet.allergies && ['Alergias', pet.allergies], pet.restrictions && ['Restrições', pet.restrictions], pet.fears && ['Medo ou sensibilidade', pet.fears]].filter(Boolean) as string[][]

  return (
    <>
      <Modal open onClose={onClose} size="xl" title="Ficha do pet">
        <div className="mb-5 flex flex-wrap items-center gap-5">
          <PetAvatar src={pet.photo} name={pet.name} size={96} rounded="rounded-3xl" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-extrabold tracking-tight">{pet.name}</h2>
              {pet.size && <Badge tone="orange">{pet.size}</Badge>}
              {worst !== 'none' && <Badge tone={VACCINE_TONE[worst]} dot>Vacinas: {VACCINE_LABEL[worst].toLowerCase()}</Badge>}
            </div>
            <p className="text-sm text-ink-muted">{[pet.species, pet.breed, pet.sex, ageText(pet.birth_date), pet.weight && `${String(pet.weight).replace('.', ',')} kg`].filter(Boolean).join(' · ')}</p>
            <button onClick={() => { onClose(); go('clients', { clientId: pet.tutor_id }) }} className="mt-1 text-sm font-semibold text-brand-600 hover:underline">Tutor: {pet.tutor}</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {can('appointments_edit') && <Button icon={CalendarPlus} onClick={() => { onClose(); go('appointments', { newFor: { clientId: pet.tutor_id, petId } }) }}>Agendar</Button>}
            {canEdit && <Button variant="secondary" icon={Edit3} onClick={() => onEdit?.(pet)}>Editar</Button>}
            {can('delete_records') && <Button variant="danger" icon={Trash2} onClick={del}>Excluir</Button>}
          </div>
        </div>

        {alerts.length > 0 && (
          <div className="mb-5 flex gap-3 rounded-2xl border border-brand-200 bg-brand-50 p-4">
            <AlertTriangle className="mt-0.5 shrink-0 text-brand-600" size={20} />
            <div className="m-two grid flex-1 grid-cols-3 gap-4 text-sm">{alerts.map(([k, v]) => <div key={k}><b className="block text-brand-700">{k}</b>{v}</div>)}</div>
          </div>
        )}

        <Tabs value={tab} onChange={setTab} tabs={[{ value: 'resumo', label: 'Resumo' }, { value: 'saude', label: 'Saúde e vacinas', count: vaccines.filter((v: any) => v.current).length }, { value: 'historico', label: 'Histórico', count: done.length }]} />
        <div className="pt-5">
          {tab === 'resumo' && (
            <div className="m-stack grid grid-cols-3 gap-8">
              <div>
                <SectionLabel>Informações básicas</SectionLabel>
                <InfoRow label="Nascimento">{fmtDate(pet.birth_date)} {pet.birth_date && `(${ageText(pet.birth_date)})`}</InfoRow>
                <InfoRow label="Cor">{pet.color}</InfoRow>
                <InfoRow label="Microchip">{pet.microchip}</InfoRow>
                <InfoRow label="Cadastrado em">{fmtDate(pet.created_at?.slice(0, 10))}</InfoRow>
              </div>
              <div>
                <SectionLabel>Comportamento</SectionLabel>
                <InfoRow label="Temperamento">{pet.temperament}</InfoRow>
                <InfoRow label="Com outros cães">{pet.with_dogs}</InfoRow>
                <InfoRow label="Com pessoas">{pet.with_people}</InfoRow>
              </div>
              <div>
                <SectionLabel>Observações importantes</SectionLabel>
                <p className="whitespace-pre-wrap py-2 text-sm text-ink">{pet.notes || '—'}</p>
              </div>
            </div>
          )}

          {tab === 'saude' && (
            <div className="m-stack grid grid-cols-5 gap-8">
              <div className="col-span-3">
                <div className="mb-3 flex items-center justify-between"><SectionLabel>Carteira de vacinação</SectionLabel>{canEdit && <Button size="sm" icon={Plus} onClick={() => setVacForm({ open: true })}>Registrar vacina</Button>}</div>
                {vaccines.length === 0 ? <Empty icon={Syringe} title="Nenhuma vacina registrada" text="Registre as vacinas para receber alertas antes do vencimento." /> : (
                  <div className="overflow-hidden rounded-2xl border border-paper-line">
                    {vaccines.map((v: any) => {
                      const st = v.current ? vaccineState(v.next_dose, settings.vaccine_alert_days) : 'none'
                      return (
                        <div key={v.id} className={cls('flex items-center gap-3 border-b border-paper-line px-4 py-3 last:border-0', !v.current && 'bg-paper/60 opacity-70')}>
                          <span className={cls('grid h-10 w-10 shrink-0 place-items-center rounded-xl', v.current && st === 'overdue' ? 'bg-red-50 text-red-600' : v.current && st === 'soon' ? 'bg-brand-50 text-brand-600' : 'bg-leaf-50 text-leaf-600')}>{v.current && st === 'overdue' ? <AlertTriangle size={19} /> : <ShieldCheck size={19} />}</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold">{v.name} {!v.current && <span className="ml-1 text-xs font-semibold text-ink-muted">(dose anterior)</span>}</p>
                            <p className="text-xs text-ink-muted">Aplicada em {fmtDate(v.applied_at)} · próxima dose {fmtDate(v.next_dose)}{v.vet && ` · ${v.vet}`}</p>
                          </div>
                          {v.current && v.next_dose && <Badge tone={VACCINE_TONE[st]} dot>{VACCINE_LABEL[st]}</Badge>}
                          {canEdit && <><IconButton icon={Pencil} label="Editar" onClick={() => setVacForm({ open: true, vaccine: v })} />{can('delete_records') && <IconButton icon={Trash2} label="Excluir" tone="danger" onClick={() => delVaccine(v)} />}</>}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
              <div className="col-span-2">
                <SectionLabel>Histórico de peso</SectionLabel>
                {canEdit && (
                  <div className="mb-3 flex items-end gap-2">
                    <Input className="flex-1" label="Data" type="date" value={weightForm.date} onChange={(v) => setWeightForm((s) => ({ ...s, date: v }))} />
                    <Input className="w-24" label="Peso (kg)" inputMode="decimal" value={weightForm.weight} onChange={(v) => setWeightForm((s) => ({ ...s, weight: v }))} />
                    <Button onClick={addWeight} icon={Weight} className="mb-px">Salvar</Button>
                  </div>
                )}
                <WeightChart points={weights} />
                <div className="mt-2 max-h-48 overflow-y-auto">
                  {[...weights].reverse().map((w: any) => (
                    <div key={w.id} className="flex items-center justify-between border-b border-paper-line py-2 text-sm last:border-0">
                      <span className="text-ink-soft">{fmtDate(w.date)}</span><b>{String(w.weight).replace('.', ',')} kg</b>
                    </div>
                  ))}
                  {weights.length === 0 && <p className="py-4 text-center text-sm text-ink-muted">Sem pesagens registradas.</p>}
                </div>
              </div>
            </div>
          )}

          {tab === 'historico' && (
            <div>
              <div className="mb-5 grid grid-cols-3 gap-3">
                {[['Banhos', baths], ['Tosas', grooms], ['Atendimentos', done.length]].map(([k, v]) => (
                  <div key={k as string} className="rounded-2xl bg-paper px-5 py-4"><p className="text-2xl font-extrabold">{v}</p><p className="text-xs font-semibold text-ink-muted">{k}</p></div>
                ))}
              </div>
              <div className="mb-3 flex gap-2">
                {([['tudo', 'Tudo'], ['atendimentos', 'Atendimentos'], ['vacinas', 'Vacinas'], ['peso', 'Peso']] as const).map(([v, l]) => (
                  <button key={v} onClick={() => setFilter(v)} className={cls('rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition', filter === v ? 'bg-brand-500 text-white' : 'bg-paper text-ink-soft hover:bg-brand-50')}>{l}</button>
                ))}
              </div>
              {timeline.length === 0 ? <Empty title="Nada por aqui ainda" text="Os atendimentos finalizados, vacinas e pesagens aparecem nesta linha do tempo." /> : (
                <ol className="ml-2 border-l-2 border-paper-line">
                  {timeline.map((i, idx) => (
                    <li key={idx} className="relative pb-4 pl-6">
                      <span className={cls('absolute -left-[7px] top-1.5 h-3 w-3 rounded-full ring-4 ring-white', i.tone)} />
                      <p className="text-sm font-bold">{i.title} <span className="ml-1 text-xs font-semibold text-ink-muted">{fmtDate(i.date)}</span></p>
                      {i.text && <p className="text-[13px] text-ink-soft">{i.text}</p>}
                    </li>
                  ))}
                </ol>
              )}
              {appts.some((a: any) => !['Finalizado', 'Aguardando retirada', 'Entregue'].includes(a.status)) && (
                <div className="mt-4 rounded-2xl bg-paper p-4">
                  <SectionLabel>Agendamentos em aberto</SectionLabel>
                  {appts.filter((a: any) => !['Finalizado', 'Aguardando retirada', 'Entregue'].includes(a.status)).map((a: any) => (
                    <div key={a.id} className="flex items-center justify-between py-1.5 text-sm"><span>{fmtDate(a.date)} às {a.start_time} · {a.service_name}</span><Badge tone={statusTone(a.status)} dot>{a.status}</Badge></div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>
      <VaccineForm petId={petId} vaccine={vacForm.vaccine} open={vacForm.open} onClose={() => setVacForm({ open: false })} />
    </>
  )
}
