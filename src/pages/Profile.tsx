import { useEffect, useState } from 'react'
import { LogOut, Save } from 'lucide-react'
import { Badge, Button, Card, Input, PageHeader, PhotoPicker, SectionLabel } from '../components/ui'
import { PasswordRules, passwordValid } from '../components/PasswordRules'
import { useAction, useApp } from '../lib/store'
import { ageText, fmtDate, maskPhone, validEmail } from '../lib/util'

export default function Profile() {
  const { user, setUser, toast } = useApp()
  const run = useAction()
  const [f, setF] = useState<any>({})
  const [pw, setPw] = useState({ old: '', next: '', again: '' })
  useEffect(() => { setF({ name: user.name, email: user.email || '', phone: user.phone || '', birth_date: user.birth_date || '', photo: user.photo || null }) }, [user])
  const set = (k: string) => (v: any) => setF((s: any) => ({ ...s, [k]: v }))

  const save = async () => {
    if (!f.name.trim()) return toast('Informe seu nome.', 'error')
    if (f.email && !validEmail(f.email)) return toast('E-mail inválido.', 'error')
    const u: any = await run(() => window.api.users.saveProfile(f), 'Perfil atualizado.')
    if (u) setUser(u)
  }
  const savePw = async () => {
    if (!passwordValid(pw.next)) return toast('A nova senha não atende às regras de segurança.', 'error')
    if (pw.next !== pw.again) return toast('As senhas novas não conferem.', 'error')
    if (await run(() => window.api.auth.changePassword(pw.old, pw.next), 'Senha alterada.')) setPw({ old: '', next: '', again: '' })
  }
  const logout = async () => { await window.api.auth.logout().catch(() => {}); setUser(null) }

  return (
    <>
      <PageHeader title="Meu Perfil" subtitle="Seus dados e senha de acesso.">
        <Button variant="secondary" icon={LogOut} onClick={logout}>Sair da conta</Button>
      </PageHeader>
      <div className="m-stack grid max-w-5xl grid-cols-[1fr_360px] gap-6">
        <Card className="p-7">
          <PhotoPicker round size={104} value={f.photo} onChange={set('photo')} label="Foto de perfil" />
          <div className="my-6 border-t border-paper-line" />
          <div className="m-stack grid grid-cols-2 gap-4">
            <Input className="col-span-2" label="Nome completo" required value={f.name} onChange={set('name')} />
            <Input label="Data de nascimento" type="date" value={f.birth_date} onChange={set('birth_date')} hint={f.birth_date ? `Idade: ${ageText(f.birth_date)}` : undefined} />
            <Input label="Telefone" value={f.phone} onChange={set('phone')} mask={maskPhone} />
            <Input className="col-span-2" label="E-mail" type="email" value={f.email} onChange={set('email')} />
            <Input label="Nome de usuário" value={user.username} onChange={() => {}} disabled hint="Só um administrador pode alterar." />
            <Input label="Cargo" value={user.role === 'admin' ? 'Administrador' : user.job_title || 'Funcionário'} onChange={() => {}} disabled />
          </div>
          <div className="mt-6 flex items-center justify-between">
            <p className="text-sm text-ink-muted">Cadastrado em {fmtDate(user.created_at?.slice(0, 10))} · <Badge tone={user.role === 'admin' ? 'purple' : 'orange'}>{user.role === 'admin' ? 'Administrador' : 'Funcionário'}</Badge></p>
            <Button icon={Save} onClick={save}>Salvar dados</Button>
          </div>
        </Card>
        <Card className="h-fit p-7">
          <SectionLabel>Alterar senha</SectionLabel>
          <div className="space-y-4">
            <Input label="Senha atual" type="password" value={pw.old} onChange={(v) => setPw((s) => ({ ...s, old: v }))} />
            <Input label="Nova senha" type="password" value={pw.next} onChange={(v) => setPw((s) => ({ ...s, next: v }))} />
            <PasswordRules password={pw.next} />
            <Input label="Repita a nova senha" type="password" value={pw.again} onChange={(v) => setPw((s) => ({ ...s, again: v }))} />
            <Button className="w-full" onClick={savePw} disabled={!pw.old || !pw.next}>Alterar senha</Button>
          </div>
        </Card>
      </div>
    </>
  )
}
