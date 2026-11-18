import { bump, db } from './store'
import { dayDiff, fmtDate, todayISO, toMin } from './util'
import { latestVaccine, vaccineState } from './domain'

/** Registra uma notificação interna (eventos como novo agendamento, cancelamento etc.). */
export const notify = (type: string, title: string, body = '', link_page = 'dashboard') =>
  db.run('INSERT INTO notifications (type, title, body, link_page) VALUES (?,?,?,?)', [type, title, body, link_page]).catch(() => {})

/**
 * Cria os alertas automáticos (vacinas, retiradas, lembretes). Cada alerta tem uma chave única,
 * então o mesmo aviso nunca é criado duas vezes.
 */
export async function syncAlerts(alertDays: number) {
  const api = window.api.db
  let added = 0
  const add = async (key: string, type: string, title: string, body: string, link: string) => {
    const r = await api.run('INSERT OR IGNORE INTO notifications (type,title,body,link_page,notif_key) VALUES (?,?,?,?,?)', [type, title, body, link, key])
    added += r.changes
  }
  const today = todayISO()

  const vacs = await api.all(`SELECT v.id, v.name, v.next_dose, p.name AS pet, c.name AS tutor FROM vaccines v JOIN pets p ON p.id=v.pet_id JOIN clients c ON c.id=p.client_id WHERE v.next_dose IS NOT NULL AND v.next_dose<>'' AND ` + latestVaccine('v'))
  for (const v of vacs) {
    const st = vaccineState(v.next_dose, alertDays)
    if (st === 'overdue') await add(`vac-${v.id}-${v.next_dose}-o`, 'vacina', `Vacina atrasada: ${v.pet}`, `${v.name} venceu em ${fmtDate(v.next_dose)} (tutor: ${v.tutor}).`, 'pets')
    else if (st === 'soon') await add(`vac-${v.id}-${v.next_dose}-s`, 'vacina', `Vacina perto do vencimento: ${v.pet}`, `${v.name} vence em ${dayDiff(v.next_dose, today)} dia(s), dia ${fmtDate(v.next_dose)}.`, 'pets')
  }

  const ready = await api.all("SELECT a.id, a.status, p.name AS pet, c.name AS tutor FROM appointments a JOIN pets p ON p.id=a.pet_id JOIN clients c ON c.id=a.client_id WHERE a.date=? AND a.status IN ('Finalizado','Aguardando retirada')", [today])
  for (const a of ready) await add(`pickup-${a.id}-${today}`, 'retirada', `${a.pet} está pronto para retirada`, `Avise ${a.tutor}.`, 'dashboard')

  const now = new Date()
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const soon = await api.all("SELECT a.id, a.start_time, a.service_name, p.name AS pet FROM appointments a JOIN pets p ON p.id=a.pet_id WHERE a.date=? AND a.status IN ('Agendado','Confirmado','Aguardando chegada')", [today])
  for (const a of soon) {
    const diff = toMin(a.start_time) - nowMin
    if (diff >= 0 && diff <= 60) await add(`remind-${a.id}-${today}`, 'lembrete', `Em breve: ${a.pet} às ${a.start_time}`, `${a.service_name}.`, 'dashboard')
  }
  if (added) bump()
}
