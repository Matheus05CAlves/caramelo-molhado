import { useEffect, useMemo, useState } from 'react'
import { ArrowUpRight, PawPrint, Plus, Syringe } from 'lucide-react'
import { Badge, Button, Card, Empty, PageHeader, PetAvatar, SearchInput, Select, Spinner } from '../components/ui'
import { PetDetail, PetForm } from '../components/PetModals'
import { useApp, useQuery } from '../lib/store'
import { SIZES, VACCINE_LABEL, VACCINE_TONE, latestVaccine, vaccineState } from '../lib/domain'
import { ageText } from '../lib/util'

export default function Pets() {
  const { can, params, settings } = useApp()
  const [q, setQ] = useState('')
  const [size, setSize] = useState('')
  const [vac, setVac] = useState('')
  const [openId, setOpenId] = useState<number | null>(null)
  const [form, setForm] = useState<{ open: boolean; pet?: any }>({ open: false })

  useEffect(() => { if (params?.petId) setOpenId(params.petId) }, [params])

  const { rows, loading } = useQuery(`SELECT p.*, c.name AS tutor, c.phone AS tutor_phone,
    (SELECT MIN(v.next_dose) FROM vaccines v WHERE v.pet_id=p.id AND v.next_dose IS NOT NULL AND v.next_dose<>'' AND ${latestVaccine('v')}) AS next_dose
    FROM pets p JOIN clients c ON c.id=p.client_id ORDER BY p.name`)

  const list = useMemo(() => {
    const t = q.trim().toLowerCase()
    return rows.filter((p: any) => {
      if (t && ![p.name, p.breed, p.tutor, p.microchip].some((x) => (x || '').toLowerCase().includes(t))) return false
      if (size && p.size !== size) return false
      const st = vaccineState(p.next_dose, settings.vaccine_alert_days)
      if (vac === 'alert' && !['overdue', 'soon'].includes(st)) return false
      return true
    })
  }, [rows, q, size, vac, settings.vaccine_alert_days])

  return (
    <>
      <PageHeader title="Pets" subtitle={`${rows.length} ${rows.length === 1 ? 'pet cadastrado' : 'pets cadastrados'}`}>
        {can('pets_edit') && <Button icon={Plus} onClick={() => setForm({ open: true })}>Novo pet</Button>}
      </PageHeader>
      <div className="mb-6 flex flex-wrap gap-3">
        <SearchInput className="w-80" value={q} onChange={setQ} placeholder="Buscar por pet, raça, tutor ou microchip" />
        <Select className="w-44" value={size} onChange={setSize} options={SIZES} placeholder="Todos os portes" />
        <Select className="w-56" value={vac} onChange={setVac} options={[{ value: 'alert', label: 'Vacinas com alerta' }]} placeholder="Todas as vacinações" />
      </div>

      {loading ? <Spinner /> : list.length === 0 ? (
        <Card><Empty icon={PawPrint} title={rows.length ? 'Nenhum pet com esses filtros' : 'Nenhum pet cadastrado ainda'} text={rows.length ? 'Tente buscar por outro nome ou limpar os filtros.' : 'Cadastre o primeiro pet e vincule a um tutor.'} action={can('pets_edit') && !rows.length && <Button icon={Plus} onClick={() => setForm({ open: true })}>Cadastrar pet</Button>} /></Card>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(236px,1fr))] gap-5">
          {list.map((p: any) => {
            const st = vaccineState(p.next_dose, settings.vaccine_alert_days)
            return (
              <button key={p.id} onClick={() => setOpenId(p.id)} className="group rounded-3xl border border-paper-line/70 bg-white p-3 text-left shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift">
                <div className="relative overflow-hidden rounded-2xl bg-brand-50">
                  <PetAvatar src={p.photo} name={p.name} size={176} rounded="rounded-2xl" fill />
                  {p.size && <span className="absolute left-2.5 top-2.5 rounded-lg bg-yellow-300 px-2 py-1 text-[11px] font-extrabold text-ink">{p.size}</span>}
                  {['overdue', 'soon'].includes(st) && <span className="absolute right-2.5 top-2.5"><Badge tone={VACCINE_TONE[st]} className="bg-white/95 shadow-sm"><Syringe size={12} />{VACCINE_LABEL[st]}</Badge></span>}
                </div>
                <div className="px-1.5 pb-1 pt-3">
                  <p className="truncate text-[15px] font-extrabold">{p.name}</p>
                  <p className="truncate text-[13px] text-ink-muted">{p.breed || p.species} · {ageText(p.birth_date)}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <div className="min-w-0"><p className="truncate text-xs text-ink-muted">Tutor</p><p className="truncate text-sm font-bold">{p.tutor}</p></div>
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-500 text-white transition group-hover:scale-110"><ArrowUpRight size={18} /></span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {openId && <PetDetail petId={openId} onClose={() => setOpenId(null)} onEdit={(pet) => setForm({ open: true, pet })} />}
      <PetForm open={form.open} pet={form.pet} onClose={() => setForm({ open: false })} onSaved={(id) => !form.pet && setOpenId(id)} />
    </>
  )
}
