import { useCallback, useEffect, useState } from 'react'
import { KeyRound, Pencil, Plus, ShieldCheck, UserCog } from 'lucide-react'
import { Avatar, Badge, Button, Card, Empty, IconButton, Input, Modal, PageHeader, PhotoPicker, SectionLabel, Select, Toggle } from '../components/ui'
import { PasswordRules, passwordValid } from '../components/PasswordRules'
import { useAction, useApp } from '../lib/store'
import { DEFAULT_EMPLOYEE_PERMS, PERMISSIONS } from '../lib/domain'
import { fmtDate, maskPhone, validEmail } from '../lib/util'

const EMPTY = { name: '', username: '', password: '', email: '', phone: '', birth_date: '', job_title: '', role: 'employee', photo: null as string | null, active: 1, permissions: { ...DEFAULT_EMPLOYEE_PERMS } as Record<string, boolean> }

function StaffForm({ open, onClose, staff, onSaved }: { open: boolean; onClose: () => void; staff?: any; onSaved: () => void }) {
  const { toast } = useApp()
  const run = useAction()
  const [f, setF] = useState<any>(EMPTY)
  const set = (k: string) => (v: any) => setF((s: any) => ({ ...s, [k]: v }))
  useEffect(() => { if (open) setF(staff ? { ...EMPTY, ...staff, permissions: { ...staff.permissions } } : { ...EMPTY, permissions: { ...DEFAULT_EMPLOYEE_PERMS } }) }, [open, staff])
  const save = async () => {
    if (!f.name.trim() || !f.username.trim()) return toast('Informe nome e usuário.', 'error')
    if (!/^[a-zA-Z0-9._-]{3,}$/.test(f.username.trim())) return toast('O usuário deve ter 3 ou mais letras, números, ponto, hífen ou sublinhado.', 'error')
    if (f.email && !validEmail(f.email)) return toast('E-mail inválido.', 'error')
    if (!staff && !passwordValid(f.password)) return toast('A senha provisória não atende às regras de segurança.', 'error')
    const ok = await run(() => window.api.users.save({ ...f, username: f.username.trim() }), staff ? 'Funcionário atualizado.' : 'Funcionário cadastrado.')
    if (ok) { onSaved(); onClose() }
  }
  const isAdminRole = f.role === 'admin'
  return (
    <Modal open={open} onClose={onClose} size="lg" title={staff ? `Editar ${staff.name}` : 'Novo funcionário'} subtitle="Dados de acesso e permissões do sistema."
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button onClick={save}>Salvar funcionário</Button></>}>
      <div className="m-stack grid grid-cols-6 gap-4">
        <div className="col-span-6"><PhotoPicker round value={f.photo} onChange={set('photo')} label="Foto de perfil" /></div>
        <Input className="col-span-3" label="Nome completo" required value={f.name} onChange={set('name')} />
        <Input className="col-span-3" label="Cargo" value={f.job_title} onChange={set('job_title')} placeholder="Ex.: Tosadora, Banhista, Recepção" />
        <Input className="col-span-2" label="Nome de usuário" required value={f.username} onChange={set('username')} autoCapitalize="none" />
        {!staff && <Input className="col-span-2" label="Senha provisória" required type="text" value={f.password} onChange={set('password')} hint="A pessoa troca no primeiro acesso. Mín. 9, com maiúscula, minúscula e caractere especial." />}
        <Select className={staff ? 'col-span-2' : 'col-span-2'} label="Nível de acesso" value={f.role} onChange={set('role')} options={[{ value: 'employee', label: 'Funcionário' }, { value: 'admin', label: 'Administrador' }]} />
        <Input className="col-span-2" label="E-mail" type="email" value={f.email} onChange={set('email')} />
        <Input className="col-span-2" label="Telefone" value={f.phone} onChange={set('phone')} mask={maskPhone} />
        <Input className="col-span-2" label="Data de nascimento" type="date" value={f.birth_date} onChange={set('birth_date')} />
        {staff && <div className="col-span-6"><Toggle checked={!!f.active} onChange={(v) => set('active')(v ? 1 : 0)} label="Acesso ativo" hint="Desative para bloquear o login sem apagar o histórico." /></div>}
      </div>
      <div className="my-6 border-t border-paper-line" />
      <SectionLabel>Permissões</SectionLabel>
      {isAdminRole ? (
        <div className="flex items-center gap-3 rounded-2xl bg-leaf-50 p-4 text-sm font-semibold text-leaf-700"><ShieldCheck size={20} />Administradores têm acesso completo ao sistema.</div>
      ) : (
        <div className="m-stack grid grid-cols-2 gap-x-8 gap-y-1">
          {PERMISSIONS.map((p) => <Toggle key={p.key} checked={!!f.permissions[p.key]} onChange={(v) => setF((s: any) => ({ ...s, permissions: { ...s.permissions, [p.key]: v } }))} label={p.label} hint={p.hint} />)}
        </div>
      )}
    </Modal>
  )
}

function ResetPassword({ staff, onClose }: { staff: any; onClose: () => void }) {
  const run = useAction()
  const [pw, setPw] = useState('')
  return (
    <Modal open onClose={onClose} size="sm" title={`Nova senha para ${staff.name}`} subtitle="A pessoa será obrigada a trocar no próximo login."
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button disabled={!passwordValid(pw)} onClick={async () => { if (await run(() => window.api.users.setPassword(staff.id, pw), 'Senha redefinida.')) onClose() }}>Redefinir senha</Button></>}>
      <Input label="Senha provisória" value={pw} onChange={setPw} autoFocus />
      <div className="mt-3"><PasswordRules password={pw} /></div>
    </Modal>
  )
}

export default function Staff() {
  const { user } = useApp()
  const run = useAction()
  const [list, setList] = useState<any[]>([])
  const [form, setForm] = useState<{ open: boolean; staff?: any }>({ open: false })
  const [reset, setReset] = useState<any>(null)
  const reload = useCallback(() => { window.api.users.list().then(setList).catch(() => {}) }, [])
  useEffect(reload, [reload])

  return (
    <>
      <PageHeader title="Funcionários" subtitle="Quem acessa o sistema e o que cada pessoa pode fazer.">
        <Button icon={Plus} onClick={() => setForm({ open: true })}>Novo funcionário</Button>
      </PageHeader>
      <Card className="overflow-hidden">
        {list.length === 0 ? <Empty icon={UserCog} title="Nenhum funcionário" /> : (
          <table className="w-full text-sm">
            <thead className="bg-paper text-left text-xs font-semibold text-ink-muted"><tr><th className="px-5 py-3">Funcionário</th><th>Usuário</th><th>Cargo</th><th>Acesso</th><th>Permissões</th><th>Desde</th><th /></tr></thead>
            <tbody>
              {list.map((u) => (
                <tr key={u.id} className="border-t border-paper-line">
                  <td className="px-5 py-3"><span className="flex items-center gap-3"><Avatar src={u.photo} name={u.name} size={40} /><span><b className="block">{u.name}</b><span className="text-xs text-ink-muted">{u.email || 'sem e-mail'}</span></span></span></td>
                  <td className="text-ink-soft">{u.username}</td><td>{u.job_title || '—'}</td>
                  <td><Badge tone={u.role === 'admin' ? 'purple' : 'orange'}>{u.role === 'admin' ? 'Administrador' : 'Funcionário'}</Badge> {!u.active && <Badge tone="amber" dot>Aguardando aprovação</Badge>}</td>
                  <td className="text-xs text-ink-muted">{u.role === 'admin' ? 'Acesso completo' : `${PERMISSIONS.filter((p) => u.permissions?.[p.key]).length} de ${PERMISSIONS.length}`}</td>
                  <td className="text-ink-muted">{fmtDate(u.created_at?.slice(0, 10))}</td>
                  <td className="pr-3 text-right"><span className="inline-flex items-center">{!u.active && <Button size="sm" variant="success" className="mr-1" onClick={async () => { await run(() => window.api.users.save({ ...u, active: 1 }), 'Acesso aprovado.'); reload() }}>Aprovar</Button>}<IconButton icon={Pencil} label="Editar" onClick={() => setForm({ open: true, staff: u })} />{u.id !== user.id && <IconButton icon={KeyRound} label="Redefinir senha" onClick={() => setReset(u)} />}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      <StaffForm open={form.open} staff={form.staff} onClose={() => setForm({ open: false })} onSaved={reload} />
      {reset && <ResetPassword staff={reset} onClose={() => setReset(null)} />}
    </>
  )
}
