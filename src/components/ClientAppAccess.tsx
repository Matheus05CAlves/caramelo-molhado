import { useCallback, useEffect, useState } from 'react'
import { Copy, KeyRound, MessageCircle, ShieldCheck, ShieldOff, Smartphone } from 'lucide-react'
import { Badge, Button, Card, SectionLabel } from './ui'
import { useAction, useApp } from '../lib/store'
import { fmtDate, fmtDateTime, waLink } from '../lib/util'

/** Cartão na ficha do cliente: conta no app, código de acesso e bloqueio. */
export function ClientAppAccess({ client }: { client: any }) {
  const { can, confirm, toast, settings } = useApp()
  const run = useAction()
  const [info, setInfo] = useState<any>(null)
  const load = useCallback(() => { window.api.clients.appAccess(client.id).then(setInfo).catch(() => setInfo(null)) }, [client.id])
  useEffect(() => { load() }, [load])
  const edit = can('clients_edit')

  const invite = async () => { if (await run(() => window.api.clients.newInvite(client.id), 'Código gerado.')) load() }
  const toggle = async (active: boolean) => {
    if (!active && !(await confirm({ title: 'Bloquear acesso ao app?', message: `${client.name} não conseguirá mais entrar no app do cliente até ser desbloqueado.`, confirmLabel: 'Bloquear', danger: true }))) return
    if (await run(() => window.api.clients.setAppActive(client.id, active), active ? 'Acesso liberado.' : 'Acesso bloqueado.')) load()
  }
  const message = info?.invite
    ? `Olá, ${client.name.split(' ')[0]}! Agora você pode agendar e acompanhar os atendimentos do seu pet pelo app do ${settings.shop_name}. Baixe o app, toque em "Criar conta" → "Tenho um código" e use o código ${info.invite.code} (válido até ${fmtDate(info.invite.expires)}).`
    : ''
  const copy = () => navigator.clipboard?.writeText(info.invite.code).then(() => toast('Código copiado.')).catch(() => {})

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between gap-2"><SectionLabel>App do cliente</SectionLabel><Smartphone size={18} className="text-ink-muted" /></div>
      {!info ? <p className="text-sm text-ink-muted">Carregando…</p> : info.account ? (
        <div className="space-y-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={info.account.active ? 'green' : 'red'} dot>{info.account.active ? 'Usa o app' : 'Acesso bloqueado'}</Badge>
            <span className="text-ink-soft">{info.account.email}</span>
          </div>
          <p className="text-xs text-ink-muted">Conta criada em {fmtDate(info.account.created_at?.slice(0, 10))} · último acesso {fmtDateTime(info.account.last_login)}</p>
          {edit && (info.account.active
            ? <Button size="sm" variant="danger" icon={ShieldOff} onClick={() => toggle(false)}>Bloquear acesso</Button>
            : <Button size="sm" variant="success" icon={ShieldCheck} onClick={() => toggle(true)}>Liberar acesso</Button>)}
        </div>
      ) : (
        <div className="space-y-3 text-sm">
          <p className="text-ink-soft">Ainda não usa o app. Gere um código para {client.name.split(' ')[0]} entrar já com os pets e o histórico que estão aqui.</p>
          {info.invite && (
            <div className="rounded-2xl bg-brand-50 p-4 text-center">
              <p className="text-xs font-semibold text-brand-700">Código de acesso</p>
              <p className="selectable my-1 font-mono text-2xl font-extrabold tracking-[.25em] text-ink">{info.invite.code}</p>
              <p className="text-xs text-ink-muted">Válido até {fmtDate(info.invite.expires)}</p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <Button size="sm" variant="secondary" icon={Copy} onClick={copy}>Copiar</Button>
                {client.whatsapp && <Button size="sm" variant="secondary" icon={MessageCircle} onClick={() => window.api.app.openExternal(`${waLink(client.whatsapp)}?text=${encodeURIComponent(message)}`)}>Enviar no WhatsApp</Button>}
              </div>
            </div>
          )}
          {edit && <Button size="sm" variant="soft" icon={KeyRound} onClick={invite}>{info.invite ? 'Gerar novo código' : 'Gerar código de acesso'}</Button>}
        </div>
      )}
    </Card>
  )
}
