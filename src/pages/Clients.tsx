import { useEffect, useMemo, useState } from 'react'
import { CalendarPlus, Edit3, ExternalLink, MapPin, MessageCircle, Phone, Plus, Trash2, Users } from 'lucide-react'
import { Avatar, Badge, Button, Card, Empty, InfoRow, PageHeader, PetAvatar, SearchInput, SectionLabel, Spinner } from '../components/ui'
import { ClientForm } from '../components/ClientModals'
import { ClientAppAccess } from '../components/ClientAppAccess'
import { PetDetail, PetForm } from '../components/PetModals'
import { db, useAction, useApp, useQuery } from '../lib/store'
import { clientSearch } from '../lib/search'
import { geocodeClient, fullAddress } from '../lib/geo'
import { statusTone } from '../lib/domain'
import { addressLine, ageText, cls, fmtDate, mapsLink, todayISO, waLink } from '../lib/util'

export default function Clients() {
  const { can, params, go, confirm, toast, settings } = useApp()
  const run = useAction()
  const [q, setQ] = useState('')
  const [selId, setSelId] = useState<number | null>(null)
  const [form, setForm] = useState<{ open: boolean; client?: any }>({ open: false })
  const [petForm, setPetForm] = useState<{ open: boolean; pet?: any }>({ open: false })
  const [petOpen, setPetOpen] = useState<number | null>(null)
  const [locating, setLocating] = useState(false)

  const cs = clientSearch(q, 'c')
  const { rows, loading } = useQuery(`SELECT c.*, (SELECT COUNT(*) FROM pets p WHERE p.client_id=c.id) AS pet_count FROM clients c WHERE ${cs.where} ORDER BY c.name`, cs.params)
  useEffect(() => { if (params?.clientId) { setSelId(params.clientId); setQ('') } }, [params])
  useEffect(() => { if (!selId && rows.length) setSelId(rows[0].id) }, [rows, selId])

  const client = useQuery('SELECT * FROM clients WHERE id=?', [selId || 0], !!selId).rows[0]
  const pets = useQuery('SELECT * FROM pets WHERE client_id=? ORDER BY name', [selId || 0], !!selId).rows
  const appts = useQuery('SELECT a.*, p.name AS pet_name FROM appointments a JOIN pets p ON p.id=a.pet_id WHERE a.client_id=? ORDER BY a.date DESC, a.start_time DESC LIMIT 12', [selId || 0], !!selId).rows

  const del = async () => {
    if (!(await confirm({ title: `Excluir ${client.name}?`, message: 'Os pets, vacinas e agendamentos deste cliente também serão apagados. Essa ação não pode ser desfeita.', confirmLabel: 'Excluir cliente', danger: true }))) return
    await run(async () => { await db.remove('clients', client.id); await db.audit('Excluiu cliente', 'Cliente', client.name); setSelId(null) }, 'Cliente excluído.')
  }
  const locate = async () => {
    setLocating(true)
    const r = await geocodeClient(client.id, client)
    setLocating(false)
    toast(r === 'ok' ? 'Endereço localizado no mapa.' : r === 'notfound' ? 'Não encontramos este endereço. Confira o CEP e o número.' : 'Sem conexão com o serviço de mapas. Tente novamente com internet.', r === 'ok' ? 'ok' : 'error')
  }
  const upcoming = useMemo(() => appts.filter((a: any) => a.date >= todayISO() && a.status !== 'Cancelado'), [appts])

  return (
    <>
      <PageHeader title="Clientes" subtitle={`${rows.length} ${rows.length === 1 ? 'tutor' : 'tutores'} ${q ? 'encontrados' : 'cadastrados'}`}>
        {can('clients_edit') && <Button icon={Plus} onClick={() => setForm({ open: true })}>Novo cliente</Button>}
      </PageHeader>
      <div className="m-stack grid grid-cols-[340px_1fr] items-start gap-6">
        <Card className="sticky top-0 p-4">
          <SearchInput value={q} onChange={setQ} placeholder="Nome, CPF ou telefone" />
          <div className="-mx-1 mt-3 max-h-[calc(100vh-290px)] overflow-y-auto px-1">
            {loading ? <Spinner /> : rows.length === 0 ? <Empty icon={Users} title="Nenhum cliente encontrado" text={q ? 'Confira o nome, CPF ou telefone digitado.' : 'Cadastre o primeiro cliente.'} /> : rows.map((c: any) => (
              <button key={c.id} onClick={() => setSelId(c.id)} className={cls('mb-1 flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition', selId === c.id ? 'bg-brand-50 ring-1 ring-brand-200' : 'hover:bg-paper')}>
                <Avatar name={c.name} size={42} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">{c.name}</span>
                  <span className="block truncate text-xs text-ink-muted">{c.phone || 'Sem telefone'}</span>
                </span>
                <Badge tone={c.pet_count ? 'orange' : 'gray'}>{c.pet_count} {c.pet_count === 1 ? 'pet' : 'pets'}</Badge>
              </button>
            ))}
          </div>
        </Card>

        {!client ? <Card><Empty icon={Users} title="Escolha um cliente" text="Selecione alguém na lista para ver pets, endereço e agendamentos." /></Card> : (
          <div className="space-y-5">
            <Card className="p-6">
              <div className="flex flex-wrap items-center gap-5">
                <Avatar name={client.name} size={72} />
                <div className="min-w-0 flex-1 sm:min-w-[280px]">
                  <h2 className="text-2xl font-extrabold tracking-tight">{client.name}</h2>
                  <p className="text-sm text-ink-muted">Cliente desde {fmtDate(client.created_at?.slice(0, 10))}{client.birth_date && ` · ${ageText(client.birth_date).split(' e ')[0]}`}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {client.phone && <Badge tone="gray"><Phone size={12} />{client.phone}</Badge>}
                    {client.contact_pref && <Badge tone="green">Prefere {client.contact_pref}</Badge>}
                    {!client.notify_ok && <Badge tone="red">Não quer notificações</Badge>}
                    {client.origin === 'app' && <Badge tone="blue">Cadastrou-se pelo app</Badge>}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 xl:ml-auto">
                  {can('appointments_edit') && <Button icon={CalendarPlus} onClick={() => go('appointments', { newFor: { clientId: client.id } })}>Agendar</Button>}
                  {client.whatsapp && <Button variant="secondary" icon={MessageCircle} onClick={() => window.api.app.openExternal(waLink(client.whatsapp))}>WhatsApp</Button>}
                  {can('clients_edit') && <Button variant="secondary" icon={Edit3} onClick={() => setForm({ open: true, client })}>Editar</Button>}
                  {can('delete_records') && <Button variant="danger" icon={Trash2} onClick={del}>Excluir</Button>}
                </div>
              </div>
            </Card>

            <div className="m-stack grid grid-cols-3 gap-5">
              <Card className="col-span-2 p-6">
                <div className="mb-1 flex items-center justify-between">
                  <SectionLabel>Pets de {client.name.split(' ')[0]}</SectionLabel>
                  {can('pets_edit') && <Button size="sm" variant="soft" icon={Plus} onClick={() => setPetForm({ open: true })}>Adicionar pet</Button>}
                </div>
                {pets.length === 0 ? <Empty title="Nenhum pet vinculado" text="Cadastre os cães deste tutor para poder agendar banho e tosa." /> : (
                  <div className="m-stack grid grid-cols-2 gap-3">
                    {pets.map((p: any) => (
                      <button key={p.id} onClick={() => setPetOpen(p.id)} className="flex items-center gap-3 rounded-2xl border border-paper-line p-3 text-left transition hover:border-brand-300 hover:bg-brand-50/40">
                        <PetAvatar src={p.photo} name={p.name} size={56} />
                        <span className="min-w-0"><span className="block truncate font-extrabold">{p.name}</span><span className="block truncate text-xs text-ink-muted">{p.breed || p.species} · {p.size || 'porte n/i'} · {ageText(p.birth_date)}</span></span>
                      </button>
                    ))}
                  </div>
                )}
              </Card>

              <Card className="p-6">
                <SectionLabel>Contato e preferências</SectionLabel>
                <InfoRow label="Telefone / WhatsApp">{client.phone}{client.whatsapp && client.whatsapp !== client.phone ? ` · ${client.whatsapp}` : ''}</InfoRow>
                <InfoRow label="E-mail">{client.email}</InfoRow>
                <InfoRow label="CPF">{client.cpf}</InfoRow>
                <InfoRow label="Horário preferido">{client.pref_time}</InfoRow>
                <InfoRow label="Atendimento">{client.pref_service}</InfoRow>
              </Card>

              <Card className="col-span-2 p-6">
                <div className="flex items-center justify-between"><SectionLabel>Endereço</SectionLabel>
                  <Badge tone={client.geo_status === 'ok' ? 'green' : client.geo_status === 'notfound' ? 'red' : 'amber'} dot>{client.geo_status === 'ok' ? 'Localizado no mapa' : client.geo_status === 'notfound' ? 'Não encontrado no mapa' : 'Aguardando localização'}</Badge>
                </div>
                <p className="text-sm font-semibold">{addressLine(client)}</p>
                {client.reference && <p className="mt-1 text-sm text-ink-muted">Referência: {client.reference}</p>}
                <div className="mt-4 flex flex-wrap gap-2">
                  {client.lat && can('map_view') && <Button size="sm" variant="secondary" icon={MapPin} onClick={() => go('map', { clientId: client.id })}>Ver no mapa</Button>}
                  <Button size="sm" variant="secondary" icon={ExternalLink} onClick={() => window.api.app.openExternal(mapsLink(fullAddress(client), settings.shop_address || undefined))}>Abrir rota no Google Maps</Button>
                  {client.geo_status !== 'ok' && <Button size="sm" variant="soft" loading={locating} onClick={locate}>Localizar no mapa</Button>}
                </div>
              </Card>

              <Card className="p-6">
                <SectionLabel>Observações</SectionLabel>
                <p className="whitespace-pre-wrap text-sm">{client.notes || '—'}</p>
              </Card>

              <div className="col-span-3"><ClientAppAccess client={client} /></div>

              <Card className="col-span-3 p-6">
                <SectionLabel>Agendamentos {upcoming.length ? `· ${upcoming.length} por vir` : ''}</SectionLabel>
                {appts.length === 0 ? <Empty title="Nenhum agendamento" text="Os atendimentos deste cliente aparecem aqui." /> : (
                  <div className="divide-y divide-paper-line">
                    {appts.map((a: any) => (
                      <div key={a.id} className="flex items-center gap-4 py-2.5 text-sm">
                        <span className="w-24 font-bold">{fmtDate(a.date)}</span><span className="w-14 text-ink-muted">{a.start_time}</span>
                        <span className="w-28 font-semibold">{a.pet_name}</span><span className="flex-1 text-ink-soft">{a.service_name}{a.origin === 'app' && <Badge tone="green" className="ml-2">App</Badge>}</span>
                        <Badge tone={statusTone(a.status)} dot>{a.status}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </div>
        )}
      </div>

      <ClientForm open={form.open} client={form.client} onClose={() => setForm({ open: false })} onSaved={(id) => setSelId(id)} />
      {petOpen && <PetDetail petId={petOpen} onClose={() => setPetOpen(null)} onEdit={(pet) => setPetForm({ open: true, pet })} />}
      <PetForm open={petForm.open} pet={petForm.pet} clientId={client?.id} onClose={() => setPetForm({ open: false })} onSaved={(id) => setPetOpen(id)} />
    </>
  )
}
