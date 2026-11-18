import { Check, Circle } from 'lucide-react'
import { cls } from '../lib/util'

export const passwordChecks = (pw: string) => [
  { ok: pw.length >= 9, label: 'Mínimo de 9 caracteres' },
  { ok: /[a-z]/.test(pw), label: 'Uma letra minúscula' },
  { ok: /[A-Z]/.test(pw), label: 'Uma letra maiúscula' },
  { ok: /[^A-Za-z0-9]/.test(pw), label: 'Um caractere especial (! @ # $ %)' },
]
export const passwordValid = (pw: string) => passwordChecks(pw).every((c) => c.ok)

export function PasswordRules({ password }: { password: string }) {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-xl bg-paper px-4 py-3">
      {passwordChecks(password).map((c) => (
        <li key={c.label} className={cls('flex items-center gap-2 text-xs font-semibold transition', c.ok ? 'text-leaf-600' : 'text-ink-muted')}>
          {c.ok ? <Check size={14} /> : <Circle size={10} className="m-0.5" />}{c.label}
        </li>
      ))}
    </ul>
  )
}
