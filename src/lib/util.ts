export const cls = (...a: any[]) => a.filter(Boolean).join(' ')

const p2 = (n: number) => String(n).padStart(2, '0')
export const toISO = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`
export const todayISO = () => toISO(new Date())
export const parseISO = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export const addDays = (iso: string, n: number) => {
  const d = parseISO(iso)
  d.setDate(d.getDate() + n)
  return toISO(d)
}
export const startOfWeek = (iso: string) => {
  const d = parseISO(iso)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)) // semana começa na segunda
  return toISO(d)
}
export const fmtDate = (iso?: string | null) => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '—')
export const fmtDateTime = (s?: string | null) => (s ? `${fmtDate(s.slice(0, 10))} ${s.slice(11, 16)}` : '—')
export const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
export const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
export const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
export const longDate = (iso: string) => {
  const d = parseISO(iso)
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} de ${MONTHS[d.getMonth()]}`
}
export const dayDiff = (a: string, b: string) => Math.round((parseISO(a).getTime() - parseISO(b).getTime()) / 86400000)

export const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}
export const fromMin = (n: number) => `${p2(Math.floor(n / 60))}:${p2(n % 60)}`
export const endTime = (start: string, dur: number) => fromMin(toMin(start) + dur)

export const brl = (n: number | null | undefined) => (n ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function ageText(birth?: string | null) {
  if (!birth || !/^\d{4}-\d{2}-\d{2}/.test(birth)) return '—'
  const b = parseISO(birth.slice(0, 10))
  const now = new Date()
  let months = (now.getFullYear() - b.getFullYear()) * 12 + now.getMonth() - b.getMonth()
  if (now.getDate() < b.getDate()) months -= 1
  if (months < 0) return '—'
  const y = Math.floor(months / 12)
  const m = months % 12
  if (y === 0) return m <= 1 ? `${m} mês` : `${m} meses`
  return m === 0 ? `${y} ${y === 1 ? 'ano' : 'anos'}` : `${y} ${y === 1 ? 'ano' : 'anos'} e ${m} ${m === 1 ? 'mês' : 'meses'}`
}

export const initials = (name = '') =>
  name.split(' ').filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join('')

/* máscaras */
export const maskPhone = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}
export const maskCPF = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11)
  return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}
export const maskCEP = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 8)
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d
}
export function validCPF(cpf: string) {
  const d = cpf.replace(/\D/g, '')
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false
  const calc = (len: number) => {
    let s = 0
    for (let i = 0; i < len; i++) s += Number(d[i]) * (len + 1 - i)
    const r = (s * 10) % 11
    return r === 10 ? 0 : r
  }
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10])
}
export const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
export const onlyDigits = (s = '') => s.replace(/\D/g, '')

export function addressLine(c: any) {
  const l1 = [c.street, c.number].filter(Boolean).join(', ')
  const l2 = [c.complement, c.neighborhood].filter(Boolean).join(' - ')
  const l3 = [c.city, c.state].filter(Boolean).join('/')
  return [l1, l2, l3, c.cep].filter(Boolean).join(' · ') || 'Endereço não informado'
}

/* imagens: redimensiona para economizar espaço no banco */
export function fileToDataUrl(file: File, max = 480): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Arquivo de imagem inválido.'))
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height))
        const c = document.createElement('canvas')
        c.width = Math.round(img.width * scale)
        c.height = Math.round(img.height * scale)
        c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
        resolve(c.toDataURL('image/jpeg', 0.85))
      }
      img.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  })
}

export const waLink = (phone: string) => `https://wa.me/55${onlyDigits(phone)}`
export const mapsLink = (dest: string, origin?: string, waypoints: string[] = []) => {
  const q = new URLSearchParams({ api: '1', destination: dest, travelmode: 'driving' })
  if (origin) q.set('origin', origin)
  if (waypoints.length) q.set('waypoints', waypoints.join('|'))
  return `https://www.google.com/maps/dir/?${q.toString()}`
}
