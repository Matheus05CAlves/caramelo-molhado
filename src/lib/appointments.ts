import { db } from './store'
import { notify } from './notify'
import { fmtDate } from './util'

export const APPT_SELECT = `SELECT a.*, p.name AS pet_name, p.photo AS pet_photo, p.breed AS pet_breed, p.size AS pet_size, p.allergies AS pet_allergies, p.restrictions AS pet_restrictions,
  c.name AS client_name, c.phone AS client_phone, c.whatsapp AS client_whatsapp, u.name AS employee_name
  FROM appointments a JOIN pets p ON p.id=a.pet_id JOIN clients c ON c.id=a.client_id LEFT JOIN users u ON u.id=a.employee_id`

/** Muda o status do atendimento, registra no histórico de alterações e avisa a equipe. */
export async function changeStatus(a: any, status: string) {
  await db.update('appointments', a.id, { status, updated_at: new Date().toISOString().slice(0, 16).replace('T', ' ') })
  await db.audit('Mudou status do agendamento', 'Agendamento', `${a.pet_name}: ${a.status} → ${status}`)
  if (status === 'Cancelado') await notify('cancelamento', `Agendamento cancelado: ${a.pet_name}`, `${a.service_name} em ${fmtDate(a.date)} às ${a.start_time}.`, 'appointments')
  if (status === 'Aguardando retirada' || status === 'Finalizado') await notify('retirada', `${a.pet_name} está pronto para retirada`, `Avise ${a.client_name}${a.delivery ? ' (entrega solicitada)' : ''}.`, 'dashboard')
}

export const NEXT_STATUS: Record<string, string | null> = {
  'Agendado': 'Confirmado', 'Confirmado': 'Aguardando chegada', 'Aguardando chegada': 'Em atendimento',
  'Em atendimento': 'Finalizado', 'Finalizado': 'Aguardando retirada', 'Aguardando retirada': 'Entregue', 'Entregue': null, 'Cancelado': null,
}
