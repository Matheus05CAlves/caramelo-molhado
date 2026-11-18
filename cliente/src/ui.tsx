import React, { useEffect } from 'react'
import { ChevronLeft, Loader2, PawPrint, X } from 'lucide-react'
import { cls } from '../../src/lib/util'
import { TONES, Tone } from '../../src/lib/domain'

export function Button({ variant = 'primary', size = 'md', icon: Icon, loading, className, children, disabled, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'; size?: 'sm' | 'md' | 'lg'; icon?: any; loading?: boolean }) {
  const v = {
    primary: 'bg-brand-500 text-white shadow-[0_8px_18px_-8px_rgba(255,122,26,.8)] active:bg-brand-600',
    secondary: 'bg-white text-ink border border-paper-line active:bg-paper',
    ghost: 'text-ink-soft active:bg-paper',
    danger: 'bg-red-50 text-red-600 active:bg-red-100',
    success: 'bg-leaf-500 text-white active:bg-leaf-600',
  }[variant]
  const s = { sm: 'px-3.5 py-2 text-[13px] rounded-xl', md: 'px-4 py-3 text-sm rounded-2xl', lg: 'px-5 py-4 text-[15px] rounded-2xl' }[size]
  return (
    <button className={cls('inline-flex items-center justify-center gap-2 font-bold transition active:scale-[.98] disabled:pointer-events-none disabled:opacity-50', v, s, className)} disabled={disabled || loading} {...rest}>
      {loading ? <Loader2 size={18} className="animate-spin" /> : Icon ? <Icon size={size === 'sm' ? 16 : 18} /> : null}
      {children}
    </button>
  )
}

export const Card = ({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cls('rounded-3xl border border-paper-line/70 bg-white shadow-soft', className)} {...rest}>{children}</div>
)

export function Badge({ tone = 'gray', children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  const t = TONES[tone]
  return <span className={cls('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold', t.bg, t.text, className)}><span className={cls('h-1.5 w-1.5 rounded-full', t.solid)} />{children}</span>
}

export function PetPhoto({ src, name, size = 56, className }: { src?: string | null; name?: string; size?: number; className?: string }) {
  return src
    ? <img src={src} alt={name} style={{ width: size, height: size }} className={cls('shrink-0 rounded-2xl object-cover', className)} />
    : <span style={{ width: size, height: size }} className={cls('grid shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-500', className)}><PawPrint size={size * 0.45} /></span>
}

const fieldCls = 'w-full rounded-2xl border border-paper-line bg-paper px-4 py-3.5 text-[16px] text-ink placeholder:text-ink-muted/70 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-100'

export function Field({ label, hint, error, className, children }: { label?: string; hint?: string; error?: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={cls('block', className)}>
      {label && <span className="mb-1.5 block text-[13px] font-bold text-ink-soft">{label}</span>}
      {children}
      {error ? <span className="mt-1 block text-xs font-semibold text-red-500">{error}</span> : hint ? <span className="mt-1 block text-xs text-ink-muted">{hint}</span> : null}
    </label>
  )
}
export function Input({ label, hint, error, value, onChange, className, mask, ...rest }: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> & { label?: string; hint?: string; error?: string; value: any; onChange: (v: string) => void; mask?: (v: string) => string }) {
  return <Field label={label} hint={hint} error={error} className={className}><input value={value ?? ''} onChange={(e) => onChange(mask ? mask(e.target.value) : e.target.value)} className={fieldCls} {...rest} /></Field>
}
export function TextArea({ label, value, onChange, className, ...rest }: Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> & { label?: string; value: any; onChange: (v: string) => void }) {
  return <Field label={label} className={className}><textarea value={value ?? ''} onChange={(e) => onChange(e.target.value)} className={cls(fieldCls, 'resize-none')} rows={3} {...rest} /></Field>
}
export function Choice<T extends string>({ label, value, onChange, options }: { label?: string; value: T; onChange: (v: T) => void; options: T[] }) {
  return (
    <Field label={label}>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => <button type="button" key={o} onClick={() => onChange(o)} className={cls('rounded-full border px-4 py-2 text-sm font-bold transition', value === o ? 'border-brand-500 bg-brand-500 text-white' : 'border-paper-line bg-white text-ink-soft')}>{o}</button>)}
      </div>
    </Field>
  )
}
export function Switch({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex w-full items-center justify-between gap-4 rounded-2xl border border-paper-line bg-white px-4 py-3.5 text-left">
      <span><span className="block text-sm font-bold">{label}</span>{hint && <span className="block text-xs text-ink-muted">{hint}</span>}</span>
      <span className={cls('relative h-7 w-12 shrink-0 rounded-full transition', checked ? 'bg-leaf-500' : 'bg-gray-300')}><span className={cls('absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all', checked ? 'left-[22px]' : 'left-0.5')} /></span>
    </button>
  )
}

/** Tela cheia que desliza por cima (detalhes, formulários). */
export function Sheet({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode }) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 animate-fade bg-ink/40" onClick={onClose} />
      <div role="dialog" aria-label={title} className="relative mx-auto flex max-h-[94%] w-full max-w-lg animate-up flex-col rounded-t-[28px] bg-paper shadow-lift">
        <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-4">
          <h2 className="text-lg font-extrabold">{title}</h2>
          <button onClick={onClose} aria-label="Fechar" className="grid h-10 w-10 place-items-center rounded-full bg-white text-ink-soft shadow-sm"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-5">{children}</div>
        {footer && <div className="border-t border-paper-line bg-white px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">{footer}</div>}
      </div>
    </div>
  )
}

export function TopBar({ title, onBack, right }: { title: string; onBack?: () => void; right?: React.ReactNode }) {
  return (
    <div className="sticky top-0 z-20 flex items-center gap-2 bg-paper/90 px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur">
      {onBack && <button onClick={onBack} aria-label="Voltar" className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-sm"><ChevronLeft size={22} /></button>}
      <h1 className="flex-1 truncate text-[22px] font-extrabold tracking-tight">{title}</h1>
      {right}
    </div>
  )
}

export function Empty({ icon: Icon = PawPrint, title, text, action }: { icon?: any; title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-3 grid h-16 w-16 place-items-center rounded-full bg-brand-50 text-brand-500"><Icon size={28} /></div>
      <p className="font-extrabold">{title}</p>
      {text && <p className="mt-1 max-w-xs text-sm text-ink-muted">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
export const Spinner = () => <div className="grid place-items-center py-16 text-brand-500"><Loader2 className="animate-spin" /></div>
