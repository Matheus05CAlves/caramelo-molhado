import { useEffect, useState } from 'react'
import { Search, X } from 'lucide-react'
import { Button, Input, Modal, Select, Textarea, Toggle, Avatar, SectionLabel } from './ui'
import { db, useAction, useApp, useQuery } from '../lib/store'
import { geocodeClient } from '../lib/geo'
import { UFS } from '../lib/domain'
import { clientSearch } from '../lib/search'
import { cls, maskCEP, maskCPF, maskPhone, onlyDigits, validCPF, validEmail } from '../lib/util'

const EMPTY = {
  name: '', cpf: '', phone: '', whatsapp: '', email: '', birth_date: '', cep: '', street: '', number: '', complement: '', neighborhood: '',
  city: '', state: 'SP', reference: '', pref_time: 'Sem preferência', pref_service: 'Cliente traz e retira', contact_pref: 'WhatsApp', notify_ok: 1, notes: '',
}
const ADDRESS_KEYS = ['cep', 'street', 'number', 'neighborhood', 'city', 'state']

export function ClientForm({ open, onClose, client, onSaved }: { open: boolean; onClose: () => void; client?: any; onSaved?: (id: number) => void }) {
  const { toast, user } = useApp()
  const run = useAction()
  const [f, setF] = useState<any>(EMPTY)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [cepBusy, setCepBusy] = useState(false)
  const [busy, setBusy] = useState(false)
  const set = (k: string) => (v: any) => setF((s: any) => ({ ...s, [k]: v }))

  useEffect(() => {
    if (open) { setF(client ? { ...EMPTY, ...client } : EMPTY); setErrors({}) }
  }, [open, client])

  const lookupCep = async (cep = f.cep) => {
    if (onlyDigits(cep).length !== 8) return
    setCepBusy(true)
    try {
      const a = await window.api.geo.cep(cep)
      setF((s: any) => ({ ...s, street: a.street || s.street, neighborhood: a.neighborhood || s.neighborhood, city: a.city || s.city, state: a.state || s.state, complement: s.complement || a.complement || '' }))
    } catch (e: any) {
      toast(e.message, 'error')
    } finally { setCepBusy(false) }
  }

  const save = async () => {
    const er: Record<string, string> = {}
    if (!f.name.trim()) er.name = 'Informe o nome completo.'
    if (f.cpf && !validCPF(f.cpf)) er.cpf = 'CPF inválido.'
    if (!f.phone.trim() || onlyDigits(f.phone).length < 10) er.phone = 'Informe um telefone com DDD.'
    if (f.email && !validEmail(f.email)) er.email = 'E-mail inválido.'
    if (f.cpf && !er.cpf) {
      const dup = await db.get('SELECT id, name FROM clients WHERE cpf = ? AND id <> ?', [f.cpf, client?.id || 0])
      if (dup) er.cpf = `CPF já cadastrado para ${dup.name}.`
    }
    setErrors(er)
    if (Object.keys(er).length) return toast('Confira os campos destacados.', 'error')

    setBusy(true)
    const data: any = {}
    for (const k of Object.keys(EMPTY)) data[k] = typeof f[k] === 'string' ? f[k].trim() : f[k]
    if (!data.whatsapp) data.whatsapp = data.phone
    const addressChanged = !client || ADDRESS_KEYS.some((k) => (client[k] || '') !== (data[k] || ''))
    if (addressChanged) { data.lat = null; data.lng = null; data.geo_status = 'pending' }
    const id = await run(async () => {
      if (client) { await db.update('clients', client.id, data); await db.audit('Editou cliente', 'Cliente', data.name); return client.id }
      const newId = await db.insert('clients', data)
      await db.audit('Cadastrou cliente', 'Cliente', data.name)
      return newId
    }, client ? 'Cliente atualizado.' : 'Cliente cadastrado.')
    setBusy(false)
    if (!id) return
    onSaved?.(id)
    onClose()
    if (addressChanged && (data.street || data.cep)) {
      geocodeClient(id, data).then((r) => {
        if (r === 'ok') toast('Endereço localizado no mapa.', 'info')
        else if (r === 'notfound') toast('Não encontramos este endereço no mapa. Confira o CEP e o número.', 'error')
      })
    }
  }

  return (
    <Modal open={open} onClose={onClose} size="lg" title={client ? 'Editar cliente' : 'Novo cliente'} subtitle="Dados do tutor, endereço e preferências de atendimento."
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button onClick={save} loading={busy}>Salvar cliente</Button></>}>
      <SectionLabel>Dados pessoais</SectionLabel>
      <div className="m-stack grid grid-cols-6 gap-4">
        <Input className="col-span-4" label="Nome completo" required value={f.name} onChange={set('name')} error={errors.name} autoFocus />
        <Input className="col-span-2" label="CPF" value={f.cpf} onChange={set('cpf')} mask={maskCPF} placeholder="000.000.000-00" error={errors.cpf} />
        <Input className="col-span-2" label="Telefone" required value={f.phone} onChange={set('phone')} mask={maskPhone} placeholder="(00) 00000-0000" error={errors.phone} />
        <Input className="col-span-2" label="WhatsApp" value={f.whatsapp} onChange={set('whatsapp')} mask={maskPhone} placeholder="Igual ao telefone" />
        <Input className="col-span-2" label="Data de nascimento" type="date" value={f.birth_date} onChange={set('birth_date')} />
        <Input className="col-span-4" label="E-mail" type="email" value={f.email} onChange={set('email')} error={errors.email} />
      </div>

      <div className="my-6 border-t border-paper-line" />
      <SectionLabel>Endereço</SectionLabel>
      <div className="m-stack grid grid-cols-6 gap-4">
        <div className="col-span-2 flex items-end gap-2">
          <Input className="flex-1" label="CEP" value={f.cep} onChange={(v) => { set('cep')(v); if (onlyDigits(v).length === 8) lookupCep(v) }} mask={maskCEP} placeholder="00000-000" />
          <Button variant="secondary" className="mb-0.5 !px-3" onClick={() => lookupCep()} loading={cepBusy} aria-label="Buscar CEP"><Search size={17} /></Button>
        </div>
        <Input className="col-span-3" label="Rua / Avenida" value={f.street} onChange={set('street')} />
        <Input className="col-span-1" label="Número" value={f.number} onChange={set('number')} />
        <Input className="col-span-2" label="Complemento" value={f.complement} onChange={set('complement')} />
        <Input className="col-span-2" label="Bairro" value={f.neighborhood} onChange={set('neighborhood')} />
        <Input className="col-span-1" label="Cidade" value={f.city} onChange={set('city')} />
        <Select className="col-span-1" label="Estado" value={f.state} onChange={set('state')} options={UFS} />
        <Input className="col-span-6" label="Ponto de referência" value={f.reference} onChange={set('reference')} hint="Ajuda o motorista na coleta e entrega. O mapa usa este endereço para localizar o cliente." />
      </div>

      <div className="my-6 border-t border-paper-line" />
      <SectionLabel>Preferências</SectionLabel>
      <div className="m-stack grid grid-cols-3 gap-4">
        <Select label="Preferência de horário" value={f.pref_time} onChange={set('pref_time')} options={['Sem preferência', 'Manhã', 'Tarde']} />
        <Select label="Preferência de atendimento" value={f.pref_service} onChange={set('pref_service')} options={['Cliente traz e retira', 'Leva e traz (coleta e entrega)', 'Somente busca', 'Somente entrega']} />
        <Select label="Melhor forma de contato" value={f.contact_pref} onChange={set('contact_pref')} options={['WhatsApp', 'Ligação', 'E-mail', 'SMS']} />
        <div className="col-span-3"><Toggle checked={!!f.notify_ok} onChange={(v) => set('notify_ok')(v ? 1 : 0)} label="Autoriza receber notificações" hint="Lembretes de agendamento e aviso de pet pronto para retirada." /></div>
        <Textarea className="col-span-3" label="Observações" value={f.notes} onChange={set('notes')} />
      </div>
    </Modal>
  )
}

/** Campo de busca de cliente por nome, CPF ou telefone. */
export function ClientPicker({ value, onChange, error, disabled, label = 'Cliente' }: { value?: number | null; onChange: (id: number | null, client?: any) => void; error?: string; disabled?: boolean; label?: string }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const cs = clientSearch(q, 'c')
  const { rows } = useQuery(`SELECT c.id, c.name, c.cpf, c.phone FROM clients c WHERE ${cs.where} ORDER BY c.name LIMIT 8`, cs.params, open)
  const { rows: sel } = useQuery('SELECT id, name, phone FROM clients WHERE id = ?', [value || 0], !!value)
  const chosen = value ? sel[0] : null

  return (
    <div className="relative">
      <span className="mb-1.5 block text-[13px] font-semibold text-ink-soft">{label} <span className="text-brand-500">*</span></span>
      {chosen ? (
        <div className={cls('flex items-center gap-3 rounded-xl border bg-paper px-3 py-2', error ? 'border-red-300' : 'border-paper-line')}>
          <Avatar name={chosen.name} size={30} />
          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{chosen.name}</span><span className="block text-xs text-ink-muted">{chosen.phone}</span></span>
          {!disabled && <button type="button" onClick={() => { onChange(null); setQ('') }} aria-label="Trocar cliente" className="grid h-7 w-7 place-items-center rounded-lg text-ink-muted hover:bg-white"><X size={16} /></button>}
        </div>
      ) : (
        <>
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
            <input value={q} disabled={disabled} onChange={(e) => { setQ(e.target.value); setOpen(true) }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} placeholder="Buscar por nome, CPF ou telefone" className={cls('w-full rounded-xl border bg-paper py-2.5 pl-10 pr-3.5 text-sm focus:bg-white focus:outline-none focus:ring-2', error ? 'border-red-300 focus:ring-red-100' : 'border-paper-line focus:border-brand-400 focus:ring-brand-100')} />
          </div>
          {open && (
            <div className="absolute left-0 right-0 top-full z-30 mt-1.5 max-h-64 overflow-y-auto rounded-2xl border border-paper-line bg-white p-1.5 shadow-lift">
              {rows.length === 0 && <p className="px-3 py-4 text-center text-sm text-ink-muted">Nenhum cliente encontrado.</p>}
              {rows.map((c: any) => (
                <button type="button" key={c.id} onMouseDown={(e) => e.preventDefault()} onClick={() => { onChange(c.id, c); setOpen(false); setQ('') }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-paper">
                  <Avatar name={c.name} size={30} />
                  <span className="min-w-0"><span className="block truncate text-sm font-bold">{c.name}</span><span className="block text-xs text-ink-muted">{c.phone} {c.cpf && `· ${c.cpf}`}</span></span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
      {error && <span className="mt-1 block text-xs font-medium text-red-500">{error}</span>}
    </div>
  )
}
