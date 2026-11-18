import type { Hours } from './store'
import { fromMin, parseISO, toMin } from './util'

export interface Exception { id: number; date: string; start_time: string; end_time: string; kind: 'block' | 'extra'; reason?: string }
export interface Appt {
  id: number; date: string; start_time: string; duration_min: number; status: string; pet_id: number; client_id: number
  employee_id: number | null; service_name?: string; category?: string; price?: number; pet_name?: string; client_name?: string
  client_phone?: string; pickup?: number; delivery?: number; notes?: string; staff_notes?: string; service_id?: number | null; override?: number
}

export const dayHours = (date: string, hours: Hours) => hours[String(parseISO(date).getDay())] || { open: false, start: '08:00', end: '18:00' }

/** Faixa de minutos exibida no dia (horário normal + horários extras). */
export function dayRange(date: string, hours: Hours, exceptions: Exception[]) {
  const h = dayHours(date, hours)
  let start = toMin(h.start)
  let end = toMin(h.end)
  let open = h.open
  for (const e of exceptions.filter((x) => x.date === date && x.kind === 'extra')) {
    if (!open) { start = toMin(e.start_time); end = toMin(e.end_time); open = true }
    else { start = Math.min(start, toMin(e.start_time)); end = Math.max(end, toMin(e.end_time)) }
  }
  return { open, start, end }
}

export function isOpenAt(date: string, s: number, e: number, hours: Hours, exceptions: Exception[]) {
  const h = dayHours(date, hours)
  if (h.open && s >= toMin(h.start) && e <= toMin(h.end)) return true
  return exceptions.some((x) => x.date === date && x.kind === 'extra' && s >= toMin(x.start_time) && e <= toMin(x.end_time))
}
export const blockAt = (date: string, s: number, e: number, exceptions: Exception[]) =>
  exceptions.find((x) => x.date === date && x.kind === 'block' && s < toMin(x.end_time) && e > toMin(x.start_time))

export interface Candidate { date: string; start_time: string; duration_min: number; pet_id: number; employee_id?: number | null; ignoreId?: number }

/** Devolve a lista de motivos pelos quais o horário não está disponível (vazia = livre). */
export function checkConflict(c: Candidate, dayAppts: Appt[], hours: Hours, exceptions: Exception[], capacity: number): string[] {
  const s = toMin(c.start_time)
  const e = s + c.duration_min
  const msgs: string[] = []
  if (!isOpenAt(c.date, s, e, hours, exceptions)) msgs.push('Fora do horário de funcionamento.')
  const b = blockAt(c.date, s, e, exceptions)
  if (b) msgs.push(`Horário bloqueado${b.reason ? `: ${b.reason}` : ''}.`)
  const others = dayAppts.filter((a) => a.id !== c.ignoreId && a.date === c.date && a.status !== 'Cancelado' && s < toMin(a.start_time) + a.duration_min && e > toMin(a.start_time))
  if (others.some((a) => a.pet_id === c.pet_id)) msgs.push('Este pet já tem atendimento neste horário.')
  if (c.employee_id && others.some((a) => a.employee_id === c.employee_id)) msgs.push('O funcionário escolhido já está ocupado neste horário.')
  const points = [s, ...others.map((a) => toMin(a.start_time)).filter((t) => t > s && t < e)]
  const full = points.some((p) => others.filter((a) => toMin(a.start_time) <= p && p < toMin(a.start_time) + a.duration_min).length >= capacity)
  if (full) msgs.push(capacity === 1 ? 'Já existe um atendimento neste horário.' : `O limite de ${capacity} atendimentos simultâneos foi atingido.`)
  return msgs
}

/** Horários de início possíveis no dia, com o resultado da checagem de conflito. */
export function startOptions(date: string, duration: number, pet_id: number, employee_id: number | null | undefined, dayAppts: Appt[], hours: Hours, exceptions: Exception[], capacity: number, interval: number, ignoreId?: number) {
  const r = dayRange(date, hours, exceptions)
  const out: { time: string; msgs: string[] }[] = []
  for (let t = r.start; t + Math.min(duration, interval) <= r.end || t < r.end; t += interval) {
    if (t >= r.end) break
    const time = fromMin(t)
    out.push({ time, msgs: checkConflict({ date, start_time: time, duration_min: duration, pet_id, employee_id, ignoreId }, dayAppts, hours, exceptions, capacity) })
  }
  return out
}
