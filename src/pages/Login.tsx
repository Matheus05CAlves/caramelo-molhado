import { useState } from 'react'
import { CheckCircle2, Eye, EyeOff, Lock, Mail, Server, User as UserIcon, Wifi } from 'lucide-react'
import { Button } from '../components/ui'
import { Mascot, LogoMark } from '../components/Mascot'
import { PasswordRules, passwordValid } from '../components/PasswordRules'
import { validEmail } from '../lib/util'
import { getServer, isDesktop, pingServer, setServer } from '../lib/bridge'

const field = 'w-full rounded-xl border border-paper-line bg-paper py-3 pl-11 pr-4 text-sm focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-100'

function Labeled({ label, icon: Icon, children }: { label: string; icon: any; children: React.ReactNode }) {
  return (
    <label className="mb-4 block">
      <span className="mb-1.5 block text-[13px] font-semibold text-ink-soft">{label}</span>
      <span className="relative block"><Icon size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />{children}</span>
    </label>
  )
}

export default function Login({ onLogin }: { onLogin: (u: any) => void }) {
  const remote = !isDesktop()
  const [mode, setMode] = useState<'login' | 'register' | 'done' | 'server'>(remote && !getServer() ? 'server' : 'login')
  const [server, setServerField] = useState(getServer())
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [reg, setReg] = useState({ name: '', email: '', password: '', again: '' })
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setBusy(true)
    try { onLogin(await window.api.auth.login(username, password)) }
    catch (err: any) { setError(err.message || 'Não foi possível entrar.') }
    finally { setBusy(false) }
  }

  const mismatch = reg.again.length > 0 && reg.password !== reg.again
  const canRegister = reg.name.trim().length >= 3 && validEmail(reg.email) && passwordValid(reg.password) && reg.password === reg.again
  const register = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setBusy(true)
    try { await window.api.auth.register(reg.name, reg.email, reg.password); setMode('done') }
    catch (err: any) { setError(err.message || 'Não foi possível criar a conta.') }
    finally { setBusy(false) }
  }
  const go = (m: 'login' | 'register' | 'server') => { setMode(m); setError('') }
  const connect = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setBusy(true)
    try { const h = await pingServer(server); setServer(server); setServerField(getServer()); void h; go('login') }
    catch (err: any) { setError(err.message) }
    finally { setBusy(false) }
  }

  return (
    <div className="grid h-full bg-white lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden overflow-hidden bg-gradient-to-br from-brand-400 via-brand-500 to-brand-600 p-12 text-white lg:block">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10" />
        <div className="absolute -bottom-32 -left-20 h-[420px] w-[420px] rounded-full bg-white/10" />
        <div className="relative flex h-full flex-col justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/95"><Mascot size={42} /></span>
            <p className="text-lg font-extrabold leading-tight">Caramelo Molhado<br /><span className="text-sm font-semibold text-white/80">Pet Shop Inc.</span></p>
          </div>
          <div className="relative mx-auto my-6 w-full max-w-md">
            <div className="mx-auto grid h-72 w-72 place-items-center rounded-full bg-white/95 shadow-lift"><Mascot size={236} /></div>
            <div className="absolute -left-4 top-6 flex animate-pop items-center gap-3 rounded-2xl bg-white px-4 py-3 text-ink shadow-lift">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-leaf-50 text-leaf-600"><CheckCircle2 size={20} /></span>
              <span className="text-sm leading-tight"><b className="block">Banho concluído</b><span className="text-xs text-ink-muted">Thor está pronto para retirada</span></span>
            </div>
            <div className="absolute -right-2 bottom-6 flex animate-pop items-center gap-3 rounded-2xl bg-white px-4 py-3 text-ink shadow-lift [animation-delay:120ms]">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-50 text-lg">🐾</span>
              <span className="text-sm leading-tight"><b className="block">Próximo: Luna, 10h00</b><span className="text-xs text-ink-muted">Banho completo</span></span>
            </div>
          </div>
          <div>
            <h2 className="text-4xl font-extrabold leading-tight tracking-tight">Cuidado com carinho,<br />do banho à entrega.</h2>
            <p className="mt-3 max-w-md text-[15px] text-white/85">Agenda, fichas dos pets, clientes e rotas de coleta em um só lugar.</p>
          </div>
        </div>
      </section>

      <section className="grid place-items-center overflow-y-auto p-6 pt-[max(1.5rem,env(safe-area-inset-top))] sm:p-12">
        {mode === 'server' && (
          <form onSubmit={connect} className="w-full max-w-sm animate-pop">
            <div className="mb-6 flex items-center gap-3"><LogoMark size={52} /><div><h1 className="text-2xl font-extrabold tracking-tight">Conectar ao pet shop</h1><p className="text-sm text-ink-muted">App da equipe · primeiro acesso</p></div></div>
            <p className="mb-4 rounded-2xl bg-brand-50 p-4 text-[13px] leading-relaxed text-ink-soft">No computador da loja, abra <b>Configurações → App do cliente e celulares</b> e copie o endereço mostrado (ex.: <span className="font-mono">192.168.0.10:3737</span>). O celular precisa estar no mesmo Wi-Fi, ou use o endereço da internet/nuvem.</p>
            <Labeled label="Endereço do servidor" icon={Server}><input autoFocus inputMode="url" autoCapitalize="none" autoCorrect="off" value={server} onChange={(e) => setServerField(e.target.value)} className={field} placeholder="192.168.0.10:3737" /></Labeled>
            <p role="alert" className="mb-4 min-h-5 text-[13px] font-semibold text-red-500">{error}</p>
            <Button type="submit" size="lg" className="w-full" icon={Wifi} loading={busy} disabled={!server.trim()}>Conectar</Button>
            {getServer() && <p className="mt-5 text-center text-sm"><button type="button" onClick={() => { setServerField(getServer()); go('login') }} className="font-bold text-brand-600">Voltar</button></p>}
          </form>
        )}

        {mode === 'login' && (
          <form onSubmit={submit} className="w-full max-w-sm animate-pop">
            <div className="mb-8 flex items-center gap-3"><LogoMark size={52} /><div><h1 className="text-2xl font-extrabold tracking-tight">Bem-vindo de volta</h1><p className="text-sm text-ink-muted">Entre para abrir a agenda.</p></div></div>
            <Labeled label="Usuário ou e-mail" icon={UserIcon}><input autoFocus autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} className={field} placeholder="seu.usuario ou voce@email.com" /></Labeled>
            <Labeled label="Senha" icon={Lock}>
              <input type={show ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={field + ' pr-12'} placeholder="Sua senha" />
              <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Ocultar senha' : 'Mostrar senha'} className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-ink-muted hover:bg-paper">{show ? <EyeOff size={18} /> : <Eye size={18} />}</button>
            </Labeled>
            <p role="alert" className="mb-4 min-h-5 text-[13px] font-semibold text-red-500">{error}</p>
            <Button type="submit" size="lg" className="w-full" loading={busy}>Entrar</Button>
            <p className="mt-5 text-center text-sm text-ink-muted">Ainda não tem conta? <button type="button" onClick={() => go('register')} className="font-bold text-brand-600 hover:underline">Criar conta</button></p>
            {remote && <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-ink-muted"><Server size={13} className="shrink-0" /><span className="max-w-[200px] truncate font-mono">{getServer().replace(/^https?:\/\//, '')}</span>·<button type="button" onClick={() => go('server')} className="font-bold text-brand-600">trocar</button></p>}
          </form>
        )}

        {mode === 'register' && (
          <form onSubmit={register} className="w-full max-w-sm animate-pop">
            <div className="mb-6 flex items-center gap-3"><LogoMark size={52} /><div><h1 className="text-2xl font-extrabold tracking-tight">Criar conta</h1><p className="text-sm text-ink-muted">Preencha seus dados para pedir acesso.</p></div></div>
            <Labeled label="Nome completo" icon={UserIcon}><input autoFocus autoComplete="name" value={reg.name} onChange={(e) => setReg({ ...reg, name: e.target.value })} className={field} placeholder="Seu nome" /></Labeled>
            <Labeled label="E-mail" icon={Mail}><input type="email" autoComplete="email" value={reg.email} onChange={(e) => setReg({ ...reg, email: e.target.value })} className={field} placeholder="voce@email.com" /></Labeled>
            <Labeled label="Senha" icon={Lock}>
              <input type={show ? 'text' : 'password'} autoComplete="new-password" value={reg.password} onChange={(e) => setReg({ ...reg, password: e.target.value })} className={field + ' pr-12'} placeholder="Crie uma senha forte" />
              <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Ocultar senha' : 'Mostrar senha'} className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-ink-muted hover:bg-paper">{show ? <EyeOff size={18} /> : <Eye size={18} />}</button>
            </Labeled>
            <div className="-mt-1 mb-4"><PasswordRules password={reg.password} /></div>
            <Labeled label="Confirme a senha" icon={Lock}><input type={show ? 'text' : 'password'} autoComplete="new-password" value={reg.again} onChange={(e) => setReg({ ...reg, again: e.target.value })} className={field + (mismatch ? ' !border-red-300' : '')} placeholder="Repita a senha" /></Labeled>
            <p role="alert" className="mb-3 min-h-5 text-[13px] font-semibold text-red-500">{mismatch ? 'As senhas não conferem.' : error}</p>
            <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!canRegister}>Criar conta</Button>
            <p className="mt-5 text-center text-sm text-ink-muted">Já tem conta? <button type="button" onClick={() => go('login')} className="font-bold text-brand-600 hover:underline">Entrar</button></p>
          </form>
        )}

        {mode === 'done' && (
          <div className="w-full max-w-sm animate-pop text-center">
            <span className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-full bg-leaf-50 text-leaf-600"><CheckCircle2 size={42} /></span>
            <h1 className="text-2xl font-extrabold tracking-tight">Cadastro enviado!</h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">Seu acesso precisa ser aprovado por um administrador. Assim que for liberado, entre com o e-mail <b>{reg.email}</b> e a senha que você criou.</p>
            <Button size="lg" className="mt-6 w-full" onClick={() => { setUsername(reg.email); setReg({ name: '', email: '', password: '', again: '' }); go('login') }}>Voltar para o login</Button>
          </div>
        )}
      </section>
    </div>
  )
}
