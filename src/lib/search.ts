import { onlyDigits } from './util'

export const digitsSql = (col: string) => `REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(${col},'(',''),')',''),' ',''),'-',''),'.','')`

/** Filtro SQL para localizar clientes por nome, CPF ou telefone. */
export function clientSearch(q: string, alias = 'c') {
  const t = q.trim()
  if (!t) return { where: '1=1', params: [] as any[] }
  const d = onlyDigits(t)
  const parts = [`${alias}.name LIKE ?`]
  const params: any[] = [`%${t}%`]
  if (d.length >= 3) {
    parts.push(`${digitsSql(alias + '.cpf')} LIKE ?`, `${digitsSql(alias + '.phone')} LIKE ?`)
    params.push(`%${d}%`, `%${d}%`)
  }
  return { where: `(${parts.join(' OR ')})`, params }
}
