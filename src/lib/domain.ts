import { dayDiff, todayISO } from './util'

export type Tone = 'green' | 'orange' | 'amber' | 'blue' | 'purple' | 'red' | 'gray'

export const STATUSES: { name: string; tone: Tone }[] = [
  { name: 'Agendado', tone: 'amber' },
  { name: 'Confirmado', tone: 'green' },
  { name: 'Aguardando chegada', tone: 'orange' },
  { name: 'Em atendimento', tone: 'blue' },
  { name: 'Finalizado', tone: 'purple' },
  { name: 'Aguardando retirada', tone: 'purple' },
  { name: 'Entregue', tone: 'gray' },
  { name: 'Cancelado', tone: 'red' },
]
export const statusTone = (s: string): Tone => STATUSES.find((x) => x.name === s)?.tone || 'gray'

export const TONES: Record<Tone, { bg: string; text: string; solid: string; soft: string; ring: string }> = {
  green: { bg: 'bg-leaf-50', text: 'text-leaf-700', solid: 'bg-leaf-500', soft: '#E8F8F0', ring: '#1FA971' },
  orange: { bg: 'bg-brand-50', text: 'text-brand-700', solid: 'bg-brand-500', soft: '#FFF5EB', ring: '#FF7A1A' },
  amber: { bg: 'bg-yellow-50', text: 'text-yellow-700', solid: 'bg-yellow-400', soft: '#FEF9E1', ring: '#EAB308' },
  blue: { bg: 'bg-blue-50', text: 'text-blue-700', solid: 'bg-blue-500', soft: '#EAF2FE', ring: '#2F7DE1' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-700', solid: 'bg-purple-500', soft: '#F3EDFD', ring: '#7C4DDB' },
  red: { bg: 'bg-red-50', text: 'text-red-700', solid: 'bg-red-500', soft: '#FDECEC', ring: '#E5484D' },
  gray: { bg: 'bg-gray-100', text: 'text-gray-600', solid: 'bg-gray-400', soft: '#F1F2F4', ring: '#9AA1AD' },
}

export const WAITING = ['Agendado', 'Confirmado', 'Aguardando chegada']
export const READY = ['Finalizado', 'Aguardando retirada']
export const ACTIVE_STATUSES = STATUSES.filter((s) => s.name !== 'Cancelado').map((s) => s.name)

export const CATEGORIES = ['Banho', 'Tosa', 'Cuidados', 'Outro']
export const SIZES = ['Pequeno', 'Médio', 'Grande']
export const SEXES = ['Macho', 'Fêmea']
export const SPECIES = ['Cachorro', 'Gato', 'Outro']

export const PERMISSIONS: { key: string; label: string; hint: string }[] = [
  { key: 'clients_edit', label: 'Clientes', hint: 'Cadastrar e editar clientes' },
  { key: 'pets_edit', label: 'Pets', hint: 'Cadastrar e editar pets, vacinas e peso' },
  { key: 'appointments_edit', label: 'Agendamentos', hint: 'Criar, editar, remarcar e cancelar' },
  { key: 'schedule_edit', label: 'Horários da agenda', hint: 'Alterar horários, bloquear e abrir horários extras' },
  { key: 'services_edit', label: 'Serviços e preços', hint: 'Criar e editar serviços, duração e preços' },
  { key: 'adoption_edit', label: 'Adoção e doações', hint: 'Cadastrar animais e interessados' },
  { key: 'map_view', label: 'Mapa de clientes', hint: 'Ver o mapa de coleta e entrega' },
  { key: 'revenue_view', label: 'Faturamento', hint: 'Ver valores faturados no painel' },
  { key: 'delete_records', label: 'Excluir registros', hint: 'Apagar clientes, pets e demais cadastros' },
]
export const DEFAULT_EMPLOYEE_PERMS: Record<string, boolean> = { clients_edit: true, pets_edit: true, appointments_edit: true, map_view: true }

export const ADOPTION_STATUSES: { name: string; tone: Tone }[] = [
  { name: 'Disponível para adoção', tone: 'green' },
  { name: 'Em processo de adoção', tone: 'orange' },
  { name: 'Em tratamento', tone: 'blue' },
  { name: 'Adotado', tone: 'purple' },
]

export type VaccineState = 'overdue' | 'soon' | 'ok' | 'none'
export function vaccineState(nextDose?: string | null, alertDays = 30): VaccineState {
  if (!nextDose) return 'none'
  const diff = dayDiff(nextDose, todayISO())
  if (diff < 0) return 'overdue'
  if (diff <= alertDays) return 'soon'
  return 'ok'
}
export const VACCINE_LABEL: Record<VaccineState, string> = { overdue: 'Atrasada', soon: 'Vence em breve', ok: 'Em dia', none: 'Sem próxima dose' }
export const VACCINE_TONE: Record<VaccineState, Tone> = { overdue: 'red', soon: 'orange', ok: 'green', none: 'gray' }

export const VACCINE_PRESETS = ['V8 / V10 (múltipla)', 'Antirrábica', 'Gripe canina', 'Giárdia', 'Leishmaniose', 'Vermífugo']
export const PAGES = ['dashboard', 'pets', 'clients', 'appointments', 'requests', 'adoption', 'map', 'staff', 'profile', 'settings'] as const
export type Page = (typeof PAGES)[number]

/** Condição SQL: só a dose mais recente de cada vacina conta para alertas (as anteriores ficam como histórico). */
export const latestVaccine = (a = 'v') =>
  `NOT EXISTS (SELECT 1 FROM vaccines x WHERE x.pet_id=${a}.pet_id AND lower(x.name)=lower(${a}.name) AND (COALESCE(x.applied_at,'')>COALESCE(${a}.applied_at,'') OR (COALESCE(x.applied_at,'')=COALESCE(${a}.applied_at,'') AND x.id>${a}.id)))`
export const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO']
