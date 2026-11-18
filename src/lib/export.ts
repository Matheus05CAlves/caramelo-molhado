import * as XLSX from 'xlsx'
import { db } from './store'
import { ageText, brl, fmtDate, todayISO } from './util'
import { VACCINE_LABEL, latestVaccine, vaccineState } from './domain'

export type ExportKind = 'clients' | 'pets' | 'appointments' | 'vaccines' | 'adoption' | 'revenue'
export interface Dataset { title: string; columns: string[]; rows: (string | number)[][]; landscape?: boolean }

export const EXPORT_LABELS: Record<ExportKind, { label: string; hint: string; period?: boolean }> = {
  clients: { label: 'Clientes', hint: 'Contatos e endereços dos tutores' },
  pets: { label: 'Pets', hint: 'Fichas básicas, porte, peso e tutor' },
  appointments: { label: 'Agendamentos', hint: 'Atendimentos do período escolhido', period: true },
  vaccines: { label: 'Vacinas a vencer ou atrasadas', hint: 'Lista para entrar em contato com os tutores' },
  adoption: { label: 'Animais para adoção', hint: 'Situação de cada animal acolhido' },
  revenue: { label: 'Faturamento', hint: 'Atendimentos finalizados ou entregues no período', period: true },
}

export async function buildDataset(kind: ExportKind, from: string, to: string, alertDays: number): Promise<Dataset> {
  switch (kind) {
    case 'clients': {
      const r = await db.all('SELECT c.*, (SELECT COUNT(*) FROM pets p WHERE p.client_id=c.id) AS pets FROM clients c ORDER BY c.name')
      return { title: 'Clientes', landscape: true, columns: ['Nome', 'CPF', 'Telefone', 'E-mail', 'Endereço', 'Bairro', 'Cidade', 'Pets'], rows: r.map((c) => [c.name, c.cpf || '', c.phone || '', c.email || '', [c.street, c.number].filter(Boolean).join(', '), c.neighborhood || '', c.city || '', c.pets]) }
    }
    case 'pets': {
      const r = await db.all('SELECT p.*, c.name AS tutor FROM pets p JOIN clients c ON c.id=p.client_id ORDER BY p.name')
      return { title: 'Pets', landscape: true, columns: ['Pet', 'Raça', 'Sexo', 'Porte', 'Peso (kg)', 'Idade', 'Tutor'], rows: r.map((p) => [p.name, p.breed || '', p.sex || '', p.size || '', p.weight ?? '', ageText(p.birth_date), p.tutor]) }
    }
    case 'appointments': {
      const r = await db.all('SELECT a.*, p.name AS pet, c.name AS tutor, c.phone FROM appointments a JOIN pets p ON p.id=a.pet_id JOIN clients c ON c.id=a.client_id WHERE a.date BETWEEN ? AND ? ORDER BY a.date, a.start_time', [from, to])
      return { title: `Agendamentos de ${fmtDate(from)} a ${fmtDate(to)}`, landscape: true, columns: ['Data', 'Hora', 'Pet', 'Tutor', 'Telefone', 'Serviço', 'Status', 'Valor'], rows: r.map((a) => [fmtDate(a.date), a.start_time, a.pet, a.tutor, a.phone || '', a.service_name, a.status, brl(a.price)]) }
    }
    case 'vaccines': {
      const r = await db.all(`SELECT v.*, p.name AS pet, c.name AS tutor, c.phone FROM vaccines v JOIN pets p ON p.id=v.pet_id JOIN clients c ON c.id=p.client_id WHERE v.next_dose IS NOT NULL AND v.next_dose<>'' AND ` + latestVaccine('v') + ` ORDER BY v.next_dose`)
      const rows = r.filter((v) => ['overdue', 'soon'].includes(vaccineState(v.next_dose, alertDays))).map((v) => [v.pet, v.tutor, v.phone || '', v.name, fmtDate(v.next_dose), VACCINE_LABEL[vaccineState(v.next_dose, alertDays)]])
      return { title: 'Vacinas a vencer ou atrasadas', columns: ['Pet', 'Tutor', 'Telefone', 'Vacina', 'Próxima dose', 'Situação'], rows }
    }
    case 'adoption': {
      const r = await db.all('SELECT * FROM adoption_animals ORDER BY status, name')
      return { title: 'Animais para adoção', landscape: true, columns: ['Nome', 'Idade', 'Sexo', 'Porte', 'Castrado', 'Vacinas', 'Saúde', 'Status', 'Entrada'], rows: r.map((a) => [a.name, a.approx_age || '', a.sex || '', a.size || '', a.neutered || '', a.vaccines || '', a.health || '', a.status, fmtDate(a.entered_at)]) }
    }
    case 'revenue': {
      const r = await db.all("SELECT a.*, p.name AS pet, c.name AS tutor FROM appointments a JOIN pets p ON p.id=a.pet_id JOIN clients c ON c.id=a.client_id WHERE a.date BETWEEN ? AND ? AND a.status IN ('Finalizado','Aguardando retirada','Entregue') ORDER BY a.date, a.start_time", [from, to])
      const total = r.reduce((s, a) => s + (a.price || 0), 0)
      const rows: (string | number)[][] = r.map((a) => [fmtDate(a.date), a.pet, a.tutor, a.service_name, brl(a.price)])
      rows.push(['', '', '', 'Total do período', brl(total)])
      return { title: `Faturamento de ${fmtDate(from)} a ${fmtDate(to)}`, columns: ['Data', 'Pet', 'Tutor', 'Serviço', 'Valor'], rows }
    }
  }
}

const esc = (v: any) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))

export function reportHtml(ds: Dataset, shopName: string) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>
  body{font-family:Segoe UI,Arial,sans-serif;color:#2A2F38;margin:0;padding:8px}
  header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #FF7A1A;padding-bottom:10px;margin-bottom:16px}
  h1{font-size:20px;margin:0}h2{font-size:12px;font-weight:600;color:#7A8391;margin:4px 0 0}
  table{width:100%;border-collapse:collapse;font-size:11px}
  th{background:#FFF5EB;color:#C75000;text-align:left;padding:7px 8px;border-bottom:2px solid #FFCFA0}
  td{padding:6px 8px;border-bottom:1px solid #E7E9EE}tr:nth-child(even) td{background:#FAFAFB}
  footer{margin-top:14px;font-size:10px;color:#7A8391}
  </style></head><body>
  <header><div><h1>${esc(ds.title)}</h1><h2>${esc(shopName)}</h2></div><div style="font-size:11px;color:#7A8391">Emitido em ${fmtDate(todayISO())}</div></header>
  <table><thead><tr>${ds.columns.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead>
  <tbody>${ds.rows.length ? ds.rows.map((r) => `<tr>${r.map((v) => `<td>${esc(v)}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${ds.columns.length}" style="text-align:center;padding:24px">Nenhum registro encontrado.</td></tr>`}</tbody></table>
  <footer>${ds.rows.length} registro(s)</footer></body></html>`
}

export async function exportDataset(kind: ExportKind, format: 'pdf' | 'xlsx', from: string, to: string, shopName: string, alertDays: number) {
  const ds = await buildDataset(kind, from, to, alertDays)
  const fileName = `${kind}-${todayISO()}`
  if (format === 'pdf') return window.api.export.pdf(reportHtml(ds, shopName), fileName, !!ds.landscape)
  const ws = XLSX.utils.aoa_to_sheet([ds.columns, ...ds.rows])
  ws['!cols'] = ds.columns.map((c, i) => ({ wch: Math.min(40, Math.max(c.length, ...ds.rows.map((r) => String(r[i] ?? '').length)) + 2) }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, ds.title.slice(0, 28).replace(/[\\/?*[\]:]/g, ' '))
  const base64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' })
  return window.api.export.file(base64, fileName, 'xlsx', 'Planilha Excel')
}
