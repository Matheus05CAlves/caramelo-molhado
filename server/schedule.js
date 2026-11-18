// Regras de agenda (mesma lógica de src/lib/schedule.ts), usadas pelo servidor para
// calcular horários livres e validar agendamentos feitos pelo app do cliente.

const p2 = (n) => String(n).padStart(2, '0')
const toMin = (t) => { const [h, m] = String(t).split(':').map(Number); return h * 60 + m }
const fromMin = (n) => `${p2(Math.floor(n / 60))}:${p2(n % 60)}`
const parseISO = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
const toISO = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`
const todayISO = () => toISO(new Date())
const addDays = (iso, n) => { const d = parseISO(iso); d.setDate(d.getDate() + n); return toISO(d) }
const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes() }

const dayHours = (date, hours) => hours[String(parseISO(date).getDay())] || { open: false, start: '08:00', end: '18:00' }

function dayRange(date, hours, exceptions) {
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

function isOpenAt(date, s, e, hours, exceptions) {
  const h = dayHours(date, hours)
  if (h.open && s >= toMin(h.start) && e <= toMin(h.end)) return true
  return exceptions.some((x) => x.date === date && x.kind === 'extra' && s >= toMin(x.start_time) && e <= toMin(x.end_time))
}

const blockAt = (date, s, e, exceptions) =>
  exceptions.find((x) => x.date === date && x.kind === 'block' && s < toMin(x.end_time) && e > toMin(x.start_time))

/** Motivos pelos quais o horário não está disponível (vazio = livre). */
function checkConflict(c, dayAppts, hours, exceptions, capacity) {
  const s = toMin(c.start_time)
  const e = s + c.duration_min
  const msgs = []
  if (!isOpenAt(c.date, s, e, hours, exceptions)) msgs.push('Fora do horário de funcionamento.')
  const b = blockAt(c.date, s, e, exceptions)
  if (b) msgs.push('Horário bloqueado.')
  const others = dayAppts.filter((a) => a.id !== c.ignoreId && a.date === c.date && a.status !== 'Cancelado' && s < toMin(a.start_time) + a.duration_min && e > toMin(a.start_time))
  if (others.some((a) => a.pet_id === c.pet_id)) msgs.push('Este pet já tem atendimento neste horário.')
  const points = [s, ...others.map((a) => toMin(a.start_time)).filter((t) => t > s && t < e)]
  const full = points.some((p) => others.filter((a) => toMin(a.start_time) <= p && p < toMin(a.start_time) + a.duration_min).length >= capacity)
  if (full) msgs.push('Horário já ocupado.')
  return msgs
}

/** Horários de início livres para o cliente, respeitando antecedência mínima. */
function freeSlots({ date, duration, pet_id, dayAppts, hours, exceptions, capacity, interval, minNoticeMin }) {
  const r = dayRange(date, hours, exceptions)
  if (!r.open) return []
  const isToday = date === todayISO()
  const earliest = isToday ? nowMin() + minNoticeMin : -1
  const out = []
  for (let t = r.start; t < r.end; t += interval) {
    if (t + duration > r.end) break
    if (t < earliest) continue
    const time = fromMin(t)
    if (checkConflict({ date, start_time: time, duration_min: duration, pet_id }, dayAppts, hours, exceptions, capacity).length === 0) out.push(time)
  }
  return out
}

module.exports = { toMin, fromMin, parseISO, toISO, todayISO, addDays, nowMin, dayRange, checkConflict, freeSlots }
