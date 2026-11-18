// Núcleo do sistema: regras de negócio compartilhadas entre o app desktop (Electron, via IPC)
// e o servidor HTTP usado pelos apps de celular (equipe e clientes).
const crypto = require('crypto')
const db = require('./db')
const auth = require('./auth')
const seed = require('./seed')
const sched = require('./schedule')

const UA = 'CarameloMolhadoPetShop/2.0 (sistema de gestão)'
const SESSION_DAYS = 60

/* ---------- utilitários ---------- */
const safeJson = (s) => { try { return s ? JSON.parse(s) : {} } catch { return {} } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const str = (v, max = 500) => String(v ?? '').trim().slice(0, max)
const digits = (v) => String(v ?? '').replace(/\D/g, '')
const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
const nowStamp = () => { const d = new Date(); return `${sched.toISO(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }
const fail = (msg, status = 400) => { const e = new Error(msg); e.status = status; throw e }

function setting(key, fallback = '') {
  const r = db.get('SELECT value FROM settings WHERE key=?', [key])
  return r && r.value !== null && r.value !== undefined ? r.value : fallback
}
function shopRules() {
  let hours = {}
  try { hours = JSON.parse(setting('hours', '{}')) } catch {}
  return {
    hours,
    interval: Number(setting('slot_interval', '30')) || 30,
    capacity: Number(setting('capacity', '1')) || 1,
    bookingEnabled: setting('client_booking_enabled', '1') === '1',
    signupOpen: setting('client_signup_open', '1') === '1',
    minNoticeHours: Math.max(0, Number(setting('client_min_notice_hours', '2')) || 0),
    maxDaysAhead: Math.max(1, Number(setting('client_max_days_ahead', '30')) || 30),
    cancelHours: Math.max(0, Number(setting('client_cancel_hours', '2')) || 0),
  }
}

/* ---------- sessões (tokens dos apps) ---------- */
const sha = (t) => crypto.createHash('sha256').update(String(t)).digest('hex')
function createSession(kind, subjectId, device = '') {
  const token = crypto.randomBytes(32).toString('base64url')
  db.run('INSERT INTO api_sessions (token_hash, kind, subject_id, device) VALUES (?,?,?,?)', [sha(token), kind, subjectId, str(device, 120)])
  return token
}
function resolveSession(token, kind) {
  if (!token) return null
  const s = db.get('SELECT * FROM api_sessions WHERE token_hash=? AND kind=?', [sha(token), kind])
  if (!s) return null
  const last = new Date(String(s.last_seen).replace(' ', 'T'))
  if (Date.now() - last.getTime() > SESSION_DAYS * 86400000) { db.run('DELETE FROM api_sessions WHERE id=?', [s.id]); return null }
  if (Date.now() - last.getTime() > 5 * 60000) db.run("UPDATE api_sessions SET last_seen=datetime('now','localtime') WHERE id=?", [s.id])
  return s
}
const dropSession = (token) => token && db.run('DELETE FROM api_sessions WHERE token_hash=?', [sha(token)])
const dropSessionsOf = (kind, id) => db.run('DELETE FROM api_sessions WHERE kind=? AND subject_id=?', [kind, id])

/* ---------- equipe ---------- */
const sessionUser = (ctx) => (ctx.userId ? db.get('SELECT * FROM users WHERE id = ? AND active = 1', [ctx.userId]) : null)
function requireUser(ctx) {
  const u = sessionUser(ctx)
  if (!u) fail('Sua sessão expirou. Entre novamente.', 401)
  return u
}
function requireAdmin(ctx) {
  const u = requireUser(ctx)
  if (u.role !== 'admin') fail('Apenas administradores podem fazer isso.', 403)
  return u
}
function requirePerm(ctx, perm) {
  const u = requireUser(ctx)
  if (u.role !== 'admin' && !safeJson(u.permissions)[perm]) fail('Você não tem permissão para fazer isso.', 403)
  return u
}
function publicUser(u) {
  if (!u) return null
  const { password_hash, salt, ...rest } = u
  return { ...rest, permissions: safeJson(u.permissions) }
}
const SECRET_KEYS = ['password_hash', 'salt', 'token_hash']
function strip(rows) {
  rows.forEach((r) => SECRET_KEYS.forEach((k) => delete r[k]))
  return rows
}
function audit(action, entity, detail, user, userName) {
  db.run('INSERT INTO audit_log (user_id, user_name, action, entity, detail) VALUES (?,?,?,?,?)',
    [user ? user.id : null, userName || (user ? user.name : 'Sistema'), action, entity || '', detail || ''])
}
const staffNotify = (type, title, body, link = 'appointments') =>
  db.run('INSERT INTO notifications (type, title, body, link_page) VALUES (?,?,?,?)', [type, title, body, link])

// A interface da equipe envia SQL; o servidor só aceita leitura em db:all/get e bloqueia tabelas sensíveis na escrita.
const READ_ONLY = /^\s*(select|with)\b/i
const FORBIDDEN = /\b(drop|alter|attach|detach|pragma|create|vacuum)\b/i
const SECRET_SQL = /\b(password_hash|salt|token_hash|api_sessions)\b/i
function guardRead(sql) {
  if (!READ_ONLY.test(sql)) fail('Consulta inválida.')
  if (SECRET_SQL.test(sql)) fail('Consulta não permitida.')
}
function guardWrite(sql) {
  if (FORBIDDEN.test(sql)) fail('Comando não permitido.')
  if (/\b(users|audit_log|client_accounts|api_sessions)\b/i.test(sql)) fail('Esta tabela só pode ser alterada pelas telas próprias do sistema.')
}

/* ---------- geocodificação (ViaCEP / OpenStreetMap Nominatim) ---------- */
async function cep(value) {
  const d = digits(value)
  if (d.length !== 8) fail('CEP inválido.')
  let r
  try { r = await fetch(`https://viacep.com.br/ws/${d}/json/`, { headers: { 'User-Agent': UA } }) } catch { fail('Não foi possível consultar o CEP. Verifique a conexão com a internet.') }
  if (!r.ok) fail('Não foi possível consultar o CEP. Verifique a conexão com a internet.')
  const j = await r.json()
  if (j.erro) fail('CEP não encontrado.')
  return { street: j.logradouro, neighborhood: j.bairro, city: j.localidade, state: j.uf, complement: j.complemento }
}
let nextSlot = 0
async function nominatim(q) {
  const now = Date.now()
  const at = Math.max(now, nextSlot)
  nextSlot = at + 1100 // política do Nominatim: no máximo 1 consulta por segundo
  if (at > now) await sleep(at - now)
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&q=${encodeURIComponent(q)}`
  const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'pt-BR' } })
  if (!r.ok) fail('Serviço de mapas indisponível no momento.')
  const j = await r.json()
  return j[0] ? { lat: Number(j[0].lat), lng: Number(j[0].lon) } : null
}
async function geoLookup(c) {
  const join = (...p) => p.filter((x) => x && String(x).trim()).join(', ')
  const tries = [
    join(`${c.street || ''} ${c.number || ''}`.trim(), c.neighborhood, c.city, c.state, 'Brasil'),
    join(c.street, c.city, c.state, 'Brasil'),
    c.cep ? join(c.cep, c.city, 'Brasil') : '',
  ].filter(Boolean)
  for (const q of tries) {
    const hit = await nominatim(q)
    if (hit) return hit
  }
  return null
}

/* ======================================================================
 * Canais da equipe (mesmos nomes usados pelo app desktop via IPC)
 * ctx = { userId } — no desktop é a sessão local; no servidor vem do token.
 * ====================================================================== */
const staff = {
  'db:all': (ctx, sql, params) => { requireUser(ctx); guardRead(sql); return strip(db.all(sql, params)) },
  'db:get': (ctx, sql, params) => { requireUser(ctx); guardRead(sql); return strip(db.all(sql, params))[0] || null },
  'db:run': (ctx, sql, params) => { requireUser(ctx); guardWrite(sql); return db.run(sql, params) },
  'db:batch': (ctx, statements) => { requireUser(ctx); statements.forEach((s) => guardWrite(s.sql)); return db.batch(statements) },
  'audit:log': (ctx, action, entity, detail) => { audit(action, entity, detail, requireUser(ctx)); return true },

  'auth:login': (ctx, username, password) => {
    username = str(username, 120)
    if (!username || !password) fail('Informe usuário e senha.')
    const wait = auth.checkLock(username)
    if (wait) fail(`Muitas tentativas. Aguarde ${wait}s para tentar de novo.`, 429)
    const u = db.get('SELECT * FROM users WHERE username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE', [username, username])
    if (!u || !auth.verifyPassword(password, u.salt, u.password_hash)) {
      auth.registerFail(username)
      audit('Falha de login', 'Sessão', username, null)
      fail('Usuário ou senha incorretos.', 401)
    }
    if (!u.active) fail('Seu acesso ainda não está ativo. Peça a um administrador para aprovar seu cadastro.', 403)
    auth.clearFails(username)
    ctx.userId = u.id
    audit('Login', 'Sessão', u.username + (ctx.device ? ` (${ctx.device})` : ''), u)
    return publicUser(u)
  },

  'auth:register': (ctx, name, email, password) => {
    name = str(name, 120)
    email = str(email, 160).toLowerCase()
    if (name.length < 3) fail('Informe seu nome completo.')
    if (!validEmail(email)) fail('Informe um e-mail válido.')
    const problem = auth.passwordProblem(password)
    if (problem) fail(problem)
    if (db.get('SELECT id FROM users WHERE username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE', [email, email])) fail('Já existe um cadastro com este e-mail.')
    const { salt, hash } = auth.hashPassword(password)
    // O cadastro nasce inativo: um administrador precisa aprovar antes do primeiro acesso.
    db.run('INSERT INTO users (name, username, email, password_hash, salt, role, job_title, permissions, active, must_change_password) VALUES (?,?,?,?,?,?,?,?,0,0)',
      [name, email, email, hash, salt, 'employee', '', JSON.stringify({ clients_edit: true, pets_edit: true, appointments_edit: true, map_view: true })])
    audit('Novo cadastro aguardando aprovação', 'Funcionário', email, null)
    staffNotify('agenda', 'Novo cadastro aguardando aprovação', `${name} (${email}) pediu acesso ao sistema.`, 'staff')
    return { pending: true }
  },

  'auth:session': (ctx) => publicUser(sessionUser(ctx)),
  'auth:logout': (ctx) => { const u = sessionUser(ctx); if (u) audit('Logout', 'Sessão', '', u); ctx.userId = null; return true },

  'auth:changePassword': (ctx, oldPw, newPw) => {
    const u = requireUser(ctx)
    if (!auth.verifyPassword(oldPw, u.salt, u.password_hash)) fail('A senha atual está incorreta.')
    const problem = auth.passwordProblem(newPw)
    if (problem) fail(problem)
    const { salt, hash } = auth.hashPassword(newPw)
    db.run('UPDATE users SET password_hash=?, salt=?, must_change_password=0 WHERE id=?', [hash, salt, u.id])
    audit('Alterou a própria senha', 'Funcionário', u.username, u)
    return true
  },

  'users:list': (ctx) => {
    const u = requireUser(ctx)
    if (u.role === 'admin') return strip(db.all('SELECT * FROM users ORDER BY active DESC, name')).map((r) => ({ ...r, permissions: safeJson(r.permissions) }))
    return db.all('SELECT id, name, job_title, photo, role, active FROM users WHERE active = 1 ORDER BY name')
  },

  'users:save': (ctx, data) => {
    const admin = requireAdmin(ctx)
    const name = str(data.name, 120)
    const username = str(data.username, 120)
    if (!name || !username) fail('Nome e usuário são obrigatórios.')
    const perms = JSON.stringify(data.permissions || {})
    const fields = [name, username, data.email || '', data.phone || '', data.birth_date || '', data.role === 'admin' ? 'admin' : 'employee', data.job_title || '', data.photo || null, perms, data.active ? 1 : 0]
    try {
      if (data.id) {
        const old = db.get('SELECT * FROM users WHERE id=?', [data.id])
        if (!old) fail('Funcionário não encontrado.')
        const newRole = data.role === 'admin' ? 'admin' : 'employee'
        const stillAdmin = newRole === 'admin' && data.active
        if (old.role === 'admin' && !stillAdmin && db.scalar("SELECT COUNT(*) FROM users WHERE role='admin' AND active=1 AND id<>?", [old.id]) === 0)
          fail('É preciso manter pelo menos um administrador ativo.')
        db.run('UPDATE users SET name=?, username=?, email=?, phone=?, birth_date=?, role=?, job_title=?, photo=?, permissions=?, active=? WHERE id=?', [...fields, data.id])
        if (!data.active) dropSessionsOf('staff', data.id)
        audit('Editou funcionário', 'Funcionário', `${name} (${username})`, admin)
        return data.id
      }
      const problem = auth.passwordProblem(data.password)
      if (problem) fail(problem)
      const { salt, hash } = auth.hashPassword(data.password)
      const r = db.run(
        'INSERT INTO users (name, username, email, phone, birth_date, role, job_title, photo, permissions, active, password_hash, salt, must_change_password) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1)',
        [...fields, hash, salt],
      )
      audit('Cadastrou funcionário', 'Funcionário', `${name} (${username})`, admin)
      return r.lastInsertRowid
    } catch (e) {
      if (/UNIQUE/i.test(e.message)) fail('Já existe um funcionário com este nome de usuário.')
      throw e
    }
  },

  'users:saveProfile': (ctx, data) => {
    const u = requireUser(ctx)
    db.run('UPDATE users SET name=?, email=?, phone=?, birth_date=?, photo=? WHERE id=?', [str(data.name || u.name, 120), data.email || '', data.phone || '', data.birth_date || '', data.photo || null, u.id])
    audit('Atualizou o próprio perfil', 'Funcionário', u.username, u)
    return publicUser(sessionUser(ctx))
  },

  'users:setPassword': (ctx, id, newPw) => {
    const admin = requireAdmin(ctx)
    const problem = auth.passwordProblem(newPw)
    if (problem) fail(problem)
    const { salt, hash } = auth.hashPassword(newPw)
    db.run('UPDATE users SET password_hash=?, salt=?, must_change_password=1 WHERE id=?', [hash, salt, id])
    dropSessionsOf('staff', id)
    audit('Redefiniu senha de funcionário', 'Funcionário', `id ${id}`, admin)
    return true
  },

  'demo:load': (ctx) => { const u = requireAdmin(ctx); seed.seedDemo(); audit('Carregou dados demonstrativos', 'Sistema', '', u); return true },
  'demo:remove': (ctx) => { const u = requireAdmin(ctx); seed.removeDemo(); audit('Removeu dados demonstrativos', 'Sistema', '', u); return true },

  'geo:cep': (ctx, value) => { requireUser(ctx); return cep(value) },
  'geo:lookup': (ctx, c) => { requireUser(ctx); return geoLookup(c) },

  /* ----- acesso dos clientes ao app ----- */
  'clients:appAccess': (ctx, clientId) => {
    requireUser(ctx)
    const c = db.get('SELECT id, name, email, app_invite_code, app_invite_expires FROM clients WHERE id=?', [clientId])
    if (!c) fail('Cliente não encontrado.')
    const acc = db.get('SELECT id, email, active, last_login, created_at FROM client_accounts WHERE client_id=?', [clientId])
    const inviteValid = c.app_invite_code && c.app_invite_expires && c.app_invite_expires >= sched.todayISO()
    return { account: acc, invite: inviteValid ? { code: c.app_invite_code, expires: c.app_invite_expires } : null }
  },
  'clients:newInvite': (ctx, clientId) => {
    const u = requirePerm(ctx, 'clients_edit')
    const c = db.get('SELECT id, name FROM clients WHERE id=?', [clientId])
    if (!c) fail('Cliente não encontrado.')
    if (db.get('SELECT id FROM client_accounts WHERE client_id=?', [clientId])) fail('Este cliente já tem conta no app.')
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // sem letras/números parecidos (O/0, I/1)
    let code
    do { code = Array.from(crypto.randomBytes(6), (b) => alphabet[b % alphabet.length]).join('') }
    while (db.get('SELECT id FROM clients WHERE app_invite_code=?', [code]))
    const expires = sched.addDays(sched.todayISO(), 7)
    db.run('UPDATE clients SET app_invite_code=?, app_invite_expires=? WHERE id=?', [code, expires, clientId])
    audit('Gerou código de acesso ao app', 'Cliente', c.name, u)
    return { code, expires }
  },
  'clients:setAppActive': (ctx, clientId, active) => {
    const u = requirePerm(ctx, 'clients_edit')
    const acc = db.get('SELECT id FROM client_accounts WHERE client_id=?', [clientId])
    if (!acc) fail('Este cliente não tem conta no app.')
    db.run('UPDATE client_accounts SET active=? WHERE id=?', [active ? 1 : 0, acc.id])
    if (!active) dropSessionsOf('client', acc.id)
    audit(active ? 'Reativou acesso ao app' : 'Bloqueou acesso ao app', 'Cliente', `cliente ${clientId}`, u)
    return true
  },

  /* ----- backup pela rede (usado pelo app da empresa no celular) ----- */
  'backup:export': (ctx) => {
    const u = requireAdmin(ctx)
    audit('Gerou backup pelo app', 'Sistema', '', u)
    return { base64: db.exportBytes().toString('base64') }
  },
  'backup:restore': (ctx, base64) => {
    const u = requireAdmin(ctx)
    const buf = Buffer.from(String(base64 || ''), 'base64')
    if (buf.length < 100) fail('Arquivo de backup inválido.')
    db.replaceWith(buf)
    audit('Restaurou backup pelo app', 'Sistema', '', u)
    return true
  },
}

/* ======================================================================
 * API do app do cliente
 * ctx = { accountId, device } — o cliente só enxerga os próprios dados.
 * ====================================================================== */
function clientOf(ctx) {
  const acc = ctx.accountId ? db.get('SELECT * FROM client_accounts WHERE id=? AND active=1', [ctx.accountId]) : null
  if (!acc) fail('Sua sessão expirou. Entre novamente.', 401)
  const c = db.get('SELECT * FROM clients WHERE id=?', [acc.client_id])
  if (!c) fail('Cadastro não encontrado.', 401)
  return { acc, c }
}
const ownPet = (clientId, petId) => {
  const p = db.get('SELECT * FROM pets WHERE id=? AND client_id=?', [petId, clientId])
  if (!p) fail('Pet não encontrado.', 404)
  return p
}
const CLIENT_FIELDS = ['id', 'name', 'cpf', 'phone', 'whatsapp', 'email', 'birth_date', 'cep', 'street', 'number', 'complement', 'neighborhood', 'city', 'state', 'reference', 'pref_time', 'contact_pref', 'notify_ok']
const pick = (o, keys) => Object.fromEntries(keys.map((k) => [k, o[k] ?? null]))
const PET_FIELDS = ['name', 'species', 'breed', 'sex', 'birth_date', 'weight', 'size', 'color', 'photo', 'temperament', 'with_dogs', 'with_people', 'fears', 'allergies', 'restrictions', 'notes']
const WAITING = ['Agendado', 'Confirmado', 'Aguardando chegada']

function clientAppointments(clientId, where = '', params = []) {
  return db.all(`SELECT a.id, a.date, a.start_time, a.duration_min, a.status, a.service_name, a.category, a.price, a.pickup, a.delivery,
      a.notes, a.origin, a.cancel_reason, a.pet_id, p.name AS pet_name, p.photo AS pet_photo, u.name AS employee_name
    FROM appointments a JOIN pets p ON p.id=a.pet_id LEFT JOIN users u ON u.id=a.employee_id
    WHERE a.client_id=? ${where} ORDER BY a.date, a.start_time`, [clientId, ...params])
}

function daySlots({ date, service, petId, rules }) {
  const exceptions = db.all('SELECT * FROM schedule_exceptions WHERE date=?', [date])
  const dayAppts = db.all("SELECT id, date, start_time, duration_min, status, pet_id FROM appointments WHERE date=? AND status<>'Cancelado'", [date])
  return sched.freeSlots({
    date, duration: service.duration_min, pet_id: petId, dayAppts, hours: rules.hours, exceptions,
    capacity: rules.capacity, interval: rules.interval, minNoticeMin: rules.minNoticeHours * 60,
  })
}
function bookableService(id) {
  const s = db.get('SELECT * FROM services WHERE id=? AND active=1 AND client_visible=1', [id])
  if (!s) fail('Serviço indisponível para agendamento pelo app.')
  return s
}
function checkDateWindow(date, rules) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) fail('Data inválida.')
  const today = sched.todayISO()
  if (date < today) fail('Escolha uma data a partir de hoje.')
  if (date > sched.addDays(today, rules.maxDaysAhead)) fail(`Agendamentos pelo app podem ser feitos com até ${rules.maxDaysAhead} dias de antecedência.`)
}

const clientPublic = new Set(['loja', 'cadastro', 'login', 'cep'])
const client = {
  loja: () => {
    const rules = shopRules()
    return {
      name: setting('shop_name', 'Caramelo Molhado Pet Shop Inc.'),
      phone: setting('shop_phone'), address: setting('shop_address'), logo: setting('shop_logo'),
      welcome: setting('client_welcome'),
      hours: rules.hours,
      booking: { enabled: rules.bookingEnabled, minNoticeHours: rules.minNoticeHours, maxDaysAhead: rules.maxDaysAhead, cancelHours: rules.cancelHours },
      signupOpen: rules.signupOpen,
      services: db.all('SELECT id, name, category, duration_min, price, description FROM services WHERE active=1 AND client_visible=1 ORDER BY sort, name'),
    }
  },

  cadastro: (ctx, b) => {
    const name = str(b.name, 120)
    const email = str(b.email, 160).toLowerCase()
    const phone = str(b.phone, 30)
    const code = str(b.invite_code, 20).toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (!code && !shopRules().signupOpen) fail('O cadastro pelo app está fechado. Peça um código de acesso ao pet shop.')
    if (!validEmail(email)) fail('Informe um e-mail válido.')
    const problem = auth.passwordProblem(b.password)
    if (problem) fail(problem)
    if (db.get('SELECT id FROM client_accounts WHERE email=?', [email])) fail('Já existe uma conta com este e-mail. Use "Entrar".')
    const { salt, hash } = auth.hashPassword(b.password)

    let clientId
    if (code) {
      // Código gerado pela equipe: liga a conta ao cadastro que já existe na loja (pets e histórico aparecem na hora).
      const c = db.get('SELECT id, name FROM clients WHERE app_invite_code=? AND app_invite_expires>=?', [code, sched.todayISO()])
      if (!c) fail('Código de acesso inválido ou vencido. Peça um novo ao pet shop.')
      if (db.get('SELECT id FROM client_accounts WHERE client_id=?', [c.id])) fail('Este cadastro já tem conta no app.')
      clientId = c.id
      db.batch([
        { sql: 'INSERT INTO client_accounts (client_id, email, password_hash, salt) VALUES (?,?,?,?)', params: [clientId, email, hash, salt] },
        { sql: "UPDATE clients SET app_invite_code=NULL, app_invite_expires=NULL, email=COALESCE(NULLIF(email,''), ?) WHERE id=?", params: [email, clientId] },
      ])
      audit('Cliente ativou o app com código', 'Cliente', c.name, null, `Cliente: ${c.name} (app)`)
    } else {
      if (name.length < 3) fail('Informe seu nome completo.')
      if (digits(phone).length < 10) fail('Informe um telefone com DDD.')
      const r = db.batch([
        { sql: "INSERT INTO clients (name, phone, whatsapp, email, origin, contact_pref) VALUES (?,?,?,?,'app','WhatsApp')", params: [name, phone, phone, email] },
        { sql: 'INSERT INTO client_accounts (client_id, email, password_hash, salt) VALUES (last_insert_rowid(),?,?,?)', params: [email, hash, salt] },
      ])
      clientId = r[0].lastInsertRowid
      audit('Novo cliente pelo app', 'Cliente', name, null, `Cliente: ${name} (app)`)
      staffNotify('agenda', 'Novo cliente pelo app', `${name} criou uma conta no app (${phone}).`, 'clients')
    }
    db.run('INSERT INTO client_notifications (client_id, type, title, body) VALUES (?,?,?,?)', [clientId, 'info', 'Conta criada!', 'Cadastre seus pets e agende o primeiro atendimento.'])
    return client.login(ctx, { email, password: b.password, device: b.device })
  },

  login: (ctx, b) => {
    const email = str(b.email, 160).toLowerCase()
    if (!email || !b.password) fail('Informe e-mail e senha.')
    const key = 'cliente:' + email
    const wait = auth.checkLock(key)
    if (wait) fail(`Muitas tentativas. Aguarde ${wait}s para tentar de novo.`, 429)
    const acc = db.get('SELECT * FROM client_accounts WHERE email=?', [email])
    if (!acc || !auth.verifyPassword(b.password, acc.salt, acc.password_hash)) { auth.registerFail(key); fail('E-mail ou senha incorretos.', 401) }
    if (!acc.active) fail('Seu acesso ao app está bloqueado. Fale com o pet shop.', 403)
    auth.clearFails(key)
    db.run("UPDATE client_accounts SET last_login=datetime('now','localtime') WHERE id=?", [acc.id])
    const token = createSession('client', acc.id, b.device || ctx.device)
    ctx.accountId = acc.id
    return { token, ...client.me(ctx) }
  },

  logout: (ctx) => { dropSession(ctx.token); return true },

  me: (ctx) => {
    const { acc, c } = clientOf(ctx)
    return { client: pick(c, CLIENT_FIELDS), account: { email: acc.email, created_at: acc.created_at } }
  },

  'perfil:salvar': (ctx, b) => {
    const { c } = clientOf(ctx)
    const name = str(b.name, 120)
    if (name.length < 3) fail('Informe seu nome completo.')
    if (b.cpf && digits(b.cpf).length !== 11) fail('CPF inválido.')
    const addrKeys = ['cep', 'street', 'number', 'neighborhood', 'city', 'state']
    const addrChanged = addrKeys.some((k) => str(b[k], 160) !== str(c[k], 160))
    const v = (k, n = 160) => str(b[k], n)
    db.run(`UPDATE clients SET name=?, cpf=?, phone=?, whatsapp=?, birth_date=?, cep=?, street=?, number=?, complement=?, neighborhood=?, city=?, state=?,
      reference=?, pref_time=?, contact_pref=?, notify_ok=? ${addrChanged ? ', lat=NULL, lng=NULL, geo_status=NULL' : ''} WHERE id=?`,
    [name, v('cpf', 20), v('phone', 30), v('whatsapp', 30), v('birth_date', 10), v('cep', 10), v('street'), v('number', 20), v('complement'), v('neighborhood'), v('city'), v('state', 2).toUpperCase(),
      v('reference'), v('pref_time', 30), v('contact_pref', 30), b.notify_ok ? 1 : 0, c.id])
    audit('Cliente atualizou o cadastro pelo app', 'Cliente', name, null, `Cliente: ${name} (app)`)
    return client.me(ctx)
  },

  'senha:alterar': (ctx, b) => {
    const { acc } = clientOf(ctx)
    if (!auth.verifyPassword(b.old, acc.salt, acc.password_hash)) fail('A senha atual está incorreta.')
    const problem = auth.passwordProblem(b.new)
    if (problem) fail(problem)
    const { salt, hash } = auth.hashPassword(b.new)
    db.run('UPDATE client_accounts SET password_hash=?, salt=? WHERE id=?', [hash, salt, acc.id])
    db.run('DELETE FROM api_sessions WHERE kind=? AND subject_id=? AND token_hash<>?', ['client', acc.id, sha(ctx.token)])
    return true
  },

  cep: (ctx, b) => cep(b.cep),

  pets: (ctx) => {
    const { c } = clientOf(ctx)
    const pets = db.all('SELECT * FROM pets WHERE client_id=? ORDER BY name', [c.id])
    const vacs = db.all(`SELECT v.pet_id, v.name, v.next_dose FROM vaccines v JOIN pets p ON p.id=v.pet_id WHERE p.client_id=? AND v.next_dose IS NOT NULL AND v.next_dose<>''
      AND NOT EXISTS (SELECT 1 FROM vaccines x WHERE x.pet_id=v.pet_id AND lower(x.name)=lower(v.name) AND (COALESCE(x.applied_at,'')>COALESCE(v.applied_at,'') OR (COALESCE(x.applied_at,'')=COALESCE(v.applied_at,'') AND x.id>v.id)))`, [c.id])
    const next = db.all("SELECT pet_id, MIN(date || ' ' || start_time) AS next_at FROM appointments WHERE client_id=? AND status NOT IN ('Cancelado','Entregue') AND date>=? GROUP BY pet_id", [c.id, sched.todayISO()])
    return pets.map((p) => ({
      ...pick(p, ['id', ...PET_FIELDS]),
      vaccines_due: vacs.filter((v) => v.pet_id === p.id).map((v) => ({ name: v.name, next_dose: v.next_dose })),
      next_appointment: next.find((n) => n.pet_id === p.id)?.next_at || null,
    }))
  },

  'pet:detalhe': (ctx, b) => {
    const { c } = clientOf(ctx)
    const p = ownPet(c.id, b.id)
    return {
      pet: pick(p, ['id', ...PET_FIELDS]),
      vaccines: db.all('SELECT id, name, applied_at, next_dose, vet FROM vaccines WHERE pet_id=? ORDER BY COALESCE(applied_at,next_dose) DESC', [p.id]),
      weights: db.all('SELECT date, weight FROM weights WHERE pet_id=? ORDER BY date', [p.id]),
      history: clientAppointments(c.id, 'AND a.pet_id=?', [p.id]).reverse().slice(0, 30),
    }
  },

  'pet:salvar': (ctx, b) => {
    const { c } = clientOf(ctx)
    const name = str(b.name, 60)
    if (!name) fail('Informe o nome do pet.')
    const weight = b.weight === '' || b.weight === null || b.weight === undefined ? null : Number(String(b.weight).replace(',', '.'))
    if (weight !== null && (isNaN(weight) || weight <= 0 || weight > 150)) fail('Peso inválido.')
    if (b.photo && String(b.photo).length > 900000) fail('A foto é muito grande.')
    const vals = PET_FIELDS.map((k) => (k === 'weight' ? weight : k === 'photo' ? b.photo || null : k === 'name' ? name : str(b[k], 400)))
    let id = b.id
    if (id) {
      ownPet(c.id, id)
      db.run(`UPDATE pets SET ${PET_FIELDS.map((k) => `${k}=?`).join(',')} WHERE id=? AND client_id=?`, [...vals, id, c.id])
    } else {
      id = db.run(`INSERT INTO pets (client_id, ${PET_FIELDS.join(',')}) VALUES (?, ${PET_FIELDS.map(() => '?').join(',')})`, [c.id, ...vals]).lastInsertRowid
      staffNotify('agenda', 'Novo pet cadastrado pelo app', `${c.name} cadastrou ${name}.`, 'pets')
    }
    if (weight !== null) {
      const today = sched.todayISO()
      const last = db.get('SELECT weight FROM weights WHERE pet_id=? ORDER BY date DESC, id DESC LIMIT 1', [id])
      if (!last || Number(last.weight) !== weight) db.run('INSERT INTO weights (pet_id, date, weight) VALUES (?,?,?)', [id, today, weight])
    }
    audit(b.id ? 'Cliente editou pet pelo app' : 'Cliente cadastrou pet pelo app', 'Pet', name, null, `Cliente: ${c.name} (app)`)
    return { id }
  },

  /** Próximos dias com horários livres (para o calendário do app). */
  dias: (ctx, b) => {
    const { c } = clientOf(ctx)
    const rules = shopRules()
    if (!rules.bookingEnabled) return []
    const service = bookableService(b.service_id)
    ownPet(c.id, b.pet_id)
    const out = []
    const today = sched.todayISO()
    for (let i = 0; i <= rules.maxDaysAhead; i++) {
      const date = sched.addDays(today, i)
      out.push({ date, free: daySlots({ date, service, petId: Number(b.pet_id), rules }).length })
    }
    return out
  },

  horarios: (ctx, b) => {
    const { c } = clientOf(ctx)
    const rules = shopRules()
    if (!rules.bookingEnabled) fail('O agendamento pelo app está desativado no momento. Ligue para o pet shop.')
    checkDateWindow(b.date, rules)
    const service = bookableService(b.service_id)
    ownPet(c.id, b.pet_id)
    return daySlots({ date: b.date, service, petId: Number(b.pet_id), rules })
  },

  agendar: (ctx, b) => {
    const { c } = clientOf(ctx)
    const rules = shopRules()
    if (!rules.bookingEnabled) fail('O agendamento pelo app está desativado no momento. Ligue para o pet shop.')
    checkDateWindow(b.date, rules)
    const service = bookableService(b.service_id)
    const pet = ownPet(c.id, b.pet_id)
    if (!/^\d{2}:\d{2}$/.test(String(b.start_time))) fail('Horário inválido.')
    // Revalida na hora de gravar: outro cliente (ou a recepção) pode ter ocupado o horário.
    const free = daySlots({ date: b.date, service, petId: pet.id, rules })
    if (!free.includes(b.start_time)) fail('Este horário acabou de ser ocupado. Escolha outro.', 409)
    if ((b.pickup || b.delivery) && !c.street) fail('Cadastre seu endereço no perfil para pedir busca ou entrega.')
    const r = db.run(`INSERT INTO appointments (client_id, pet_id, service_id, service_name, category, date, start_time, duration_min, status, price, notes, pickup, delivery, origin, updated_at)
      VALUES (?,?,?,?,?,?,?,?, 'Agendado', ?,?,?,?, 'app', ?)`,
    [c.id, pet.id, service.id, service.name, service.category, b.date, b.start_time, service.duration_min, service.price, str(b.notes, 500), b.pickup ? 1 : 0, b.delivery ? 1 : 0, nowStamp()])
    const [y, m, d] = b.date.split('-')
    staffNotify('agenda', `Novo agendamento pelo app: ${pet.name}`, `${c.name} marcou ${service.name} em ${d}/${m}/${y} às ${b.start_time}. Confirme o horário.`, 'appointments')
    audit('Cliente agendou pelo app', 'Agendamento', `${pet.name}: ${service.name} ${d}/${m} ${b.start_time}`, null, `Cliente: ${c.name} (app)`)
    db.run('INSERT INTO client_notifications (client_id, type, title, body, appointment_id) VALUES (?,?,?,?,?)',
      [c.id, 'agendado', `Pedido enviado: ${pet.name}`, `${service.name} em ${d}/${m} às ${b.start_time}. Avisaremos quando o pet shop confirmar.`, r.lastInsertRowid])
    return { id: r.lastInsertRowid }
  },

  agendamentos: (ctx) => {
    const { c } = clientOf(ctx)
    const rules = shopRules()
    const now = new Date()
    return clientAppointments(c.id).map((a) => {
      const start = new Date(`${a.date}T${a.start_time}:00`)
      const can_cancel = ['Agendado', 'Confirmado'].includes(a.status) && start.getTime() - now.getTime() >= rules.cancelHours * 3600000
      return { ...a, can_cancel }
    })
  },

  'agendamento:cancelar': (ctx, b) => {
    const { c } = clientOf(ctx)
    const rules = shopRules()
    const a = db.get('SELECT a.*, p.name AS pet_name FROM appointments a JOIN pets p ON p.id=a.pet_id WHERE a.id=? AND a.client_id=?', [b.id, c.id])
    if (!a) fail('Agendamento não encontrado.', 404)
    if (!['Agendado', 'Confirmado'].includes(a.status)) fail('Este atendimento não pode mais ser cancelado pelo app. Fale com o pet shop.')
    const start = new Date(`${a.date}T${a.start_time}:00`)
    if (start.getTime() - Date.now() < rules.cancelHours * 3600000) fail(`Cancelamentos pelo app precisam de ${rules.cancelHours}h de antecedência. Ligue para o pet shop.`)
    const reason = 'Cancelado pelo cliente' + (str(b.reason, 200) ? `: ${str(b.reason, 200)}` : '')
    db.run("UPDATE appointments SET status='Cancelado', cancel_reason=?, updated_at=? WHERE id=?", [reason, nowStamp(), a.id])
    const [, m, d] = a.date.split('-')
    staffNotify('cancelamento', `Cancelado pelo cliente: ${a.pet_name}`, `${c.name} cancelou ${a.service_name} de ${d}/${m} às ${a.start_time}.`, 'appointments')
    audit('Cliente cancelou pelo app', 'Agendamento', `${a.pet_name}: ${a.service_name} ${d}/${m}`, null, `Cliente: ${c.name} (app)`)
    return true
  },

  adocao: (ctx) => {
    const { c } = clientOf(ctx)
    const mine = new Set(db.all('SELECT animal_id FROM adoption_interested WHERE client_id=?', [c.id]).map((r) => r.animal_id))
    return db.all(`SELECT id, name, photo, approx_age, sex, breed, size, rescue_story, health, vaccines, neutered, temperament, description, status
      FROM adoption_animals WHERE status IN ('Disponível para adoção','Em processo de adoção') ORDER BY status, entered_at DESC`)
      .map((a) => ({ ...a, interested: mine.has(a.id) }))
  },

  'adocao:interesse': (ctx, b) => {
    const { c } = clientOf(ctx)
    const a = db.get("SELECT id, name FROM adoption_animals WHERE id=? AND status IN ('Disponível para adoção','Em processo de adoção')", [b.animal_id])
    if (!a) fail('Este animal não está mais disponível.')
    if (db.get('SELECT id FROM adoption_interested WHERE client_id=? AND animal_id=?', [c.id, a.id])) fail('Você já demonstrou interesse por este animal. Entraremos em contato!')
    const address = [c.street, c.number, c.neighborhood, c.city].filter(Boolean).join(', ')
    db.run("INSERT INTO adoption_interested (animal_id, name, phone, address, notes, client_id, origin) VALUES (?,?,?,?,?,?,'app')",
      [a.id, c.name, c.whatsapp || c.phone, address, str(b.notes, 600), c.id])
    staffNotify('agenda', `Interesse em adoção: ${a.name}`, `${c.name} quer conhecer ${a.name} (pelo app).`, 'adoption')
    return true
  },

  avisos: (ctx) => {
    const { c } = clientOf(ctx)
    return db.all('SELECT id, type, title, body, appointment_id, read, created_at FROM client_notifications WHERE client_id=? ORDER BY id DESC LIMIT 60', [c.id])
  },
  'avisos:lidos': (ctx) => {
    const { c } = clientOf(ctx)
    db.run('UPDATE client_notifications SET read=1 WHERE client_id=? AND read=0', [c.id])
    return true
  },
}

module.exports = {
  db, seed, staff, client, clientPublic, audit, publicUser, sessionUser,
  createSession, resolveSession, dropSession,
  staffPublic: new Set(['auth:login', 'auth:register', 'auth:session', 'auth:logout']),
}
