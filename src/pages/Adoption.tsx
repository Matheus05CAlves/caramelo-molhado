import { useEffect, useMemo, useState } from 'react'
import { Edit3, Heart, HeartHandshake, MessageCircle, Phone, Plus, Trash2, UserPlus } from 'lucide-react'
import { Badge, Button, Card, Empty, IconButton, InfoRow, Input, Modal, PageHeader, PetAvatar, PhotoPicker, SearchInput, Select, Tabs, Textarea } from '../components/ui'
import { db, useAction, useApp, useQuery } from '../lib/store'
import { ADOPTION_STATUSES, SEXES, SIZES } from '../lib/domain'
import { cls, fmtDate, maskPhone, onlyDigits, todayISO, waLink } from '../lib/util'

const tone = (s: string) => ADOPTION_STATUSES.find((x) => x.name === s)?.tone || 'gray'
const EMPTY = { name: '', photo: null as string | null, approx_age: '', sex: '', breed: '', size: '', rescue_story: '', health: '', vaccines: '', neutered: '', temperament: '', description: '', entered_at: todayISO(), status: 'Disponível para adoção' }

function AnimalForm({ open, onClose, animal }: { open: boolean; onClose: () => void; animal?: any }) {
  const run = useAction()
  const { toast } = useApp()
  const [f, setF] = useState<any>(EMPTY)
  const set = (k: string) => (v: any) => setF((s: any) => ({ ...s, [k]: v }))
  useEffect(() => { if (open) setF(animal ? { ...EMPTY, ...animal } : { ...EMPTY, entered_at: todayISO() }) }, [open, animal])
  const save = async () => {
    if (!f.name.trim()) return toast('Dê um nome provisório ao animal.', 'error')
    const data: any = {}
    for (const k of Object.keys(EMPTY)) data[k] = typeof f[k] === 'string' ? f[k].trim() : f[k]
    const ok = await run(async () => {
      if (animal) await db.update('adoption_animals', animal.id, data); else await db.insert('adoption_animals', data)
      await db.audit(animal ? 'Editou animal para adoção' : 'Cadastrou animal para adoção', 'Adoção', data.name)
      return true
    }, animal ? 'Animal atualizado.' : 'Animal cadastrado.')
    if (ok) onClose()
  }
  return (
    <Modal open={open} onClose={onClose} size="lg" title={animal ? `Editar ${animal.name}` : 'Cadastrar animal para adoção'} subtitle="Quanto mais detalhes, mais fácil é encontrar o lar certo."
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button onClick={save}>Salvar animal</Button></>}>
      <div className="m-stack grid grid-cols-6 gap-4">
        <div className="col-span-6"><PhotoPicker value={f.photo} onChange={set('photo')} label="Foto do animal" /></div>
        <Input className="col-span-2" label="Nome provisório" required value={f.name} onChange={set('name')} />
        <Input className="col-span-2" label="Idade aproximada" value={f.approx_age} onChange={set('approx_age')} placeholder="Ex.: 8 meses" />
        <Select className="col-span-1" label="Sexo" value={f.sex} onChange={set('sex')} options={SEXES} placeholder="—" />
        <Select className="col-span-1" label="Porte" value={f.size} onChange={set('size')} options={SIZES} placeholder="—" />
        <Input className="col-span-3" label="Raça ou características" value={f.breed} onChange={set('breed')} placeholder="Ex.: vira-lata caramelo, orelhas caídas" />
        <Input className="col-span-3" label="Temperamento" value={f.temperament} onChange={set('temperament')} />
        <Input className="col-span-2" label="Estado de saúde" value={f.health} onChange={set('health')} />
        <Input className="col-span-2" label="Vacinas" value={f.vaccines} onChange={set('vaccines')} placeholder="Ex.: V10 em dia" />
        <Select className="col-span-1" label="Castração" value={f.neutered} onChange={set('neutered')} options={['Sim', 'Ainda não', 'Não se aplica']} placeholder="—" />
        <Input className="col-span-1" label="Entrada" type="date" value={f.entered_at} onChange={set('entered_at')} />
        <Select className="col-span-3" label="Status da adoção" value={f.status} onChange={set('status')} options={ADOPTION_STATUSES.map((s) => s.name)} />
        <Textarea className="col-span-6" label="Histórico de resgate" value={f.rescue_story} onChange={set('rescue_story')} rows={2} />
        <Textarea className="col-span-6" label="Descrição para divulgação" value={f.description} onChange={set('description')} rows={2} />
      </div>
    </Modal>
  )
}

function InterestedForm({ open, onClose, animalId, entry }: { open: boolean; onClose: () => void; animalId?: number | null; entry?: any }) {
  const run = useAction()
  const { toast } = useApp()
  const animals = useQuery("SELECT id, name FROM adoption_animals WHERE status<>'Adotado' ORDER BY name", [], open).rows
  const [f, setF] = useState<any>({})
  const set = (k: string) => (v: any) => setF((s: any) => ({ ...s, [k]: v }))
  useEffect(() => { if (open) setF(entry || { name: '', phone: '', address: '', notes: '', animal_id: animalId || '' }) }, [open, entry, animalId])
  const save = async () => {
    if (!f.name?.trim()) return toast('Informe o nome do interessado.', 'error')
    if (onlyDigits(f.phone || '').length < 10) return toast('Informe um telefone com DDD.', 'error')
    const data = { name: f.name.trim(), phone: f.phone, address: f.address || '', notes: f.notes || '', animal_id: f.animal_id ? Number(f.animal_id) : null }
    const ok = await run(async () => { entry ? await db.update('adoption_interested', entry.id, data) : await db.insert('adoption_interested', data); await db.audit('Registrou interessado em adoção', 'Adoção', data.name); return true }, 'Interessado salvo.')
    if (ok) onClose()
  }
  return (
    <Modal open={open} onClose={onClose} size="md" title={entry ? 'Editar interessado' : 'Novo interessado em adotar'} footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button onClick={save}>Salvar interessado</Button></>}>
      <div className="m-stack grid grid-cols-2 gap-4">
        <Input label="Nome" required value={f.name} onChange={set('name')} />
        <Input label="Telefone" required value={f.phone} onChange={set('phone')} mask={maskPhone} />
        <Input className="col-span-2" label="Endereço" value={f.address} onChange={set('address')} />
        <Select className="col-span-2" label="Animal de interesse" value={f.animal_id} onChange={set('animal_id')} placeholder="Ainda não escolheu" options={animals.map((a: any) => ({ value: a.id, label: a.name }))} />
        <Textarea className="col-span-2" label="Observações" value={f.notes} onChange={set('notes')} placeholder="Ex.: tem quintal, já teve cães, mora em apartamento" rows={2} />
      </div>
    </Modal>
  )
}

function AnimalDetail({ id, onClose, onEdit }: { id: number; onClose: () => void; onEdit: (a: any) => void }) {
  const { can, confirm } = useApp()
  const run = useAction()
  const a: any = useQuery('SELECT * FROM adoption_animals WHERE id=?', [id]).rows[0]
  const interested = useQuery('SELECT * FROM adoption_interested WHERE animal_id=? ORDER BY id DESC', [id]).rows
  const [iform, setIform] = useState(false)
  if (!a) return null
  const edit = can('adoption_edit')
  const del = async () => {
    if (await confirm({ title: `Excluir ${a.name}?`, message: 'O cadastro do animal será apagado. Os interessados continuam registrados, sem animal vinculado.', confirmLabel: 'Excluir', danger: true }))
      run(async () => { await db.remove('adoption_animals', a.id); await db.audit('Excluiu animal para adoção', 'Adoção', a.name); onClose() }, 'Cadastro excluído.')
  }
  return (
    <>
      <Modal open onClose={onClose} size="lg" title="Animal para adoção">
        <div className="mb-5 flex gap-6">
          <PetAvatar src={a.photo} name={a.name} size={176} rounded="rounded-3xl" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><h2 className="text-2xl font-extrabold">{a.name}</h2><Badge tone={tone(a.status)} dot>{a.status}</Badge></div>
            <p className="text-sm text-ink-muted">{[a.breed, a.sex, a.size, a.approx_age].filter(Boolean).join(' · ')}</p>
            {a.description && <p className="mt-3 text-[15px] leading-relaxed">{a.description}</p>}
            {edit && (
              <div className="mt-4 flex flex-wrap items-end gap-2">
                <Select className="w-60" label="Status da adoção" value={a.status} onChange={(v) => run(async () => { await db.update('adoption_animals', a.id, { status: v }); await db.audit('Mudou status de adoção', 'Adoção', `${a.name}: ${v}`) }, 'Status atualizado.')} options={ADOPTION_STATUSES.map((s) => s.name)} />
                <Button variant="secondary" icon={Edit3} onClick={() => onEdit(a)}>Editar</Button>
                {can('delete_records') && <Button variant="danger" icon={Trash2} onClick={del}>Excluir</Button>}
              </div>
            )}
          </div>
        </div>
        <div className="m-two grid grid-cols-4 gap-x-6 rounded-2xl bg-paper px-5 py-2">
          <InfoRow label="Saúde">{a.health}</InfoRow><InfoRow label="Vacinas">{a.vaccines}</InfoRow><InfoRow label="Castração">{a.neutered}</InfoRow><InfoRow label="Entrada no sistema">{fmtDate(a.entered_at)}</InfoRow>
          <div className="col-span-2"><InfoRow label="Temperamento">{a.temperament}</InfoRow></div>
          <div className="col-span-2"><InfoRow label="Histórico de resgate">{a.rescue_story}</InfoRow></div>
        </div>
        <div className="mb-2 mt-6 flex items-center justify-between"><h3 className="text-sm font-extrabold">Interessados em {a.name} ({interested.length})</h3>{edit && <Button size="sm" variant="soft" icon={UserPlus} onClick={() => setIform(true)}>Registrar interessado</Button>}</div>
        {interested.length === 0 ? <p className="rounded-2xl border border-dashed border-paper-line p-5 text-center text-sm text-ink-muted">Ninguém registrou interesse ainda.</p> : interested.map((i: any) => (
          <div key={i.id} className="flex items-center gap-3 border-b border-paper-line py-2.5 text-sm last:border-0">
            <div className="flex-1"><p className="font-bold">{i.name}</p><p className="text-xs text-ink-muted">{i.phone} {i.address && `· ${i.address}`}</p>{i.notes && <p className="text-xs text-ink-soft">{i.notes}</p>}</div>
            {i.phone && <IconButton icon={MessageCircle} label="Chamar no WhatsApp" onClick={() => window.api.app.openExternal(waLink(i.phone))} />}
          </div>
        ))}
      </Modal>
      <InterestedForm open={iform} animalId={a.id} onClose={() => setIform(false)} />
    </>
  )
}

export default function Adoption() {
  const { can, confirm } = useApp()
  const run = useAction()
  const [tab, setTab] = useState<'animals' | 'interested'>('animals')
  const [filter, setFilter] = useState('')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<number | null>(null)
  const [form, setForm] = useState<{ open: boolean; animal?: any }>({ open: false })
  const [iform, setIform] = useState<{ open: boolean; entry?: any }>({ open: false })
  const edit = can('adoption_edit')

  const animals = useQuery(`SELECT a.*, (SELECT COUNT(*) FROM adoption_interested i WHERE i.animal_id=a.id) AS interested FROM adoption_animals a ORDER BY a.status='Adotado', a.entered_at DESC`).rows
  const interested = useQuery('SELECT i.*, a.name AS animal_name FROM adoption_interested i LEFT JOIN adoption_animals a ON a.id=i.animal_id ORDER BY i.id DESC').rows
  const list = useMemo(() => animals.filter((a: any) => (!filter || a.status === filter) && (!q || [a.name, a.breed, a.temperament].some((x) => (x || '').toLowerCase().includes(q.toLowerCase())))), [animals, filter, q])
  const counts = (s: string) => animals.filter((a: any) => a.status === s).length

  return (
    <>
      <PageHeader title="Adoção e Doações" subtitle="Ajude cães resgatados a encontrar um lar.">
        {edit && <><Button variant="secondary" icon={UserPlus} onClick={() => setIform({ open: true })}>Novo interessado</Button><Button icon={Plus} onClick={() => setForm({ open: true })}>Cadastrar animal</Button></>}
      </PageHeader>
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'animals', label: 'Animais', count: animals.length }, { value: 'interested', label: 'Interessados', count: interested.length }]} />
      <div className="pt-6">
        {tab === 'animals' ? (
          <>
            <div className="mb-5 flex flex-wrap items-center gap-3">
              <SearchInput className="w-72" value={q} onChange={setQ} placeholder="Buscar animal" />
              {[['', 'Todos', animals.length] as const, ...ADOPTION_STATUSES.map((s) => [s.name, s.name, counts(s.name)] as const)].map(([v, l, n]) => (
                <button key={v} onClick={() => setFilter(v)} className={cls('rounded-full px-4 py-2 text-[13px] font-semibold transition', filter === v ? 'bg-brand-500 text-white shadow-sm' : 'bg-white text-ink-soft ring-1 ring-paper-line hover:ring-brand-300')}>{l} · {n}</button>
              ))}
            </div>
            {list.length === 0 ? <Card><Empty icon={Heart} title="Nenhum animal por aqui" text="Cadastre os cães que precisam de um lar para divulgar no pet shop." action={edit && <Button icon={Plus} onClick={() => setForm({ open: true })}>Cadastrar animal</Button>} /></Card> : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-5">
                {list.map((a: any) => (
                  <button key={a.id} onClick={() => setOpen(a.id)} className="group rounded-3xl border border-paper-line/70 bg-white p-3 text-left shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift">
                    <div className="relative overflow-hidden rounded-2xl bg-brand-50">
                      <PetAvatar src={a.photo} name={a.name} size={192} rounded="rounded-2xl" fill />
                      <span className="absolute left-2.5 top-2.5"><Badge tone={tone(a.status)} dot className="bg-white/95 shadow-sm">{a.status}</Badge></span>
                    </div>
                    <div className="px-1.5 pb-1 pt-3">
                      <div className="flex items-center justify-between"><p className="text-[15px] font-extrabold">{a.name}</p><Heart size={18} className="text-brand-400 transition group-hover:fill-brand-400" /></div>
                      <p className="truncate text-[13px] text-ink-muted">{[a.sex, a.size, a.approx_age].filter(Boolean).join(' · ')}</p>
                      <p className="mt-1.5 line-clamp-2 min-h-9 text-[13px] text-ink-soft">{a.description || a.temperament || a.rescue_story}</p>
                      <p className="mt-2 text-xs font-semibold text-brand-600">{a.interested} {a.interested === 1 ? 'interessado' : 'interessados'}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <Card className="overflow-hidden">
            {interested.length === 0 ? <Empty icon={HeartHandshake} title="Nenhum interessado registrado" text="Anote os dados de quem quer adotar para entrar em contato." action={edit && <Button icon={UserPlus} onClick={() => setIform({ open: true })}>Novo interessado</Button>} /> : (
              <table className="w-full text-sm">
                <thead className="bg-paper text-left text-xs font-semibold text-ink-muted"><tr><th className="px-5 py-3">Nome</th><th>Telefone</th><th>Endereço</th><th>Animal</th><th>Observações</th><th /></tr></thead>
                <tbody>{interested.map((i: any) => (
                  <tr key={i.id} className="border-t border-paper-line">
                    <td className="px-5 py-3 font-bold">{i.name}</td><td><span className="flex items-center gap-1.5"><Phone size={13} className="text-ink-muted" />{i.phone}</span></td><td className="text-ink-soft">{i.address || '—'}</td>
                    <td>{i.animal_name ? <Badge tone="orange">{i.animal_name}</Badge> : <span className="text-ink-muted">—</span>}</td><td className="max-w-64 truncate text-ink-soft">{i.notes}</td>
                    <td className="pr-3 text-right"><span className="inline-flex">
                      <IconButton icon={MessageCircle} label="WhatsApp" onClick={() => window.api.app.openExternal(waLink(i.phone))} />
                      {edit && <IconButton icon={Edit3} label="Editar" onClick={() => setIform({ open: true, entry: i })} />}
                      {can('delete_records') && <IconButton icon={Trash2} tone="danger" label="Excluir" onClick={async () => { if (await confirm({ title: 'Excluir interessado?', message: i.name, confirmLabel: 'Excluir', danger: true })) run(() => db.remove('adoption_interested', i.id), 'Excluído.') }} />}
                    </span></td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </Card>
        )}
      </div>
      {open && <AnimalDetail id={open} onClose={() => setOpen(null)} onEdit={(a) => setForm({ open: true, animal: a })} />}
      <AnimalForm open={form.open} animal={form.animal} onClose={() => setForm({ open: false })} />
      <InterestedForm open={iform.open} entry={iform.entry} onClose={() => setIform({ open: false })} />
    </>
  )
}
