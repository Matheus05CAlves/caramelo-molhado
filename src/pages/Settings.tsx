import { useEffect, useState } from 'react'
import { DatabaseBackup, FileSpreadsheet, FileText, FolderOpen, History, RotateCcw, Save, Server, Smartphone, Sparkles, Trash2, Users, Wifi } from 'lucide-react'
import { Badge, Button, Card, Empty, Input, PageHeader, PhotoPicker, SearchInput, SectionLabel, Tabs, Textarea, Toggle } from '../components/ui'
import { HoursEditor, ExceptionsManager } from '../components/ScheduleModals'
import { ServicesManager } from '../components/ServicesManager'
import { saveSetting, db, useAction, useApp, useQuery } from '../lib/store'
import { EXPORT_LABELS, ExportKind, exportDataset } from '../lib/export'
import { addDays, fmtDateTime, maskPhone, todayISO } from '../lib/util'

type Tab = 'shop' | 'hours' | 'services' | 'app' | 'staff' | 'data' | 'audit'

function ShopTab() {
  const { settings } = useApp()
  const run = useAction()
  const [f, setF] = useState<any>({})
  useEffect(() => setF({ shop_name: settings.shop_name, shop_logo: settings.shop_logo || null, shop_phone: settings.shop_phone, shop_address: settings.shop_address, vaccine_alert_days: String(settings.vaccine_alert_days) }), [settings])
  const set = (k: string) => (v: any) => setF((s: any) => ({ ...s, [k]: v }))
  const save = () => run(async () => {
    await saveSetting('shop_name', f.shop_name.trim() || 'Caramelo Molhado Pet Shop Inc.')
    await saveSetting('shop_logo', f.shop_logo || '')
    await saveSetting('shop_phone', f.shop_phone)
    await saveSetting('shop_address', f.shop_address)
    await saveSetting('vaccine_alert_days', String(Math.max(1, Number(f.vaccine_alert_days) || 30)))
    await db.audit('Alterou configurações do estabelecimento', 'Configurações', '')
  }, 'Configurações salvas.')
  return (
    <Card className="max-w-3xl p-7">
      <PhotoPicker value={f.shop_logo} onChange={set('shop_logo')} label="Logo do estabelecimento (opcional)" size={88} />
      <p className="mt-2 text-xs text-ink-muted">Sem logo enviado, o mascote Caramelo continua aparecendo no menu e na tela de login.</p>
      <div className="my-6 border-t border-paper-line" />
      <div className="m-stack grid grid-cols-2 gap-4">
        <Input className="col-span-2" label="Nome do estabelecimento" value={f.shop_name} onChange={set('shop_name')} />
        <Input label="Telefone" value={f.shop_phone} onChange={set('shop_phone')} mask={maskPhone} />
        <Input label="Alertar vacinas com antecedência de (dias)" type="number" min={1} value={f.vaccine_alert_days} onChange={set('vaccine_alert_days')} />
        <Textarea className="col-span-2" label="Endereço do pet shop" value={f.shop_address} onChange={set('shop_address')} rows={2} hint="Usado como ponto de partida das rotas de coleta e entrega. Ex.: Rua das Flores, 100, Centro, São Paulo - SP" />
      </div>
      <div className="mt-6 flex justify-end"><Button icon={Save} onClick={save}>Salvar configurações</Button></div>
    </Card>
  )
}

function DataTab() {
  const { settings, confirm, toast } = useApp()
  const run = useAction()
  const [info, setInfo] = useState<any>(null)
  const [from, setFrom] = useState(addDays(todayISO(), -30))
  const [to, setTo] = useState(todayISO())
  const [busy, setBusy] = useState('')
  const refresh = () => window.api.app.info().then(setInfo).catch(() => {})
  useEffect(() => { refresh() }, [settings.demo_loaded])

  const doExport = async (kind: ExportKind, fmt: 'pdf' | 'xlsx') => {
    setBusy(kind + fmt)
    const path = await run(() => exportDataset(kind, fmt, from, to, settings.shop_name, settings.vaccine_alert_days))
    setBusy('')
    if (path) { toast('Arquivo salvo.'); window.api.app.showItem(path).catch(() => {}) }
  }
  const backup = async () => { const p = await run(() => window.api.app.backup()); if (p) { toast('Backup salvo.'); window.api.app.showItem(p).catch(() => {}); refresh() } }
  const restore = () => run(() => window.api.app.restore())
  const removeDemo = async () => {
    if (!(await confirm({ title: 'Remover dados demonstrativos?', message: 'Clientes, pets, agendamentos, animais e funcionários de exemplo serão apagados. O que você cadastrou não é afetado.', confirmLabel: 'Remover demonstração', danger: true }))) return
    await run(() => window.api.demo.remove(), 'Dados demonstrativos removidos.'); refresh()
  }
  const loadDemo = async () => { await run(() => window.api.demo.load(), 'Dados demonstrativos carregados.'); refresh() }

  return (
    <div className="m-stack grid max-w-5xl grid-cols-2 gap-6">
      <Card className="p-7">
        <SectionLabel>Backup e restauração</SectionLabel>
        <p className="mb-4 text-sm text-ink-soft">{info?.platform === 'mobile' ? 'Os dados ficam no servidor da loja. Pelo celular você pode baixar uma cópia ou restaurar um backup.' : 'Todos os dados ficam em um único arquivo neste computador. Uma cópia automática é feita uma vez por dia (guardamos as 10 mais recentes).'}</p>
        <div className="flex flex-wrap gap-2">
          <Button icon={DatabaseBackup} onClick={backup}>Fazer backup agora</Button>
          <Button variant="secondary" icon={RotateCcw} onClick={restore}>Restaurar backup</Button>
          {info?.platform !== 'mobile' && <Button variant="ghost" icon={FolderOpen} onClick={() => window.api.app.openBackupFolder()}>Abrir pasta dos backups</Button>}
        </div>
        {info && <dl className="mt-5 space-y-1 rounded-2xl bg-paper p-4 text-xs text-ink-soft"><div><b>Arquivo de dados:</b> <span className="selectable break-all">{info.dataFile}</span></div><div><b>Backups automáticos:</b> {info.autoBackups}</div><div><b>Versão:</b> {info.version}</div></dl>}
      </Card>

      <Card className="p-7">
        <SectionLabel>Dados demonstrativos</SectionLabel>
        <p className="mb-4 text-sm text-ink-soft">{settings.demo_loaded ? 'O sistema contém clientes, pets e agendamentos de exemplo para você conhecer os recursos. Remova quando for começar a usar de verdade.' : 'Os dados de exemplo foram removidos. Você pode carregá-los de novo para testar ou treinar a equipe.'}</p>
        {settings.demo_loaded ? <Button variant="danger" icon={Trash2} onClick={removeDemo}>Remover dados demonstrativos</Button> : <Button variant="secondary" icon={Sparkles} onClick={loadDemo}>Carregar dados demonstrativos</Button>}
        <p className="mt-3 text-xs text-ink-muted">Funcionários de exemplo: maria / maria123 e joao / joao123.</p>
      </Card>

      <Card className="col-span-2 p-5 sm:p-7">
        <SectionLabel>Exportar informações</SectionLabel>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <Input label="Período de" type="date" value={from} onChange={setFrom} className="w-44" />
          <Input label="até" type="date" value={to} onChange={setTo} className="w-44" />
          <p className="pb-3 text-xs text-ink-muted">O período vale para agendamentos e faturamento.</p>
        </div>
        <div className="divide-y divide-paper-line rounded-2xl border border-paper-line">
          {(Object.keys(EXPORT_LABELS) as ExportKind[]).map((k) => (
            <div key={k} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
              <div className="min-w-[180px] flex-1"><p className="text-sm font-bold">{EXPORT_LABELS[k].label} {EXPORT_LABELS[k].period && <Badge tone="gray">usa o período</Badge>}</p><p className="text-xs text-ink-muted">{EXPORT_LABELS[k].hint}</p></div>
              <Button size="sm" variant="secondary" icon={FileText} loading={busy === k + 'pdf'} onClick={() => doExport(k, 'pdf')}>PDF</Button>
              <Button size="sm" variant="secondary" icon={FileSpreadsheet} loading={busy === k + 'xlsx'} onClick={() => doExport(k, 'xlsx')}>Excel</Button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

function AppTab() {
  const { isAdmin } = useApp()
  const run = useAction()
  const { rows } = useQuery("SELECT key, value FROM settings WHERE key LIKE 'client_%' OR key LIKE 'server_%'")
  const [f, setF] = useState<any>({})
  const [info, setInfo] = useState<any>(null)
  const refresh = () => window.api.app.info().then(setInfo).catch(() => {})
  useEffect(() => { refresh() }, [])
  useEffect(() => {
    const m: any = {}
    rows.forEach((r: any) => (m[r.key] = r.value))
    setF({
      client_booking_enabled: m.client_booking_enabled !== '0', client_signup_open: m.client_signup_open !== '0',
      client_min_notice_hours: m.client_min_notice_hours ?? '2', client_max_days_ahead: m.client_max_days_ahead ?? '30', client_cancel_hours: m.client_cancel_hours ?? '2',
      client_welcome: m.client_welcome ?? '', server_enabled: m.server_enabled !== '0', server_port: m.server_port ?? '3737',
    })
  }, [rows])
  const set = (k: string) => (v: any) => setF((s: any) => ({ ...s, [k]: v }))
  const num = (v: any, min: number, max: number, def: number) => String(Math.min(max, Math.max(min, Number(v) || def)))
  const saveRules = () => run(async () => {
    await saveSetting('client_booking_enabled', f.client_booking_enabled ? '1' : '0')
    await saveSetting('client_signup_open', f.client_signup_open ? '1' : '0')
    await saveSetting('client_min_notice_hours', num(f.client_min_notice_hours, 0, 72, 2))
    await saveSetting('client_max_days_ahead', num(f.client_max_days_ahead, 1, 120, 30))
    await saveSetting('client_cancel_hours', num(f.client_cancel_hours, 0, 72, 2))
    await saveSetting('client_welcome', String(f.client_welcome || '').slice(0, 200))
    await db.audit('Alterou regras do app do cliente', 'Configurações', '')
  }, 'Regras do app salvas.')
  const applyServer = () => run(async () => {
    await saveSetting('server_enabled', f.server_enabled ? '1' : '0')
    await saveSetting('server_port', num(f.server_port, 1024, 65535, 3737))
    const st = await window.api.server.apply()
    await refresh()
    if (st?.error) throw new Error(st.error)
  }, 'Servidor atualizado.')
  const desktop = info?.platform === 'desktop'
  const srv = info?.server

  return (
    <div className="m-stack grid max-w-5xl grid-cols-2 items-start gap-6">
      <Card className="p-7">
        <SectionLabel>Agendamento pelo app do cliente</SectionLabel>
        <div className="space-y-1">
          <Toggle checked={!!f.client_booking_enabled} onChange={set('client_booking_enabled')} label="Clientes podem agendar pelo app" hint="Os pedidos entram como “Agendado” e aparecem em Pedidos pelo App para confirmar." />
          <Toggle checked={!!f.client_signup_open} onChange={set('client_signup_open')} label="Cadastro aberto para novos clientes" hint="Desligado: só entra quem recebeu um código de acesso da loja." />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <Input label="Antecedência mínima (h)" type="number" min={0} value={f.client_min_notice_hours} onChange={set('client_min_notice_hours')} />
          <Input label="Até quantos dias à frente" type="number" min={1} value={f.client_max_days_ahead} onChange={set('client_max_days_ahead')} />
          <Input label="Cancelar até (h antes)" type="number" min={0} value={f.client_cancel_hours} onChange={set('client_cancel_hours')} />
        </div>
        <Textarea className="mt-4" label="Mensagem de boas-vindas no app" value={f.client_welcome} onChange={set('client_welcome')} rows={2} />
        <p className="mt-3 text-xs text-ink-muted">Horários livres seguem o horário de funcionamento, bloqueios e o limite de atendimentos simultâneos. Serviços ocultos não aparecem para o cliente.</p>
        {isAdmin && <div className="mt-5 flex justify-end"><Button icon={Save} onClick={saveRules}>Salvar regras</Button></div>}
      </Card>

      <Card className="p-7">
        <SectionLabel>Conexão dos celulares</SectionLabel>
        {!info ? <p className="text-sm text-ink-muted">Carregando…</p> : desktop ? (
          <>
            <p className="mb-4 text-sm text-ink-soft">Este computador guarda o banco e atende os apps da equipe e dos clientes. Deixe-o ligado durante o expediente.</p>
            <div className="mb-4 rounded-2xl bg-paper p-4 text-sm">
              <p className="flex items-center gap-2 font-bold"><Server size={16} />Servidor {srv?.running ? <Badge tone="green" dot>Ligado</Badge> : <Badge tone="red" dot>Desligado</Badge>}</p>
              {srv?.error && <p className="mt-1 text-xs font-semibold text-red-600">{srv.error}</p>}
              {srv?.running && (srv.urls?.length ? (
                <div className="mt-2 space-y-1">
                  <p className="text-xs text-ink-muted">Endereço para digitar nos apps (mesma rede Wi-Fi):</p>
                  {srv.urls.map((u: string) => <p key={u} className="selectable flex items-center gap-2 font-mono text-[15px] font-bold text-brand-700"><Wifi size={14} />{u}</p>)}
                </div>
              ) : <p className="mt-1 text-xs text-ink-muted">Conecte o computador a uma rede para ver o endereço.</p>)}
            </div>
            <Toggle checked={!!f.server_enabled} onChange={set('server_enabled')} label="Permitir acesso pelos celulares" />
            <div className="mt-3 flex items-end gap-3">
              <Input label="Porta" type="number" value={f.server_port} onChange={set('server_port')} className="w-32" />
              {isAdmin && <Button icon={Smartphone} onClick={applyServer}>Aplicar</Button>}
            </div>
            <p className="mt-4 text-xs leading-relaxed text-ink-muted">Para clientes acessarem fora da loja (4G/5G), publique este endereço na internet — veja o guia <b>docs/ACESSO-PELA-INTERNET.md</b> — ou rode o servidor em nuvem.</p>
          </>
        ) : (
          <div className="text-sm text-ink-soft">
            <p>Este app está conectado ao servidor:</p>
            <p className="selectable mt-1 font-mono font-bold text-brand-700">{srv?.urls?.[0]}</p>
            <p className="mt-3 text-xs text-ink-muted">Para trocar, saia da conta e altere o endereço na tela de login.</p>
          </div>
        )}
      </Card>
    </div>
  )
}

function AuditTab() {
  const [q, setQ] = useState('')
  const { rows } = useQuery('SELECT * FROM audit_log ORDER BY id DESC LIMIT 400')
  const t = q.trim().toLowerCase()
  const list = rows.filter((r: any) => !t || [r.user_name, r.action, r.entity, r.detail].some((x) => (x || '').toLowerCase().includes(t)))
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-paper-line p-5">
        <div><h3 className="font-extrabold">Registro de alterações</h3><p className="text-sm text-ink-muted">Quem fez o quê e quando (últimos 400 registros).</p></div>
        <SearchInput className="w-full sm:w-72" value={q} onChange={setQ} placeholder="Buscar por pessoa ou ação" />
      </div>
      {list.length === 0 ? <Empty icon={History} title="Nenhum registro" /> : (
        <div className="max-h-[560px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-paper text-left text-xs font-semibold text-ink-muted"><tr><th className="px-5 py-3">Quando</th><th>Quem</th><th>Ação</th><th>Detalhe</th></tr></thead>
            <tbody>{list.map((r: any) => (
              <tr key={r.id} className="border-t border-paper-line"><td className="whitespace-nowrap px-5 py-2.5 text-ink-muted">{fmtDateTime(r.created_at)}</td><td className="font-semibold">{r.user_name}</td><td>{r.action}</td><td className="max-w-md truncate text-ink-soft">{r.detail}</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

export default function Settings() {
  const { go } = useApp()
  const [tab, setTab] = useState<Tab>('shop')
  return (
    <>
      <PageHeader title="Configurações" subtitle="Ajuste o sistema ao dia a dia do pet shop." />
      <Tabs value={tab} onChange={setTab} tabs={[
        { value: 'shop', label: 'Estabelecimento' }, { value: 'hours', label: 'Horários' }, { value: 'services', label: 'Serviços e preços' }, { value: 'app', label: 'App do cliente e celulares' },
        { value: 'staff', label: 'Funcionários e permissões' }, { value: 'data', label: 'Dados, backup e exportação' }, { value: 'audit', label: 'Registro de alterações' },
      ]} />
      <div className="pt-6">
        {tab === 'shop' && <ShopTab />}
        {tab === 'hours' && <div className="m-stack grid max-w-5xl grid-cols-2 items-start gap-6"><Card className="p-7"><SectionLabel>Horário de funcionamento</SectionLabel><HoursEditor /></Card><Card className="p-7"><SectionLabel>Bloqueios e horários extras</SectionLabel><ExceptionsManager /></Card></div>}
        {tab === 'services' && <ServicesManager />}
        {tab === 'app' && <AppTab />}
        {tab === 'staff' && <Card className="max-w-xl p-7"><Empty icon={Users} title="Gerencie a equipe na tela de Funcionários" text="Lá você cadastra pessoas, define cargo e escolhe o que cada funcionário pode fazer." action={<Button onClick={() => go('staff')}>Abrir Funcionários</Button>} /></Card>}
        {tab === 'data' && <DataTab />}
        {tab === 'audit' && <AuditTab />}
      </div>
    </>
  )
}
