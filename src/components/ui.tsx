import React, { useEffect, useRef, useState } from 'react'
import { Camera, Loader2, PawPrint, Search, X } from 'lucide-react'
import { cls, fileToDataUrl, initials } from '../lib/util'
import { TONES, Tone } from '../lib/domain'

/* ---------- botões ---------- */
type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'soft'
  size?: 'sm' | 'md' | 'lg'
  icon?: React.ComponentType<any>
  loading?: boolean
}
export function Button({ variant = 'primary', size = 'md', icon: Icon, loading, children, className, disabled, ...rest }: BtnProps) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition active:scale-[.98] disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 whitespace-nowrap'
  const sizes = { sm: 'px-3 py-1.5 text-[13px]', md: 'px-4 py-2.5 text-sm', lg: 'px-6 py-3 text-[15px]' }
  const variants = {
    primary: 'bg-brand-500 text-white hover:bg-brand-600 shadow-[0_6px_16px_-6px_rgba(255,122,26,.7)]',
    secondary: 'bg-white text-ink border border-paper-line hover:bg-paper',
    ghost: 'text-ink-soft hover:bg-paper',
    soft: 'bg-brand-50 text-brand-700 hover:bg-brand-100',
    danger: 'bg-red-50 text-red-600 hover:bg-red-100',
    success: 'bg-leaf-500 text-white hover:bg-leaf-600',
  }
  return (
    <button className={cls(base, sizes[size], variants[variant], className)} disabled={disabled || loading} {...rest}>
      {loading ? <Loader2 size={16} className="animate-spin" /> : Icon ? <Icon size={size === 'sm' ? 15 : 17} /> : null}
      {children}
    </button>
  )
}

export function IconButton({ icon: Icon, label, className, tone = 'ghost', ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { icon: React.ComponentType<any>; label: string; tone?: 'ghost' | 'danger' }) {
  return (
    <button
      title={label}
      aria-label={label}
      className={cls('grid h-9 w-9 place-items-center rounded-xl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300', tone === 'danger' ? 'text-red-500 hover:bg-red-50' : 'text-ink-soft hover:bg-paper', className)}
      {...rest}
    >
      <Icon size={18} />
    </button>
  )
}

/* ---------- layout ---------- */
export const Card = ({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cls('rounded-3xl bg-white shadow-soft border border-paper-line/70', className)} {...rest}>{children}</div>
)

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[26px] font-extrabold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-ink-muted">{subtitle}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  )
}

export function Empty({ icon: Icon = PawPrint, title, text, action }: { icon?: React.ComponentType<any>; title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-4 grid h-16 w-16 place-items-center rounded-full bg-brand-50 text-brand-500"><Icon size={28} /></div>
      <p className="text-base font-bold text-ink">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-ink-muted">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export const Spinner = () => <div className="grid place-items-center py-16 text-brand-500"><Loader2 className="animate-spin" /></div>

/* ---------- badges e avatares ---------- */
export function Badge({ tone = 'gray', children, dot, className }: { tone?: Tone; children: React.ReactNode; dot?: boolean; className?: string }) {
  const t = TONES[tone]
  return (
    <span className={cls('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold', t.bg, t.text, className)}>
      {dot && <span className={cls('h-1.5 w-1.5 rounded-full', t.solid)} />}
      {children}
    </span>
  )
}

const AVATAR_TONES = ['#FFE7D0', '#CFF0E0', '#DCEBFF', '#EADFFB', '#FFE3E3', '#FCEFC2']
const hash = (s = '') => [...s].reduce((a, c) => a + c.charCodeAt(0), 0)

export function Avatar({ src, name, size = 40, className }: { src?: string | null; name?: string; size?: number; className?: string }) {
  const style = { width: size, height: size, fontSize: size * 0.38 }
  if (src) return <img src={src} alt={name} style={style} className={cls('shrink-0 rounded-full object-cover', className)} />
  return (
    <span style={{ ...style, background: AVATAR_TONES[hash(name) % AVATAR_TONES.length] }} className={cls('grid shrink-0 place-items-center rounded-full font-bold text-ink-soft', className)}>
      {initials(name)}
    </span>
  )
}

export function PetAvatar({ src, name, size = 48, rounded = 'rounded-2xl', className, fill }: { src?: string | null; name?: string; size?: number; rounded?: string; className?: string; fill?: boolean }) {
  const style = fill ? { width: '100%', height: size } : { width: size, height: size }
  if (src) return <img src={src} alt={name} style={style} className={cls('shrink-0 object-cover', rounded, className)} />
  return (
    <span style={{ ...style, background: AVATAR_TONES[hash(name) % AVATAR_TONES.length] }} className={cls('grid shrink-0 place-items-center text-brand-600', rounded, className)}>
      <PawPrint size={Math.min(size, fill ? 176 : size) * 0.46} />
    </span>
  )
}

/* ---------- formulários ---------- */
const inputBase = 'w-full rounded-xl border bg-paper px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted/70 transition focus:outline-none focus:bg-white focus:ring-2 disabled:opacity-60'
const inputOk = 'border-paper-line focus:border-brand-400 focus:ring-brand-100'
const inputErr = 'border-red-300 focus:border-red-400 focus:ring-red-100'

export function Field({ label, error, hint, required, children, className }: { label?: string; error?: string; hint?: string; required?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <label className={cls('block', className)}>
      {label && <span className="mb-1.5 block text-[13px] font-semibold text-ink-soft">{label}{required && <span className="text-brand-500"> *</span>}</span>}
      {children}
      {error ? <span className="mt-1 block text-xs font-medium text-red-500">{error}</span> : hint ? <span className="mt-1 block text-xs text-ink-muted">{hint}</span> : null}
    </label>
  )
}

type InputProps = { label?: string; value: any; onChange: (v: string) => void; error?: string; hint?: string; required?: boolean; mask?: (v: string) => string; className?: string; inputClassName?: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'>
export function Input({ label, value, onChange, error, hint, required, mask, className, inputClassName, ...rest }: InputProps) {
  return (
    <Field label={label} error={error} hint={hint} required={required} className={className}>
      <input className={cls(inputBase, error ? inputErr : inputOk, inputClassName)} value={value ?? ''} onChange={(e) => onChange(mask ? mask(e.target.value) : e.target.value)} {...rest} />
    </Field>
  )
}

export function Textarea({ label, value, onChange, error, hint, className, rows = 3, ...rest }: { label?: string; value: any; onChange: (v: string) => void; error?: string; hint?: string; className?: string } & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'value'>) {
  return (
    <Field label={label} error={error} hint={hint} className={className}>
      <textarea rows={rows} className={cls(inputBase, 'resize-none', error ? inputErr : inputOk)} value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...rest} />
    </Field>
  )
}

export type Opt = { value: any; label: string; disabled?: boolean }
export function Select({ label, value, onChange, options, placeholder, error, hint, required, className, ...rest }: { label?: string; value: any; onChange: (v: string) => void; options: (Opt | string)[]; placeholder?: string; error?: string; hint?: string; required?: boolean; className?: string } & Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'value'>) {
  return (
    <Field label={label} error={error} hint={hint} required={required} className={className}>
      <select className={cls(inputBase, 'appearance-none bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-9', error ? inputErr : inputOk)} style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' stroke='%237A8391' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m4 6 4 4 4-4'/%3E%3C/svg%3E")` }} value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...rest}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => {
          const op = typeof o === 'string' ? { value: o, label: o } : o
          return <option key={String(op.value)} value={op.value} disabled={op.disabled}>{op.label}</option>
        })}
      </select>
    </Field>
  )
}

export function Toggle({ checked, onChange, label, hint, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string; disabled?: boolean }) {
  return (
    <label className={cls('flex cursor-pointer items-center justify-between gap-4 rounded-xl py-1.5', disabled && 'pointer-events-none opacity-50')}>
      <span>
        <span className="block text-sm font-semibold text-ink">{label}</span>
        {hint && <span className="block text-xs text-ink-muted">{hint}</span>}
      </span>
      <span className={cls('relative h-6 w-11 shrink-0 rounded-full transition', checked ? 'bg-leaf-500' : 'bg-gray-300')}>
        <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className={cls('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', checked ? 'left-[22px]' : 'left-0.5')} />
        <span className="absolute inset-0 rounded-full peer-focus-visible:ring-2 peer-focus-visible:ring-brand-300" />
      </span>
    </label>
  )
}

export function SearchInput({ value, onChange, placeholder = 'Buscar...', className }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <div className={cls('relative', className)}>
      <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={cls(inputBase, inputOk, 'pl-10')} />
    </div>
  )
}

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: any) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="inline-flex rounded-xl bg-paper p-1">
      {options.map((o) => (
        <button key={o.value} onClick={() => onChange(o.value)} className={cls('rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition', value === o.value ? 'bg-white text-brand-600 shadow-sm' : 'text-ink-muted hover:text-ink')}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Tabs<T extends string>({ value, onChange, tabs }: { value: T; onChange: (v: any) => void; tabs: { value: T; label: string; count?: number }[] }) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-paper-line [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {tabs.map((t) => (
        <button key={t.value} onClick={() => onChange(t.value)} className={cls('relative whitespace-nowrap px-4 py-3 text-sm font-semibold transition', value === t.value ? 'text-brand-600' : 'text-ink-muted hover:text-ink')}>
          {t.label}
          {t.count !== undefined && <span className="ml-1.5 rounded-full bg-paper px-1.5 py-0.5 text-[11px] text-ink-soft">{t.count}</span>}
          {value === t.value && <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-brand-500" />}
        </button>
      ))}
    </div>
  )
}

export function PhotoPicker({ value, onChange, label = 'Foto', round, size = 96 }: { value?: string | null; onChange: (v: string | null) => void; label?: string; round?: boolean; size?: number }) {
  const ref = useRef<HTMLInputElement>(null)
  const [err, setErr] = useState('')
  const pick = async (f?: File) => {
    if (!f) return
    try { setErr(''); onChange(await fileToDataUrl(f)) } catch (e: any) { setErr(e.message) }
  }
  return (
    <div className="flex items-center gap-4">
      <button type="button" onClick={() => ref.current?.click()} style={{ width: size, height: size }} className={cls('group relative grid shrink-0 place-items-center overflow-hidden border-2 border-dashed border-paper-line bg-paper text-ink-muted transition hover:border-brand-300', round ? 'rounded-full' : 'rounded-2xl')}>
        {value ? <img src={value} alt="" className="h-full w-full object-cover" /> : <Camera size={24} />}
        {value && <span className="absolute inset-0 grid place-items-center bg-black/40 text-white opacity-0 transition group-hover:opacity-100"><Camera size={20} /></span>}
      </button>
      <div>
        <p className="text-[13px] font-semibold text-ink-soft">{label}</p>
        <div className="mt-1 flex gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={() => ref.current?.click()}>{value ? 'Trocar' : 'Escolher imagem'}</Button>
          {value && <Button type="button" size="sm" variant="ghost" onClick={() => onChange(null)}>Remover</Button>}
        </div>
        {err && <p className="mt-1 text-xs text-red-500">{err}</p>}
      </div>
      <input ref={ref} type="file" accept="image/*" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = '' }} />
    </div>
  )
}

/* ---------- modal ---------- */
export function Modal({ open, onClose, title, subtitle, size = 'md', children, footer }: { open: boolean; onClose: () => void; title: string; subtitle?: string; size?: 'sm' | 'md' | 'lg' | 'xl'; children: React.ReactNode; footer?: React.ReactNode }) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
  if (!open) return null
  const widths = { sm: 'max-w-md', md: 'max-w-2xl', lg: 'max-w-4xl', xl: 'max-w-6xl' }
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 pt-10 sm:items-center sm:p-6">
      <div className="absolute inset-0 animate-fade bg-ink/40 backdrop-blur-[2px]" onMouseDown={onClose} />
      <div role="dialog" aria-modal="true" aria-label={title} className={cls('relative flex max-h-full w-full animate-pop flex-col overflow-hidden rounded-t-3xl bg-white shadow-lift sm:rounded-3xl', widths[size])}>
        <div className="flex items-start justify-between gap-4 border-b border-paper-line px-5 py-4 sm:px-7 sm:py-5">
          <div>
            <h2 className="text-lg font-extrabold text-ink">{title}</h2>
            {subtitle && <p className="text-sm text-ink-muted">{subtitle}</p>}
          </div>
          <IconButton icon={X} label="Fechar" onClick={onClose} />
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-paper-line bg-paper/60 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:px-7 sm:pb-4">{footer}</div>}
      </div>
    </div>
  )
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirmar', danger, onResult }: { open: boolean; title: string; message: string; confirmLabel?: string; danger?: boolean; onResult: (ok: boolean) => void }) {
  return (
    <Modal open={open} onClose={() => onResult(false)} title={title} size="sm" footer={<>
      <Button variant="secondary" onClick={() => onResult(false)}>Voltar</Button>
      <Button variant={danger ? 'danger' : 'primary'} className={danger ? '!bg-red-500 !text-white hover:!bg-red-600' : ''} onClick={() => onResult(true)}>{confirmLabel}</Button>
    </>}>
      <p className="text-sm leading-relaxed text-ink-soft">{message}</p>
    </Modal>
  )
}

export const InfoRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-0.5 py-2">
    <span className="text-xs font-semibold text-ink-muted">{label}</span>
    <span className="text-sm font-medium text-ink">{children || '—'}</span>
  </div>
)

export const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <h3 className="mb-3 mt-1 text-sm font-extrabold text-ink">{children}</h3>
)
