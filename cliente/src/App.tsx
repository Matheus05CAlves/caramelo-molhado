import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  Bath, Bell, CalendarCheck, CalendarPlus, Camera, Check, CheckCircle2, ChevronRight, Clock, HeartHandshake, Home, KeyRound, LogOut, MapPin,
  MessageCircle, Pencil, PawPrint, Phone, Plus, Scissors, Sparkles, Syringe, Truck, User, Wifi, XCircle,
} from 'lucide-react'
import { api, clearToken, getServer, hasToken, openLink, ping, setServer } from './api'
import { Badge, Button, Card, Choice, Empty, Input, PetPhoto, Sheet, Spinner, Switch, TextArea, TopBar } from './ui'
import { Mascot } from '../../src/components/Mascot'
import { STATUSES, SIZES, SEXES, SPECIES, UFS, statusTone } from '../../src/lib/domain'
import { addDays, ageText, brl, cls, dayDiff, endTime, fileToDataUrl, fmtDate, fmtDateTime, longDate, maskCEP, maskCPF, maskPhone, onlyDigits, parseISO, todayISO, validEmail, waLink, WEEKDAYS, WEEKDAYS_SHORT } from '../../src/lib/util'

/* ======================= estado global ======================= */
type Tab = 'home' | 'pets' | 'book' | 'agenda' | 'more'
interface Ctx {
  loja: any; me: any; setMe: (m: any) => void; tab: Tab; go: (t: Tab, params?: any) => void; params: any
  toast: (m: string, kind?: 'ok' | 'error') => void; version: number; reload: () => void; logout: () => void
}
const AppCtx = createContext<Ctx>(null as any)
const useApp = () => useContext(AppCtx)

function useLoad<T = any>(action: string, body: any = {}, enabled = true) {
  const { version, toast } = useApp()
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const key = action + JSON.stringify(body)
  useEffect(() => {
    if (!enabled) { setLoading(false); return }
    let live = true
    setLoading(true)
    api<T>(action, body).then((d) => live && setData(d)).catch((e) => live && toast(e.message, 'error')).finally(() => live && setLoading(false))
    return () => { live = false }
  }, [key, version, enabled]) // eslint-disable-line
  return { data, loading }
}

const PASSWORD_RULES: [RegExp | ((s: string) => boolean), string][] = [
  [(s) => s.length >= 9, '9 caracteres ou mais'], [/[a-z]/, 'uma letra minúscula'], [/[A-Z]/, 'uma letra maiúscula'], [/[^A-Za-z0-9]/, 'um caractere especial'],
]
const pwOk = (pw: string) => PASSWORD_RULES.every(([r]) => (typeof r === 'function' ? r(pw) : r.test(pw)))
function PwRules({ pw }: { pw: string }) {
  return (
    <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-white px-4 py-3 text-xs">
      {PASSWORD_RULES.map(([r, label]) => {
        const ok = typeof r === 'function' ? r(pw) : r.test(pw)
        return <span key={label} className={cls('flex items-center gap-1.5 font-semibold', ok ? 'text-leaf-600' : 'text-ink-muted')}>{ok ? <Check size={13} /> : <span className="h-1.5 w-1.5 rounded-full bg-gray-300" />}{label}</span>
      })}
    </div>
  )
}

const iconFor = (name = '', cat = '') => /tosa/i.test(name + cat) ? Scissors : /banho|hidrata/i.test(name + cat) ? Bath : Sparkles
const fullDate = (iso: string) => (iso === todayISO() ? 'Hoje' : iso === addDays(todayISO(), 1) ? 'Amanhã' : longDate(iso))
const shopHoursText = (hours: any) => {
  if (!hours) return []
  return [1, 2, 3, 4, 5, 6, 0].map((d) => { const h = hours[d]; return { day: WEEKDAYS[d], text: h?.open ? `${h.start} às ${h.end}` : 'Fechado' } })
}

/* ======================= conexão e login ======================= */
function Connect({ onDone }: { onDone: () => void }) {
  const [url, setUrl] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(''); setBusy(true)
    try { await ping(url); setServer(url); onDone() } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }
  return (
    <form onSubmit={submit} className="mx-auto flex min-h-full max-w-md flex-col justify-center px-6 py-10">
      <Mascot size={120} className="mx-auto" />
      <h1 className="mt-4 text-center text-2xl font-extrabold">Conectar ao seu pet shop</h1>
      <p className="mb-6 mt-1 text-center text-sm text-ink-muted">Digite o endereço que o pet shop passou para você.</p>
      <Input label="Endereço" value={url} onChange={setUrl} placeholder="ex.: petshop.com.br ou 192.168.0.10:3737" inputMode="url" autoCapitalize="none" autoCorrect="off" error={err} />
      <Button type="submit" size="lg" icon={Wifi} className="mt-5 w-full" loading={busy} disabled={!url.trim()}>Conectar</Button>
    </form>
  )
}

function Auth({ loja, onLogged }: { loja: any; onLogged: (me: any) => void }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [hasCode, setHasCode] = useState(false)
  const [f, setF] = useState({ email: '', password: '', name: '', phone: '', code: '', again: '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }))
  const signupClosed = loja && !loja.signupOpen
  useEffect(() => { if (signupClosed) setHasCode(true) }, [signupClosed])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(''); setBusy(true)
    try {
      const me = mode === 'login'
        ? await api('login', { email: f.email, password: f.password })
        : await api('cadastro', { email: f.email, password: f.password, ...(hasCode ? { invite_code: f.code } : { name: f.name, phone: f.phone }) })
      onLogged(me)
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }
  const canSignup = validEmail(f.email) && pwOk(f.password) && f.password === f.again && (hasCode ? f.code.trim().length >= 6 : f.name.trim().length >= 3 && onlyDigits(f.phone).length >= 10)

  return (
    <div className="min-h-full bg-gradient-to-b from-brand-500 via-brand-400 to-paper to-[42%]">
      <div className="px-6 pb-6 pt-[max(2.5rem,env(safe-area-inset-top))] text-center text-white">
        <span className="mx-auto grid h-28 w-28 place-items-center rounded-full bg-white/95 shadow-lift"><Mascot size={96} /></span>
        <h1 className="mt-4 text-[26px] font-extrabold leading-tight">{loja?.name || 'Caramelo Molhado'}</h1>
        <p className="mx-auto mt-1 max-w-xs text-sm text-white/90">{loja?.welcome || 'Agende banho e tosa do seu pet pelo celular.'}</p>
      </div>
      <form onSubmit={submit} className="mx-auto max-w-md px-4 pb-10">
        <Card className="p-5">
          <div className="mb-5 grid grid-cols-2 rounded-2xl bg-paper p-1">
            {(['login', 'signup'] as const).map((m) => <button type="button" key={m} onClick={() => { setMode(m); setErr('') }} className={cls('rounded-xl py-2.5 text-sm font-extrabold transition', mode === m ? 'bg-white text-brand-600 shadow-sm' : 'text-ink-muted')}>{m === 'login' ? 'Entrar' : 'Criar conta'}</button>)}
          </div>
          <div className="space-y-4">
            {mode === 'signup' && (
              <>
                {!signupClosed && <Switch checked={hasCode} onChange={setHasCode} label="Tenho um código da loja" hint="Já sou cliente: meus pets e histórico aparecem na hora." />}
                {hasCode
                  ? <Input label="Código de acesso" value={f.code} onChange={(v) => set('code')(v.toUpperCase())} placeholder="ABC123" autoCapitalize="characters" className="[&_input]:text-center [&_input]:font-mono [&_input]:text-xl [&_input]:tracking-[.3em]" />
                  : <><Input label="Seu nome" value={f.name} onChange={set('name')} autoComplete="name" /><Input label="Celular (WhatsApp)" value={f.phone} onChange={set('phone')} mask={maskPhone} inputMode="tel" autoComplete="tel" /></>}
              </>
            )}
            <Input label="E-mail" type="email" value={f.email} onChange={set('email')} autoComplete="email" inputMode="email" autoCapitalize="none" />
            <Input label="Senha" type="password" value={f.password} onChange={set('password')} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
            {mode === 'signup' && <><PwRules pw={f.password} /><Input label="Repita a senha" type="password" value={f.again} onChange={set('again')} error={f.again && f.again !== f.password ? 'As senhas não conferem.' : ''} /></>}
          </div>
          {err && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-[13px] font-semibold text-red-600">{err}</p>}
          <Button type="submit" size="lg" className="mt-5 w-full" loading={busy} disabled={mode === 'login' ? !f.email || !f.password : !canSignup}>{mode === 'login' ? 'Entrar' : 'Criar minha conta'}</Button>
        </Card>
        {mode === 'login' && <p className="mt-4 text-center text-xs text-ink-muted">Esqueceu a senha? Fale com o pet shop{loja?.phone ? ` pelo ${loja.phone}` : ''}.</p>}
      </form>
    </div>
  )
}

/* ======================= início ======================= */
function HomeTab() {
  const { me, loja, go } = useApp()
  const appts = useLoad<any[]>('agendamentos')
  const pets = useLoad<any[]>('pets')
  const avisos = useLoad<any[]>('avisos')
  const [svc, setSvc] = useState<any>(null)
  const now = `${todayISO()} 00:00`
  const next = (appts.data || []).filter((a) => !['Cancelado', 'Entregue'].includes(a.status) && `${a.date} ${a.start_time}` >= now)
  const unread = (avisos.data || []).filter((a) => !a.read).length
  const vaccines = (pets.data || []).flatMap((p) => (p.vaccines_due || []).map((v: any) => ({ ...v, pet: p.name, diff: dayDiff(v.next_dose, todayISO()) }))).filter((v) => v.diff <= 30).sort((a, b) => a.diff - b.diff)
  const hour = new Date().getHours()
  const greet = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'
  const categories = useMemo(() => { const m: Record<string, any[]> = {}; (loja?.services || []).forEach((s: any) => (m[s.category] ||= []).push(s)); return m }, [loja])

  return (
    <div className="pb-6">
      <div className="rounded-b-[32px] bg-gradient-to-br from-brand-500 to-brand-400 px-5 pb-7 pt-[max(1.25rem,env(safe-area-inset-top))] text-white">
        <div className="flex items-center justify-between">
          <div><p className="text-sm text-white/85">{greet},</p><p className="text-2xl font-extrabold">{me.client.name.split(' ')[0]}! 🐾</p></div>
          <button onClick={() => go('more', { open: 'avisos' })} aria-label="Avisos" className="relative grid h-12 w-12 place-items-center rounded-2xl bg-white/20">
            <Bell size={22} />{unread > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-yellow-300 px-1 text-[11px] font-extrabold text-ink">{unread}</span>}
          </button>
        </div>
        {next[0] ? (
          <button onClick={() => go('agenda')} className="mt-5 flex w-full items-center gap-3 rounded-3xl bg-white p-4 text-left text-ink shadow-lift">
            <PetPhoto src={next[0].pet_photo} name={next[0].pet_name} size={56} />
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-bold text-brand-600">Próximo atendimento</span>
              <span className="block truncate text-[15px] font-extrabold">{next[0].pet_name} · {next[0].service_name}</span>
              <span className="block text-xs text-ink-muted">{fullDate(next[0].date)} às {next[0].start_time}</span>
            </span>
            <Badge tone={statusTone(next[0].status)}>{next[0].status}</Badge>
          </button>
        ) : (
          <div className="mt-5 flex items-center gap-4 rounded-3xl bg-white/15 p-4">
            <Mascot size={64} />
            <div className="flex-1"><p className="font-extrabold">Que tal um banho?</p><p className="text-xs text-white/85">Seu pet não tem nada marcado.</p></div>
            {loja?.booking?.enabled && <button onClick={() => go('book')} className="rounded-full bg-yellow-300 px-4 py-2.5 text-sm font-extrabold text-ink">Agendar</button>}
          </div>
        )}
      </div>

      <div className="space-y-6 px-4 pt-5">
        {vaccines.length > 0 && (
          <Card className="border-brand-200 bg-brand-50/60 p-4">
            <p className="mb-2 flex items-center gap-2 text-sm font-extrabold text-brand-700"><Syringe size={17} />Vacinas pedindo atenção</p>
            {vaccines.slice(0, 4).map((v, i) => <p key={i} className="text-sm"><b>{v.pet}</b> · {v.name}: {v.diff < 0 ? <span className="font-bold text-red-600">venceu em {fmtDate(v.next_dose)}</span> : `vence ${v.diff === 0 ? 'hoje' : `em ${v.diff} dia(s)`}`}</p>)}
          </Card>
        )}

        <section>
          <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-extrabold">Meus pets</h2><button onClick={() => go('pets', { add: true })} className="text-sm font-bold text-brand-600">+ Adicionar</button></div>
          {pets.loading ? <Spinner /> : !pets.data?.length ? (
            <Card><Empty title="Cadastre seu primeiro pet" text="Assim você já pode agendar banho e tosa." action={<Button icon={Plus} onClick={() => go('pets', { add: true })}>Cadastrar pet</Button>} /></Card>
          ) : (
            <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
              {pets.data.map((p) => (
                <button key={p.id} onClick={() => go('pets', { id: p.id })} className="w-32 shrink-0 rounded-3xl border border-paper-line/70 bg-white p-3 text-center shadow-soft">
                  <PetPhoto src={p.photo} name={p.name} size={72} className="mx-auto" />
                  <p className="mt-2 truncate font-extrabold">{p.name}</p><p className="truncate text-xs text-ink-muted">{p.breed || p.species}</p>
                </button>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-lg font-extrabold">Serviços e preços</h2>
          <div className="space-y-4">
            {Object.entries(categories).map(([cat, list]) => (
              <div key={cat}>
                <p className="mb-2 text-xs font-extrabold uppercase tracking-wider text-ink-muted">{cat}</p>
                <Card className="divide-y divide-paper-line">
                  {list.map((s: any) => { const Icon = iconFor(s.name, s.category); return (
                    <button key={s.id} onClick={() => setSvc(s)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-600"><Icon size={20} /></span>
                      <span className="min-w-0 flex-1"><span className="block font-bold">{s.name}</span><span className="block truncate text-xs text-ink-muted">{s.description || `${s.duration_min} min`}</span></span>
                      <span className="text-right"><span className="block font-extrabold">{brl(s.price)}</span><span className="block text-[11px] text-ink-muted">{s.duration_min} min</span></span>
                    </button>
                  ) })}
                </Card>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-muted">Valores de referência. O preço final pode variar conforme porte e pelagem.</p>
        </section>
      </div>

      <Sheet open={!!svc} onClose={() => setSvc(null)} title={svc?.name || ''} footer={loja?.booking?.enabled && <Button size="lg" icon={CalendarPlus} className="w-full" onClick={() => { const s = svc; setSvc(null); go('book', { serviceId: s.id }) }}>Agendar este serviço</Button>}>
        {svc && <div className="space-y-3"><Card className="p-5"><p className="text-3xl font-extrabold">{brl(svc.price)}</p><p className="text-sm text-ink-muted">{svc.category} · cerca de {svc.duration_min} minutos</p>{svc.description && <p className="mt-3 text-[15px] leading-relaxed">{svc.description}</p>}</Card></div>}
      </Sheet>
    </div>
  )
}

/* ======================= pets ======================= */
function PetForm({ pet, onClose, onSaved }: { pet?: any; onClose: () => void; onSaved: (id: number) => void }) {
  const { toast } = useApp()
  const [f, setF] = useState<any>(pet || { name: '', species: 'Cachorro', sex: 'Macho', size: 'Pequeno', breed: '', birth_date: '', weight: '', color: '', temperament: '', fears: '', allergies: '', restrictions: '', notes: '', photo: null })
  const [busy, setBusy] = useState(false)
  const set = (k: string) => (v: any) => setF((s: any) => ({ ...s, [k]: v }))
  const pickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) try { set('photo')(await fileToDataUrl(file, 600)) } catch (er: any) { toast(er.message, 'error') } }
  const save = async () => {
    setBusy(true)
    try { const r = await api('pet:salvar', { ...f, id: pet?.id }); toast(pet ? 'Dados do pet atualizados.' : `${f.name} foi cadastrado(a)!`); onSaved(r.id) } catch (e: any) { toast(e.message, 'error') } finally { setBusy(false) }
  }
  return (
    <Sheet open onClose={onClose} title={pet ? `Editar ${pet.name}` : 'Novo pet'} footer={<Button size="lg" className="w-full" loading={busy} disabled={!f.name?.trim()} onClick={save}>Salvar</Button>}>
      <div className="space-y-4">
        <label className="mx-auto block w-fit cursor-pointer text-center">
          <span className="relative block"><PetPhoto src={f.photo} name={f.name} size={104} className="mx-auto rounded-[28px]" /><span className="absolute -bottom-1 -right-1 grid h-9 w-9 place-items-center rounded-full bg-brand-500 text-white shadow"><Camera size={17} /></span></span>
          <input type="file" accept="image/*" className="hidden" onChange={pickPhoto} />
          <span className="mt-2 block text-xs font-bold text-brand-600">{f.photo ? 'Trocar foto' : 'Adicionar foto'}</span>
        </label>
        <Input label="Nome" value={f.name} onChange={set('name')} />
        <Choice label="Espécie" value={f.species || 'Cachorro'} onChange={set('species')} options={SPECIES} />
        <Choice label="Sexo" value={f.sex || 'Macho'} onChange={set('sex')} options={SEXES} />
        <Choice label="Porte" value={f.size || 'Pequeno'} onChange={set('size')} options={SIZES} />
        <Input label="Raça" value={f.breed} onChange={set('breed')} placeholder="ex.: Shih-tzu, vira-lata" />
        <div className="grid grid-cols-2 gap-3"><Input label="Nascimento" type="date" value={f.birth_date} onChange={set('birth_date')} /><Input label="Peso (kg)" inputMode="decimal" value={f.weight ?? ''} onChange={set('weight')} /></div>
        <Input label="Cor / pelagem" value={f.color} onChange={set('color')} />
        <Input label="Temperamento" value={f.temperament} onChange={set('temperament')} placeholder="ex.: calmo, agitado, brincalhão" />
        <Input label="Medos" value={f.fears} onChange={set('fears')} placeholder="ex.: secador, barulho" />
        <Input label="Alergias" value={f.allergies} onChange={set('allergies')} />
        <Input label="Restrições / cuidados" value={f.restrictions} onChange={set('restrictions')} />
        <TextArea label="Observações para a equipe" value={f.notes} onChange={set('notes')} />
      </div>
    </Sheet>
  )
}

function PetDetail({ id, onClose, onEdit }: { id: number; onClose: () => void; onEdit: (p: any) => void }) {
  const { go } = useApp()
  const { data } = useLoad<any>('pet:detalhe', { id })
  const p = data?.pet
  return (
    <Sheet open onClose={onClose} title={p?.name || 'Pet'} footer={p && <div className="flex gap-2"><Button variant="secondary" icon={Pencil} className="flex-1" onClick={() => onEdit(p)}>Editar</Button><Button icon={CalendarPlus} className="flex-1" onClick={() => { onClose(); go('book', { petId: p.id }) }}>Agendar</Button></div>}>
      {!data ? <Spinner /> : (
        <div className="space-y-4">
          <Card className="flex items-center gap-4 p-4">
            <PetPhoto src={p.photo} name={p.name} size={84} className="rounded-3xl" />
            <div className="min-w-0 text-sm"><p className="text-xl font-extrabold">{p.name}</p><p className="text-ink-muted">{[p.species, p.breed, p.sex].filter(Boolean).join(' · ')}</p><p className="text-ink-muted">{[p.size, p.weight && `${p.weight} kg`, p.birth_date && ageText(p.birth_date)].filter(Boolean).join(' · ')}</p></div>
          </Card>
          {(p.allergies || p.restrictions || p.fears) && <Card className="space-y-1 p-4 text-sm">{p.allergies && <p><b>Alergias:</b> {p.allergies}</p>}{p.restrictions && <p><b>Cuidados:</b> {p.restrictions}</p>}{p.fears && <p><b>Medos:</b> {p.fears}</p>}</Card>}
          <div>
            <p className="mb-2 flex items-center gap-2 text-sm font-extrabold"><Syringe size={16} />Carteira de vacinação</p>
            <Card className="divide-y divide-paper-line">
              {data.vaccines.length === 0 ? <p className="p-4 text-sm text-ink-muted">Nenhuma vacina registrada pelo pet shop.</p> : data.vaccines.map((v: any) => {
                const d = v.next_dose ? dayDiff(v.next_dose, todayISO()) : null
                return <div key={v.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm"><span><b>{v.name}</b><span className="block text-xs text-ink-muted">Aplicada {fmtDate(v.applied_at)}{v.vet ? ` · ${v.vet}` : ''}</span></span>{v.next_dose && <Badge tone={d! < 0 ? 'red' : d! <= 30 ? 'orange' : 'green'}>{d! < 0 ? 'Atrasada' : `Próx. ${fmtDate(v.next_dose).slice(0, 5)}`}</Badge>}</div>
              })}
            </Card>
          </div>
          {data.weights.length > 1 && (
            <div><p className="mb-2 text-sm font-extrabold">Peso</p><Card className="no-scrollbar flex gap-4 overflow-x-auto p-4">{data.weights.map((w: any, i: number) => <div key={i} className="shrink-0 text-center"><p className="font-extrabold">{w.weight} kg</p><p className="text-[11px] text-ink-muted">{fmtDate(w.date)}</p></div>)}</Card></div>
          )}
          <div>
            <p className="mb-2 text-sm font-extrabold">Histórico de atendimentos</p>
            <Card className="divide-y divide-paper-line">
              {data.history.length === 0 ? <p className="p-4 text-sm text-ink-muted">Ainda sem atendimentos.</p> : data.history.map((a: any) => (
                <div key={a.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm"><span><b>{a.service_name}</b><span className="block text-xs text-ink-muted">{fmtDate(a.date)} às {a.start_time}</span></span><Badge tone={statusTone(a.status)}>{a.status}</Badge></div>
              ))}
            </Card>
          </div>
        </div>
      )}
    </Sheet>
  )
}

function PetsTab() {
  const { params, reload } = useApp()
  const { data, loading } = useLoad<any[]>('pets')
  const [detail, setDetail] = useState<number | null>(null)
  const [form, setForm] = useState<{ open: boolean; pet?: any }>({ open: false })
  useEffect(() => { if (params?.add) setForm({ open: true }); if (params?.id) setDetail(params.id) }, [params])
  return (
    <div className="pb-6">
      <TopBar title="Meus pets" right={<Button size="sm" icon={Plus} onClick={() => setForm({ open: true })}>Novo</Button>} />
      <div className="space-y-3 px-4">
        {loading ? <Spinner /> : !data?.length ? <Card><Empty title="Nenhum pet ainda" text="Cadastre seu pet com foto, porte e cuidados especiais." action={<Button icon={Plus} onClick={() => setForm({ open: true })}>Cadastrar pet</Button>} /></Card> : data.map((p) => {
          const late = (p.vaccines_due || []).some((v: any) => dayDiff(v.next_dose, todayISO()) < 0)
          return (
            <button key={p.id} onClick={() => setDetail(p.id)} className="flex w-full items-center gap-4 rounded-3xl border border-paper-line/70 bg-white p-4 text-left shadow-soft">
              <PetPhoto src={p.photo} name={p.name} size={68} className="rounded-3xl" />
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-extrabold">{p.name}</span>
                <span className="block truncate text-xs text-ink-muted">{[p.breed || p.species, p.size, p.birth_date && ageText(p.birth_date)].filter(Boolean).join(' · ')}</span>
                <span className="mt-1.5 flex flex-wrap gap-1.5">
                  {p.next_appointment && <Badge tone="orange">{fmtDate(p.next_appointment.slice(0, 10)).slice(0, 5)} às {p.next_appointment.slice(11)}</Badge>}
                  {late && <Badge tone="red">Vacina atrasada</Badge>}
                </span>
              </span>
              <ChevronRight className="text-ink-muted" size={20} />
            </button>
          )
        })}
      </div>
      {detail && <PetDetail id={detail} onClose={() => setDetail(null)} onEdit={(p) => { setDetail(null); setForm({ open: true, pet: p }) }} />}
      {form.open && <PetForm pet={form.pet} onClose={() => setForm({ open: false })} onSaved={(id) => { setForm({ open: false }); reload(); setDetail(id) }} />}
    </div>
  )
}

/* ======================= agendar ======================= */
function BookTab() {
  const { loja, me, params, go, toast, reload } = useApp()
  const pets = useLoad<any[]>('pets')
  const [step, setStep] = useState(0)
  const [petId, setPetId] = useState<number | null>(params?.petId || null)
  const [serviceId, setServiceId] = useState<number | null>(params?.serviceId || null)
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [extra, setExtra] = useState({ pickup: false, delivery: false, notes: '' })
  const [days, setDays] = useState<any[] | null>(null)
  const [slots, setSlots] = useState<string[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<any>(null)
  const pet = pets.data?.find((p) => p.id === petId)
  const service = loja?.services?.find((s: any) => s.id === serviceId)

  useEffect(() => { if (pets.data?.length === 1 && !petId) setPetId(pets.data[0].id) }, [pets.data]) // eslint-disable-line
  useEffect(() => { if (step === 2 && petId && serviceId) { setDays(null); api('dias', { pet_id: petId, service_id: serviceId }).then((d) => { setDays(d); const first = d.find((x: any) => x.free > 0); if (first && !date) setDate(first.date) }).catch((e) => toast(e.message, 'error')) } }, [step, petId, serviceId]) // eslint-disable-line
  useEffect(() => { if (step === 2 && date) { setSlots(null); setTime(''); api('horarios', { date, pet_id: petId, service_id: serviceId }).then(setSlots).catch((e) => { setSlots([]); toast(e.message, 'error') }) } }, [date, step]) // eslint-disable-line

  if (!loja?.booking?.enabled) return <div><TopBar title="Agendar" /><Card className="mx-4"><Empty icon={Phone} title="Agendamento pelo app pausado" text={`Fale com o pet shop${loja?.phone ? ` pelo ${loja.phone}` : ''} para marcar um horário.`} /></Card></div>
  if (done) return (
    <div className="flex min-h-full flex-col items-center justify-center px-8 text-center">
      <span className="grid h-24 w-24 place-items-center rounded-full bg-leaf-50 text-leaf-600"><CheckCircle2 size={52} /></span>
      <h1 className="mt-5 text-2xl font-extrabold">Pedido enviado!</h1>
      <p className="mt-2 text-[15px] text-ink-soft"><b>{done.pet}</b> · {done.service}<br />{fullDate(done.date)} às {done.time}</p>
      <p className="mt-3 max-w-xs text-sm text-ink-muted">O pet shop vai confirmar o horário. Você recebe um aviso aqui no app.</p>
      <Button size="lg" className="mt-7 w-full max-w-xs" onClick={() => { setDone(null); setStep(0); setDate(''); setTime(''); go('agenda') }}>Ver meus agendamentos</Button>
    </div>
  )

  const submit = async () => {
    setBusy(true)
    try {
      await api('agendar', { pet_id: petId, service_id: serviceId, date, start_time: time, ...extra })
      setDone({ pet: pet.name, service: service.name, date, time }); reload()
    } catch (e: any) {
      toast(e.message, 'error')
      if (/ocupado/.test(e.message)) { setStep(2); setSlots(null); api('horarios', { date, pet_id: petId, service_id: serviceId }).then(setSlots).catch(() => setSlots([])) }
    } finally { setBusy(false) }
  }
  const steps = ['Pet', 'Serviço', 'Data e hora', 'Confirmar']
  const canNext = [!!petId, !!serviceId, !!date && !!time, true][step]
  const hasAddress = !!me.client.street

  return (
    <div className="flex min-h-full flex-col">
      <TopBar title="Agendar" onBack={step > 0 ? () => setStep(step - 1) : undefined} />
      <div className="flex gap-1.5 px-4 pb-4">{steps.map((s, i) => <div key={s} className="flex-1"><div className={cls('h-1.5 rounded-full', i <= step ? 'bg-brand-500' : 'bg-paper-line')} /><p className={cls('mt-1 text-[11px] font-bold', i === step ? 'text-brand-600' : 'text-ink-muted')}>{s}</p></div>)}</div>

      <div className="flex-1 px-4 pb-4">
        {step === 0 && (pets.loading ? <Spinner /> : !pets.data?.length ? <Card><Empty title="Cadastre seu pet primeiro" action={<Button icon={Plus} onClick={() => go('pets', { add: true })}>Cadastrar pet</Button>} /></Card> : (
          <div className="grid grid-cols-2 gap-3">
            {pets.data.map((p) => (
              <button key={p.id} onClick={() => setPetId(p.id)} className={cls('rounded-3xl border-2 bg-white p-4 text-center shadow-soft transition', petId === p.id ? 'border-brand-500' : 'border-transparent')}>
                <PetPhoto src={p.photo} name={p.name} size={80} className="mx-auto rounded-3xl" /><p className="mt-2 font-extrabold">{p.name}</p><p className="text-xs text-ink-muted">{p.size || p.species}</p>
              </button>
            ))}
            <button onClick={() => go('pets', { add: true })} className="grid place-items-center rounded-3xl border-2 border-dashed border-paper-line p-4 text-sm font-bold text-ink-muted"><span><Plus className="mx-auto mb-1" />Outro pet</span></button>
          </div>
        ))}

        {step === 1 && (
          <div className="space-y-2.5">
            {loja.services.map((s: any) => { const Icon = iconFor(s.name, s.category); return (
              <button key={s.id} onClick={() => setServiceId(s.id)} className={cls('flex w-full items-center gap-3 rounded-3xl border-2 bg-white p-4 text-left shadow-soft', serviceId === s.id ? 'border-brand-500' : 'border-transparent')}>
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-600"><Icon size={22} /></span>
                <span className="min-w-0 flex-1"><span className="block font-extrabold">{s.name}</span><span className="block text-xs text-ink-muted">{s.description || s.category}</span><span className="mt-0.5 flex items-center gap-1 text-xs text-ink-muted"><Clock size={12} />{s.duration_min} min</span></span>
                <span className="font-extrabold">{brl(s.price)}</span>
              </button>
            ) })}
          </div>
        )}

        {step === 2 && (
          <div>
            <p className="mb-2 text-sm font-extrabold">Escolha o dia</p>
            {!days ? <Spinner /> : (
              <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-2">
                {days.map((d) => { const dt = parseISO(d.date); const off = d.free === 0; return (
                  <button key={d.date} disabled={off} onClick={() => setDate(d.date)} className={cls('w-[62px] shrink-0 rounded-2xl border-2 py-2.5 text-center transition', date === d.date ? 'border-brand-500 bg-brand-500 text-white' : off ? 'border-transparent bg-paper-line/50 text-ink-muted/60' : 'border-transparent bg-white shadow-soft')}>
                    <span className="block text-[11px] font-bold uppercase">{WEEKDAYS_SHORT[dt.getDay()]}</span><span className="block text-xl font-extrabold">{dt.getDate()}</span><span className="block text-[10px] font-semibold">{off ? '—' : `${d.free} hor.`}</span>
                  </button>
                ) })}
              </div>
            )}
            {date && (
              <>
                <p className="mb-2 mt-5 text-sm font-extrabold">{fullDate(date)} · horários livres</p>
                {!slots ? <Spinner /> : slots.length === 0 ? <Card><Empty icon={Clock} title="Sem horários neste dia" text="Escolha outro dia." /></Card> : (
                  <div className="grid grid-cols-4 gap-2">
                    {slots.map((t) => <button key={t} onClick={() => setTime(t)} className={cls('rounded-2xl border-2 py-3 text-sm font-extrabold transition', time === t ? 'border-brand-500 bg-brand-500 text-white' : 'border-transparent bg-white shadow-soft')}>{t}</button>)}
                  </div>
                )}
              </>
            )}
            {days && days.every((d) => d.free === 0) && <Card className="mt-4"><Empty icon={Clock} title="Agenda cheia" text="Não há horários livres no período. Fale com o pet shop." /></Card>}
          </div>
        )}

        {step === 3 && pet && service && (
          <div className="space-y-4">
            <Card className="p-5">
              <div className="flex items-center gap-3"><PetPhoto src={pet.photo} name={pet.name} size={60} /><div><p className="text-lg font-extrabold">{pet.name}</p><p className="text-sm text-ink-muted">{service.name}</p></div></div>
              <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-paper p-3 text-sm">
                <p><span className="block text-xs text-ink-muted">Quando</span><b>{fullDate(date)}</b></p>
                <p><span className="block text-xs text-ink-muted">Horário</span><b>{time} às {endTime(time, service.duration_min)}</b></p>
                <p><span className="block text-xs text-ink-muted">Duração</span><b>{service.duration_min} min</b></p>
                <p><span className="block text-xs text-ink-muted">Valor</span><b>{brl(service.price)}</b></p>
              </div>
            </Card>
            <div className="space-y-2">
              <Switch checked={extra.pickup} onChange={(v) => setExtra({ ...extra, pickup: v })} label="Buscar em casa" hint={hasAddress ? 'O pet shop combina o horário com você.' : 'Cadastre seu endereço em Mais → Meu perfil.'} />
              <Switch checked={extra.delivery} onChange={(v) => setExtra({ ...extra, delivery: v })} label="Entregar em casa" />
            </div>
            <TextArea label="Recado para a equipe (opcional)" value={extra.notes} onChange={(v) => setExtra({ ...extra, notes: v })} placeholder="ex.: está com nós no pelo, prefere tosa curta" />
          </div>
        )}
      </div>

      <div className="sticky bottom-0 border-t border-paper-line bg-white/95 px-4 py-3 backdrop-blur">
        {step < 3 ? <Button size="lg" className="w-full" disabled={!canNext} onClick={() => setStep(step + 1)}>Continuar</Button>
          : <Button size="lg" icon={CalendarCheck} className="w-full" loading={busy} onClick={submit}>Confirmar agendamento</Button>}
      </div>
    </div>
  )
}

/* ======================= meus agendamentos ======================= */
const FLOW = ['Agendado', 'Confirmado', 'Aguardando chegada', 'Em atendimento', 'Aguardando retirada', 'Entregue']
function AgendaTab() {
  const { toast, reload } = useApp()
  const { data, loading } = useLoad<any[]>('agendamentos')
  const [seg, setSeg] = useState<'next' | 'past'>('next')
  const [cancel, setCancel] = useState<any>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const today = todayISO()
  const list = (data || []).filter((a) => (seg === 'next' ? a.date >= today && !['Cancelado', 'Entregue'].includes(a.status) : a.date < today || ['Cancelado', 'Entregue'].includes(a.status)))
  if (seg === 'past') list.reverse()
  const doCancel = async () => {
    setBusy(true)
    try { await api('agendamento:cancelar', { id: cancel.id, reason }); toast('Agendamento cancelado.'); setCancel(null); setReason(''); reload() } catch (e: any) { toast(e.message, 'error') } finally { setBusy(false) }
  }
  return (
    <div className="pb-6">
      <TopBar title="Agendamentos" />
      <div className="mx-4 mb-4 grid grid-cols-2 rounded-2xl bg-white p-1 shadow-sm">
        {(['next', 'past'] as const).map((s) => <button key={s} onClick={() => setSeg(s)} className={cls('rounded-xl py-2.5 text-sm font-extrabold', seg === s ? 'bg-brand-500 text-white' : 'text-ink-muted')}>{s === 'next' ? 'Próximos' : 'Histórico'}</button>)}
      </div>
      <div className="space-y-3 px-4">
        {loading ? <Spinner /> : list.length === 0 ? <Card><Empty icon={CalendarCheck} title={seg === 'next' ? 'Nada marcado' : 'Sem histórico ainda'} /></Card> : list.map((a) => {
          const idx = FLOW.indexOf(a.status === 'Finalizado' ? 'Aguardando retirada' : a.status)
          return (
            <Card key={a.id} className="p-4">
              <div className="flex items-center gap-3">
                <PetPhoto src={a.pet_photo} name={a.pet_name} size={52} />
                <div className="min-w-0 flex-1"><p className="font-extrabold">{a.pet_name} · {a.service_name}</p><p className="text-xs text-ink-muted">{fullDate(a.date)} · {a.start_time} às {endTime(a.start_time, a.duration_min)}</p></div>
                <Badge tone={statusTone(a.status)}>{a.status}</Badge>
              </div>
              {seg === 'next' && idx >= 0 && (
                <div className="mt-4 flex items-center">
                  {FLOW.slice(0, 5).map((s, i) => <React.Fragment key={s}><span className={cls('h-2.5 w-2.5 shrink-0 rounded-full', i <= idx ? 'bg-brand-500' : 'bg-paper-line')} title={s} />{i < 4 && <span className={cls('h-0.5 flex-1', i < idx ? 'bg-brand-500' : 'bg-paper-line')} />}</React.Fragment>)}
                </div>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                <span className="font-bold text-ink">{brl(a.price)}</span>
                {(a.pickup || a.delivery) ? <span className="flex items-center gap-1"><Truck size={13} />{[a.pickup && 'busca', a.delivery && 'entrega'].filter(Boolean).join(' + ')}</span> : null}
                {a.employee_name && <span>· com {a.employee_name.split(' ')[0]}</span>}
              </div>
              {a.status === 'Agendado' && <p className="mt-2 rounded-xl bg-yellow-50 px-3 py-2 text-xs font-semibold text-yellow-700">Aguardando confirmação do pet shop.</p>}
              {a.cancel_reason && <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{a.cancel_reason}</p>}
              {a.can_cancel && <Button size="sm" variant="ghost" icon={XCircle} className="mt-2 !px-0 text-red-600" onClick={() => setCancel(a)}>Cancelar agendamento</Button>}
            </Card>
          )
        })}
      </div>
      <Sheet open={!!cancel} onClose={() => setCancel(null)} title="Cancelar agendamento?" footer={<Button size="lg" variant="danger" className="w-full !bg-red-500 !text-white" loading={busy} onClick={doCancel}>Sim, cancelar</Button>}>
        {cancel && <div className="space-y-4"><p className="text-sm">{cancel.pet_name} · {cancel.service_name}<br /><b>{fullDate(cancel.date)} às {cancel.start_time}</b></p><TextArea label="Motivo (opcional)" value={reason} onChange={setReason} /></div>}
      </Sheet>
    </div>
  )
}

/* ======================= mais: avisos, adoção, perfil, loja ======================= */
function Avisos({ onClose }: { onClose: () => void }) {
  const { reload } = useApp()
  const { data } = useLoad<any[]>('avisos')
  useEffect(() => () => { api('avisos:lidos').then(reload).catch(() => {}) }, []) // eslint-disable-line
  return (
    <Sheet open onClose={onClose} title="Avisos">
      {!data ? <Spinner /> : data.length === 0 ? <Empty icon={Bell} title="Nenhum aviso" /> : (
        <div className="space-y-2">{data.map((n) => (
          <Card key={n.id} className={cls('flex gap-3 p-4', !n.read && 'border-brand-200 bg-brand-50/50')}>
            <span className={cls('mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full', n.read ? 'bg-gray-300' : 'bg-brand-500')} />
            <div><p className="text-sm font-extrabold">{n.title}</p>{n.body && <p className="text-sm text-ink-soft">{n.body}</p>}<p className="mt-0.5 text-xs text-ink-muted">{fmtDateTime(n.created_at)}</p></div>
          </Card>
        ))}</div>
      )}
    </Sheet>
  )
}

function Adocao({ onClose }: { onClose: () => void }) {
  const { toast, reload } = useApp()
  const { data } = useLoad<any[]>('adocao')
  const [sel, setSel] = useState<any>(null)
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const send = async () => {
    setBusy(true)
    try { await api('adocao:interesse', { animal_id: sel.id, notes }); toast('Recebemos seu interesse! O pet shop vai entrar em contato.'); setSel(null); setNotes(''); reload() } catch (e: any) { toast(e.message, 'error') } finally { setBusy(false) }
  }
  return (
    <Sheet open onClose={onClose} title="Adote um amigo">
      {!data ? <Spinner /> : data.length === 0 ? <Empty icon={HeartHandshake} title="Nenhum animal para adoção agora" /> : (
        <div className="space-y-3">{data.map((a) => (
          <Card key={a.id} className="overflow-hidden">
            {a.photo ? <img src={a.photo} alt={a.name} className="h-48 w-full object-cover" /> : <div className="grid h-32 place-items-center bg-brand-50 text-brand-400"><PawPrint size={44} /></div>}
            <div className="p-4">
              <div className="flex items-center justify-between gap-2"><p className="text-lg font-extrabold">{a.name}</p><Badge tone={a.status === 'Disponível para adoção' ? 'green' : 'orange'}>{a.status === 'Disponível para adoção' ? 'Disponível' : 'Em processo'}</Badge></div>
              <p className="text-xs text-ink-muted">{[a.sex, a.approx_age, a.size, a.breed].filter(Boolean).join(' · ')}</p>
              {a.description && <p className="mt-2 text-sm">{a.description}</p>}
              {a.rescue_story && <p className="mt-1 text-xs italic text-ink-muted">{a.rescue_story}</p>}
              <p className="mt-2 text-xs text-ink-soft">{[a.vaccines && `Vacinas: ${a.vaccines}`, a.neutered && `Castrado: ${a.neutered}`, a.temperament].filter(Boolean).join(' · ')}</p>
              {a.interested ? <p className="mt-3 flex items-center gap-1.5 text-sm font-bold text-leaf-600"><CheckCircle2 size={16} />Você já demonstrou interesse</p> : <Button size="sm" className="mt-3" icon={HeartHandshake} onClick={() => setSel(a)}>Quero conhecer</Button>}
            </div>
          </Card>
        ))}</div>
      )}
      {sel && <Sheet open onClose={() => setSel(null)} title={`Conhecer ${sel.name}`} footer={<Button size="lg" className="w-full" loading={busy} onClick={send}>Enviar interesse</Button>}><TextArea label="Conte um pouco sobre sua casa (opcional)" value={notes} onChange={setNotes} placeholder="ex.: tenho quintal, já tive cães" /></Sheet>}
    </Sheet>
  )
}

function Perfil({ onClose }: { onClose: () => void }) {
  const { me, setMe, toast } = useApp()
  const [f, setF] = useState<any>({ ...me.client })
  const [busy, setBusy] = useState(false)
  const [pw, setPw] = useState({ old: '', new: '', again: '' })
  const set = (k: string) => (v: any) => setF((s: any) => ({ ...s, [k]: v }))
  const cep = async (v: string) => {
    set('cep')(v)
    if (onlyDigits(v).length === 8) try { const a = await api('cep', { cep: v }); setF((s: any) => ({ ...s, street: a.street || s.street, neighborhood: a.neighborhood || s.neighborhood, city: a.city || s.city, state: a.state || s.state })) } catch {}
  }
  const save = async () => { setBusy(true); try { setMe(await api('perfil:salvar', f)); toast('Cadastro atualizado.'); onClose() } catch (e: any) { toast(e.message, 'error') } finally { setBusy(false) } }
  const changePw = async () => { try { await api('senha:alterar', { old: pw.old, new: pw.new }); toast('Senha alterada.'); setPw({ old: '', new: '', again: '' }) } catch (e: any) { toast(e.message, 'error') } }
  return (
    <Sheet open onClose={onClose} title="Meu perfil" footer={<Button size="lg" className="w-full" loading={busy} onClick={save}>Salvar</Button>}>
      <div className="space-y-4">
        <Input label="Nome completo" value={f.name} onChange={set('name')} />
        <div className="grid grid-cols-2 gap-3"><Input label="Celular" value={f.phone} onChange={set('phone')} mask={maskPhone} inputMode="tel" /><Input label="WhatsApp" value={f.whatsapp} onChange={set('whatsapp')} mask={maskPhone} inputMode="tel" /></div>
        <div className="grid grid-cols-2 gap-3"><Input label="CPF" value={f.cpf} onChange={set('cpf')} mask={maskCPF} inputMode="numeric" /><Input label="Nascimento" type="date" value={f.birth_date} onChange={set('birth_date')} /></div>
        <p className="pt-2 text-sm font-extrabold">Endereço <span className="font-semibold text-ink-muted">(para busca e entrega)</span></p>
        <Input label="CEP" value={f.cep} onChange={cep} mask={maskCEP} inputMode="numeric" hint="Preenchemos a rua automaticamente." />
        <Input label="Rua" value={f.street} onChange={set('street')} />
        <div className="grid grid-cols-2 gap-3"><Input label="Número" value={f.number} onChange={set('number')} /><Input label="Complemento" value={f.complement} onChange={set('complement')} /></div>
        <Input label="Bairro" value={f.neighborhood} onChange={set('neighborhood')} />
        <div className="grid grid-cols-[1fr_96px] gap-3"><Input label="Cidade" value={f.city} onChange={set('city')} /><label className="block"><span className="mb-1.5 block text-[13px] font-bold text-ink-soft">UF</span><select value={f.state || ''} onChange={(e) => set('state')(e.target.value)} className="w-full rounded-2xl border border-paper-line bg-paper px-3 py-3.5 text-[16px]"><option value="" />{UFS.map((u) => <option key={u}>{u}</option>)}</select></label></div>
        <Input label="Ponto de referência" value={f.reference} onChange={set('reference')} />
        <Choice label="Melhor horário para você" value={f.pref_time || 'Manhã'} onChange={set('pref_time')} options={['Manhã', 'Tarde', 'Qualquer']} />
        <Choice label="Prefere contato por" value={f.contact_pref || 'WhatsApp'} onChange={set('contact_pref')} options={['WhatsApp', 'Ligação', 'E-mail']} />
        <Switch checked={!!f.notify_ok} onChange={(v) => set('notify_ok')(v ? 1 : 0)} label="Receber lembretes e promoções" />
        <p className="pt-2 text-sm font-extrabold">Alterar senha</p>
        <Input label="Senha atual" type="password" value={pw.old} onChange={(v) => setPw({ ...pw, old: v })} />
        <Input label="Nova senha" type="password" value={pw.new} onChange={(v) => setPw({ ...pw, new: v })} />
        {pw.new && <PwRules pw={pw.new} />}
        <Input label="Repita a nova senha" type="password" value={pw.again} onChange={(v) => setPw({ ...pw, again: v })} />
        <Button variant="secondary" icon={KeyRound} className="w-full" disabled={!pw.old || !pwOk(pw.new) || pw.new !== pw.again} onClick={changePw}>Alterar senha</Button>
      </div>
    </Sheet>
  )
}

function MoreTab() {
  const { me, loja, params, logout } = useApp()
  const [open, setOpen] = useState<string>(params?.open || '')
  useEffect(() => { if (params?.open) setOpen(params.open) }, [params])
  const items = [
    { k: 'avisos', label: 'Avisos', icon: Bell }, { k: 'adocao', label: 'Adote um amigo', icon: HeartHandshake },
    { k: 'perfil', label: 'Meu perfil e endereço', icon: User },
  ]
  return (
    <div className="pb-6">
      <TopBar title="Mais" />
      <div className="space-y-4 px-4">
        <Card className="flex items-center gap-3 p-4">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-500 text-xl font-extrabold text-white">{me.client.name.split(' ').slice(0, 2).map((s: string) => s[0]).join('')}</span>
          <div className="min-w-0"><p className="truncate font-extrabold">{me.client.name}</p><p className="truncate text-xs text-ink-muted">{me.account.email}</p></div>
        </Card>
        <Card className="divide-y divide-paper-line">
          {items.map((i) => <button key={i.k} onClick={() => setOpen(i.k)} className="flex w-full items-center gap-3 px-4 py-4 text-left font-bold"><i.icon size={20} className="text-brand-500" /><span className="flex-1">{i.label}</span><ChevronRight size={18} className="text-ink-muted" /></button>)}
        </Card>
        <Card className="p-4">
          <p className="mb-2 font-extrabold">{loja?.name}</p>
          {loja?.address && <p className="mb-1 flex items-start gap-2 text-sm text-ink-soft"><MapPin size={16} className="mt-0.5 shrink-0" />{loja.address}</p>}
          <div className="mt-2 space-y-0.5 text-sm">{shopHoursText(loja?.hours).map((h) => <p key={h.day} className="flex justify-between"><span className="text-ink-muted">{h.day}</span><span className="font-semibold">{h.text}</span></p>)}</div>
          {loja?.phone && (
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button variant="secondary" icon={Phone} onClick={() => { location.href = `tel:${onlyDigits(loja.phone)}` }}>Ligar</Button>
              <Button variant="success" icon={MessageCircle} onClick={() => openLink(waLink(loja.phone))}>WhatsApp</Button>
            </div>
          )}
        </Card>
        <Button variant="ghost" icon={LogOut} className="w-full text-red-600" onClick={logout}>Sair da conta</Button>
        <p className="text-center text-[11px] text-ink-muted">Conectado a {getServer().replace(/^https?:\/\//, '')}</p>
      </div>
      {open === 'avisos' && <Avisos onClose={() => setOpen('')} />}
      {open === 'adocao' && <Adocao onClose={() => setOpen('')} />}
      {open === 'perfil' && <Perfil onClose={() => setOpen('')} />}
    </div>
  )
}

/* ======================= estrutura ======================= */
function Main({ loja, me, setMe, onLogout }: { loja: any; me: any; setMe: (m: any) => void; onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>('home')
  const [params, setParams] = useState<any>({})
  const [version, setVersion] = useState(0)
  const [toasts, setToasts] = useState<{ id: number; msg: string; kind: string }[]>([])
  const go = useCallback((t: Tab, p: any = {}) => { setTab(t); setParams({ ...p, _t: Date.now() }); document.getElementById('scroller')?.scrollTo(0, 0) }, [])
  const toast = useCallback((msg: string, kind: 'ok' | 'error' = 'ok') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, msg, kind }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 5000 : 3000)
  }, [])
  const reload = useCallback(() => setVersion((v) => v + 1), [])
  useEffect(() => { const t = setInterval(reload, 60000); return () => clearInterval(t) }, [reload]) // avisos e status atualizam sozinhos
  const logout = useCallback(async () => { await api('logout').catch(() => {}); clearToken(); onLogout() }, [onLogout])
  const value = useMemo(() => ({ loja, me, setMe, tab, go, params, toast, version, reload, logout }), [loja, me, setMe, tab, go, params, toast, version, reload, logout])
  const nav: { t: Tab; label: string; icon: any }[] = [{ t: 'home', label: 'Início', icon: Home }, { t: 'pets', label: 'Pets', icon: PawPrint }, { t: 'book', label: 'Agendar', icon: CalendarPlus }, { t: 'agenda', label: 'Agenda', icon: CalendarCheck }, { t: 'more', label: 'Mais', icon: User }]
  return (
    <AppCtx.Provider value={value}>
      <div className="mx-auto flex h-full max-w-lg flex-col bg-paper">
        <main id="scroller" className="flex-1 overflow-y-auto">
          <div key={tab + (params._t || '')} className="min-h-full animate-fade">
            {tab === 'home' && <HomeTab />}{tab === 'pets' && <PetsTab />}{tab === 'book' && <BookTab />}{tab === 'agenda' && <AgendaTab />}{tab === 'more' && <MoreTab />}
          </div>
        </main>
        <nav className="grid grid-cols-5 border-t border-paper-line bg-white px-2 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-1.5">
          {nav.map((n) => n.t === 'book' ? (
            <button key={n.t} onClick={() => go('book')} aria-label="Agendar" className="-mt-6 flex flex-col items-center gap-1 text-[11px] font-bold text-brand-600">
              <span className="grid h-14 w-14 place-items-center rounded-full bg-brand-500 text-white shadow-[0_10px_20px_-8px_rgba(255,122,26,.9)] ring-4 ring-white"><n.icon size={24} /></span>{n.label}
            </button>
          ) : (
            <button key={n.t} onClick={() => go(n.t)} className={cls('flex flex-col items-center gap-1 py-1.5 text-[11px] font-bold', tab === n.t ? 'text-brand-600' : 'text-ink-muted')}><n.icon size={22} />{n.label}</button>
          ))}
        </nav>
      </div>
      <div className="pointer-events-none fixed inset-x-4 top-[max(1rem,env(safe-area-inset-top))] z-[70] mx-auto flex max-w-md flex-col gap-2">
        {toasts.map((t) => <div key={t.id} className={cls('animate-up rounded-2xl px-4 py-3 text-sm font-bold text-white shadow-lift', t.kind === 'error' ? 'bg-red-500' : 'bg-leaf-600')}>{t.msg}</div>)}
      </div>
    </AppCtx.Provider>
  )
}

export default function App() {
  const [server, setSrv] = useState(getServer())
  const [loja, setLoja] = useState<any>(null)
  const [me, setMe] = useState<any>(undefined)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!server) return
    setErr('')
    api('loja').then(setLoja).catch((e) => setErr(e.message))
    if (hasToken()) api('me').then(setMe).catch(() => setMe(null)); else setMe(null)
  }, [server])
  useEffect(() => { const h = () => setMe(null); window.addEventListener('cli:expired', h); return () => window.removeEventListener('cli:expired', h) }, [])
  const onLogout = useCallback(() => setMe(null), [])

  if (!server) return <Connect onDone={() => setSrv(getServer())} />
  if (err && !loja) return (
    <div className="flex h-full flex-col items-center justify-center px-8 text-center">
      <Mascot size={110} className="opacity-80 grayscale" /><p className="mt-4 text-lg font-extrabold">Não conseguimos falar com o pet shop</p><p className="mt-1 text-sm text-ink-muted">{err}</p>
      <Button className="mt-5" onClick={() => { setErr(''); setSrv(''); setTimeout(() => setSrv(getServer())) }}>Tentar de novo</Button>
      <button className="mt-3 text-sm font-bold text-brand-600" onClick={() => { setServer(''); setSrv('') }}>Trocar endereço</button>
    </div>
  )
  if (me === undefined || !loja) return <div className="grid h-full place-items-center"><Mascot size={96} className="animate-pulse" /></div>
  if (!me) return <Auth loja={loja} onLogged={setMe} />
  return <Main loja={loja} me={me} setMe={setMe} onLogout={onLogout} />
}

void STATUSES
