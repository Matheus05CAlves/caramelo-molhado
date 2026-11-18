import { useState } from 'react'
import { CalendarCheck, Check, HeartHandshake, MessageCircle, Smartphone, UserPlus, X } from 'lucide-react'
import { Avatar, Badge, Button, Card, Empty, Modal, PageHeader, PetAvatar, Spinner, Tabs, Textarea } from '../components/ui'
import { AppointmentDetail, AppointmentForm } from '../components/AppointmentModals'
import { db, useAction, useApp, useQuery } from '../lib/store'
import { APPT_SELECT, changeStatus } from '../lib/appointments'
import { statusTone } from '../lib/domain'
import { addDays, brl, endTime, fmtDate, fmtDateTime, longDate, todayISO, waLink } from '../lib/util'

type Tab = 'pending' | 'cancelled' | 'clients' | 'adoption'

/** Tudo o que chegou pelo app do cliente: pedidos de horário, cancelamentos, novos cadastros e interesse em adoção. */
export default function Requests() {
  const { can, go } = useApp()
  const run = useAction()
  const [tab, setTab] = useState<Tab>('pending')
  const [detail, setDetail] = useState<number | null>(null)
  const [form, setForm] = useState<{ open: boolean; appt?: any; mode?: 'edit' | 'reschedule' }>({ open: false })
  const [refuse, setRefuse] = useState<any>(null)
  const [reason, setReason] = useState('')
  const today = todayISO()
  const since = addDays(today, -30)
  const canEdit = can('appointments_edit')

  const pending = useQuery(`${APPT_SELECT} WHERE a.origin='app' AND a.status='Agendado' AND a.date>=? ORDER BY a.date, a.start_time`, [today])
  const cancelled = useQuery(`${APPT_SELECT} WHERE a.cancel_reason LIKE 'Cancelado pelo cliente%' AND a.date>=? ORDER BY a.updated_at DESC LIMIT 50`, [since])
  const clients = useQuery(`SELECT c.*, ca.email AS app_email, ca.active AS app_active, ca.last_login, (SELECT COUNT(*) FROM pets p WHERE p.client_id=c.id) AS pet_count
    FROM client_accounts ca JOIN clients c ON c.id=ca.client_id ORDER BY ca.id DESC LIMIT 100`)
  const adoption = useQuery(`SELECT i.*, a.name AS animal_name, a.photo AS animal_photo, a.status AS animal_status FROM adoption_interested i LEFT JOIN adoption_animals a ON a.id=i.animal_id
    WHERE i.origin='app' ORDER BY i.id DESC LIMIT 60`)

  const confirmAppt = (a: any) => run(() => changeStatus(a, 'Confirmado'), `${a.pet_name}: horário confirmado. O cliente foi avisado no app.`)
  const doRefuse = async () => {
    const a = refuse
    const ok = await run(async () => {
      await db.update('appointments', a.id, { status: 'Cancelado', cancel_reason: `Recusado pelo pet shop${reason.trim() ? `: ${reason.trim()}` : ''}`, updated_at: new Date().toISOString().slice(0, 16).replace('T', ' ') })
      await db.audit('Recusou pedido do app', 'Agendamento', `${a.pet_name}: ${a.service_name} ${fmtDate(a.date)} ${a.start_time}`)
      return true
    }, 'Pedido recusado. O cliente foi avisado no app.')
    if (ok) { setRefuse(null); setReason('') }
  }

  const activeAccounts = clients.rows.filter((c: any) => c.app_active).length

  return (
    <>
      <PageHeader title="Pedidos pelo App" subtitle={`O que os clientes fizeram pelo app · ${activeAccounts} ${activeAccounts === 1 ? 'cliente usa' : 'clientes usam'} o app`} />
      <Tabs value={tab} onChange={setTab} tabs={[
        { value: 'pending', label: 'A confirmar', count: pending.rows.length },
        { value: 'cancelled', label: 'Cancelados pelo cliente', count: cancelled.rows.length },
        { value: 'clients', label: 'Clientes com app', count: clients.rows.length },
        { value: 'adoption', label: 'Interesse em adoção', count: adoption.rows.length },
      ]} />
      <div className="pt-6">
        {tab === 'pending' && (pending.loading ? <Spinner /> : pending.rows.length === 0
          ? <Card><Empty icon={CalendarCheck} title="Nenhum pedido esperando" text="Quando um cliente marcar um horário pelo app, ele aparece aqui para você confirmar." /></Card>
          : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
              {pending.rows.map((a: any) => (
                <Card key={a.id} className="flex flex-col p-5">
                  <div className="flex items-center justify-between gap-2">
                    <Badge tone="orange">{a.date === today ? 'Hoje' : longDate(a.date)}</Badge>
                    <span className="text-sm font-extrabold">{a.start_time}–{endTime(a.start_time, a.duration_min)}</span>
                  </div>
                  <button onClick={() => setDetail(a.id)} className="mt-3 flex items-center gap-3 text-left">
                    <PetAvatar src={a.pet_photo} name={a.pet_name} size={52} />
                    <span className="min-w-0"><span className="block truncate text-[15px] font-extrabold">{a.pet_name}</span><span className="block truncate text-xs text-ink-muted">{a.client_name} · {a.client_phone}</span></span>
                  </button>
                  <p className="mt-3 text-sm font-bold">{a.service_name} <span className="font-semibold text-ink-muted">· {brl(a.price)}</span></p>
                  {(a.pickup || a.delivery) ? <p className="text-xs font-semibold text-blue-700">{[a.pickup && 'Pediu busca', a.delivery && 'pediu entrega'].filter(Boolean).join(' e ')}</p> : null}
                  {(a.pet_allergies || a.pet_restrictions) && <p className="mt-1 text-xs text-brand-700">⚠ {[a.pet_allergies, a.pet_restrictions].filter(Boolean).join(' · ')}</p>}
                  {a.notes && <p className="mt-2 rounded-xl bg-paper p-2.5 text-xs text-ink-soft">“{a.notes}”</p>}
                  <div className="mt-auto flex flex-wrap gap-2 pt-4">
                    {canEdit && <Button size="sm" variant="success" icon={Check} onClick={() => confirmAppt(a)}>Confirmar</Button>}
                    {canEdit && <Button size="sm" variant="secondary" onClick={() => setForm({ open: true, appt: a, mode: 'reschedule' })}>Remarcar</Button>}
                    {canEdit && <Button size="sm" variant="danger" icon={X} onClick={() => setRefuse(a)}>Recusar</Button>}
                    {a.client_whatsapp && <Button size="sm" variant="ghost" icon={MessageCircle} onClick={() => window.api.app.openExternal(waLink(a.client_whatsapp))}>WhatsApp</Button>}
                  </div>
                </Card>
              ))}
            </div>
          ))}

        {tab === 'cancelled' && (cancelled.rows.length === 0 ? <Card><Empty icon={CalendarCheck} title="Nenhum cancelamento pelo app" text="Cancelamentos feitos pelos clientes nos últimos 30 dias aparecem aqui." /></Card> : (
          <Card className="divide-y divide-paper-line">
            {cancelled.rows.map((a: any) => (
              <button key={a.id} onClick={() => setDetail(a.id)} className="flex w-full flex-wrap items-center gap-3 px-5 py-3.5 text-left hover:bg-paper/60">
                <PetAvatar src={a.pet_photo} name={a.pet_name} size={40} />
                <span className="min-w-0 flex-1"><b>{a.pet_name}</b> <span className="text-ink-muted">· {a.client_name}</span><span className="block text-xs text-ink-muted">{a.service_name} em {fmtDate(a.date)} às {a.start_time} · {a.cancel_reason}</span></span>
                <span className="text-xs text-ink-muted">{fmtDateTime(a.updated_at)}</span>
              </button>
            ))}
          </Card>
        ))}

        {tab === 'clients' && (clients.rows.length === 0 ? <Card><Empty icon={UserPlus} title="Nenhum cliente usa o app ainda" text="Na ficha de cada cliente você gera um código de acesso para enviar pelo WhatsApp." /></Card> : (
          <Card className="divide-y divide-paper-line">
            {clients.rows.map((c: any) => (
              <button key={c.id} onClick={() => go('clients', { clientId: c.id })} className="flex w-full flex-wrap items-center gap-3 px-5 py-3.5 text-left hover:bg-paper/60">
                <Avatar name={c.name} size={40} />
                <span className="min-w-0 flex-1"><b>{c.name}</b><span className="block text-xs text-ink-muted">{c.app_email} · {c.pet_count} {c.pet_count === 1 ? 'pet' : 'pets'} · último acesso {fmtDateTime(c.last_login)}</span></span>
                {c.origin === 'app' && <Badge tone="blue">Cadastrou-se pelo app</Badge>}
                <Badge tone={c.app_active ? 'green' : 'red'} dot>{c.app_active ? 'Ativo' : 'Bloqueado'}</Badge>
              </button>
            ))}
          </Card>
        ))}

        {tab === 'adoption' && (adoption.rows.length === 0 ? <Card><Empty icon={HeartHandshake} title="Nenhum interesse pelo app" text="Clientes que tocarem em “Quero conhecer” em um animal aparecem aqui." /></Card> : (
          <Card className="divide-y divide-paper-line">
            {adoption.rows.map((i: any) => (
              <div key={i.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                <PetAvatar src={i.animal_photo} name={i.animal_name} size={44} />
                <div className="min-w-0 flex-1"><p><b>{i.name}</b> quer conhecer <b>{i.animal_name || 'um animal'}</b></p><p className="text-xs text-ink-muted">{i.phone} · {fmtDateTime(i.created_at)}{i.notes ? ` · “${i.notes}”` : ''}</p></div>
                {i.animal_status && <Badge tone={statusTone(i.animal_status)}>{i.animal_status}</Badge>}
                {i.phone && <Button size="sm" variant="secondary" icon={MessageCircle} onClick={() => window.api.app.openExternal(waLink(i.phone))}>WhatsApp</Button>}
              </div>
            ))}
          </Card>
        ))}
      </div>

      <div className="mt-6 flex items-center gap-2 text-xs text-ink-muted"><Smartphone size={14} />Confirmações, remarcações e mudanças de status geram aviso automático no app do cliente.</div>

      <Modal open={!!refuse} onClose={() => setRefuse(null)} size="sm" title="Recusar pedido" subtitle={refuse ? `${refuse.pet_name} · ${refuse.service_name} em ${fmtDate(refuse.date)} às ${refuse.start_time}` : ''}
        footer={<><Button variant="secondary" onClick={() => setRefuse(null)}>Voltar</Button><Button variant="danger" className="!bg-red-500 !text-white" onClick={doRefuse}>Recusar e avisar cliente</Button></>}>
        <Textarea label="Motivo (aparece para o cliente)" value={reason} onChange={setReason} rows={3} placeholder="Ex.: agenda cheia nesse horário, podemos às 15h?" />
      </Modal>
      <AppointmentForm open={form.open} appt={form.appt} mode={form.mode} onClose={() => setForm({ open: false })} />
      {detail && <AppointmentDetail id={detail} onClose={() => setDetail(null)} onEdit={(appt, mode) => { setDetail(null); setForm({ open: true, appt, mode }) }} />}
    </>
  )
}
