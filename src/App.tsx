import { useEffect, useState } from 'react'
import { AppProvider, User, useApp, useAction } from './lib/store'
import { syncAlerts } from './lib/notify'
import { Sidebar, Topbar } from './components/Shell'
import { Button, Input, Modal } from './components/ui'
import { Mascot } from './components/Mascot'
import { PasswordRules, passwordValid } from './components/PasswordRules'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Pets from './pages/Pets'
import Clients from './pages/Clients'
import Appointments from './pages/Appointments'
import Adoption from './pages/Adoption'
import Requests from './pages/Requests'
import MapPage from './pages/MapPage'
import Staff from './pages/Staff'
import Profile from './pages/Profile'
import Settings from './pages/Settings'

function ForcePasswordChange() {
  const { user, setUser, toast } = useApp()
  const run = useAction()
  const [oldPw, setOld] = useState('')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const err = pw2 && pw !== pw2 ? 'As senhas não conferem.' : ''
  const save = async () => {
    const ok = await run(() => window.api.auth.changePassword(oldPw, pw))
    if (ok) { toast('Senha criada. Tudo pronto!'); setUser({ ...user, must_change_password: 0 }) }
  }
  return (
    <Modal open onClose={() => {}} title="Crie sua senha pessoal" subtitle="Por segurança, troque a senha provisória antes de continuar." size="sm"
      footer={<Button onClick={save} disabled={!oldPw || !passwordValid(pw) || pw !== pw2}>Salvar senha</Button>}>
      <div className="mb-5 flex justify-center"><Mascot size={72} /></div>
      <div className="space-y-4">
        <Input label="Senha provisória atual" type="password" value={oldPw} onChange={setOld} />
        <Input label="Nova senha" type="password" value={pw} onChange={setPw} />
        <PasswordRules password={pw} />
        <Input label="Repita a nova senha" type="password" value={pw2} onChange={setPw2} error={err} />
      </div>
    </Modal>
  )
}

function Shell() {
  const { page, user, settings } = useApp()
  const [menu, setMenu] = useState(false)
  useEffect(() => setMenu(false), [page])
  useEffect(() => {
    syncAlerts(settings.vaccine_alert_days)
    const t = setInterval(() => syncAlerts(settings.vaccine_alert_days), 120000)
    return () => clearInterval(t)
  }, [settings.vaccine_alert_days])

  const pages: Record<string, JSX.Element> = {
    dashboard: <Dashboard />, pets: <Pets />, clients: <Clients />, appointments: <Appointments />, requests: <Requests />, adoption: <Adoption />,
    map: <MapPage />, staff: <Staff />, profile: <Profile />, settings: <Settings />,
  }
  return (
    <div className="flex h-full">
      <Sidebar open={menu} onClose={() => setMenu(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenu={() => setMenu(true)} />
        <main key={page} className="selectable flex-1 animate-fade overflow-y-auto px-4 pb-10 pt-3 lg:px-8 lg:pt-4">{pages[page]}</main>
      </div>
      {!!user.must_change_password && <ForcePasswordChange />}
    </div>
  )
}

export default function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined)
  useEffect(() => {
    window.api.auth.session().then(setUser).catch(() => setUser(null))
    // App de celular: se o token expirar (ou o servidor for restaurado), volta para o login.
    const expired = () => setUser(null)
    window.addEventListener('cm:expired', expired)
    return () => window.removeEventListener('cm:expired', expired)
  }, [])
  if (user === undefined) return <div className="grid h-full place-items-center"><Mascot size={96} className="animate-pulse" /></div>
  if (!user) return <Login onLogin={setUser} />
  return <AppProvider user={user} setUser={setUser}><Shell /></AppProvider>
}
