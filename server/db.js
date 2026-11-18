// Banco SQLite (sql.js = SQLite compilado para WebAssembly, sem módulos nativos).
// Os dados ficam em um único arquivo .sqlite e persistem entre execuções.
// O mesmo módulo é usado pelo app desktop (Electron) e pelo servidor standalone (server/index.js).
const fs = require('fs')
const path = require('path')
const initSqlJs = require('sql.js')

let SQL = null
let db = null
let file = ''
let saveTimer = null

const SCHEMA = `
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  email TEXT, phone TEXT, birth_date TEXT,
  role TEXT NOT NULL DEFAULT 'employee',
  job_title TEXT, photo TEXT, permissions TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  must_change_password INTEGER NOT NULL DEFAULT 0,
  demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE TABLE clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, cpf TEXT, phone TEXT, whatsapp TEXT, email TEXT, birth_date TEXT,
  cep TEXT, street TEXT, number TEXT, complement TEXT, neighborhood TEXT, city TEXT, state TEXT, reference TEXT,
  lat REAL, lng REAL, geo_status TEXT,
  pref_time TEXT, pref_service TEXT, contact_pref TEXT, notify_ok INTEGER NOT NULL DEFAULT 1, notes TEXT,
  demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE TABLE pets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL, species TEXT DEFAULT 'Cachorro', breed TEXT, sex TEXT, birth_date TEXT,
  weight REAL, size TEXT, color TEXT, microchip TEXT, photo TEXT,
  temperament TEXT, with_dogs TEXT, with_people TEXT, fears TEXT, allergies TEXT, restrictions TEXT, notes TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE TABLE vaccines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pet_id INTEGER NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  name TEXT NOT NULL, applied_at TEXT, next_dose TEXT, vet TEXT, notes TEXT
);
CREATE TABLE weights (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pet_id INTEGER NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  date TEXT NOT NULL, weight REAL NOT NULL
);
CREATE TABLE services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, category TEXT DEFAULT 'Outro',
  duration_min INTEGER NOT NULL DEFAULT 30, price REAL NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1, sort INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE appointments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  pet_id INTEGER NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  service_id INTEGER REFERENCES services(id) ON DELETE SET NULL,
  service_name TEXT, category TEXT,
  employee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  date TEXT NOT NULL, start_time TEXT NOT NULL, duration_min INTEGER NOT NULL DEFAULT 30,
  status TEXT NOT NULL DEFAULT 'Agendado',
  price REAL DEFAULT 0, notes TEXT, staff_notes TEXT,
  pickup INTEGER NOT NULL DEFAULT 0, delivery INTEGER NOT NULL DEFAULT 0, override INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER, created_at TEXT DEFAULT (datetime('now','localtime')), updated_at TEXT
);
CREATE INDEX idx_appt_date ON appointments(date);
CREATE INDEX idx_appt_pet ON appointments(pet_id);
CREATE TABLE schedule_exceptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL, start_time TEXT NOT NULL, end_time TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'block', reason TEXT, created_by INTEGER
);
CREATE TABLE adoption_animals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, photo TEXT, approx_age TEXT, sex TEXT, breed TEXT, size TEXT,
  rescue_story TEXT, health TEXT, vaccines TEXT, neutered TEXT, temperament TEXT, description TEXT,
  entered_at TEXT DEFAULT (date('now','localtime')), status TEXT NOT NULL DEFAULT 'Disponível para adoção',
  demo INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE adoption_interested (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  animal_id INTEGER REFERENCES adoption_animals(id) ON DELETE SET NULL,
  name TEXT NOT NULL, phone TEXT, address TEXT, notes TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime')), demo INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT, title TEXT NOT NULL, body TEXT, link_page TEXT,
  notif_key TEXT UNIQUE, read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER, user_name TEXT, action TEXT, entity TEXT, detail TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);
`

/*
 * Versão 2 — acesso de clientes e apps móveis.
 *  - client_accounts: login do cliente no app (ligado a um cadastro em clients)
 *  - api_sessions: tokens de acesso dos apps (equipe e clientes), guardados só como hash
 *  - client_notifications: caixa de avisos de cada cliente (preenchida por gatilhos do banco)
 *  - colunas novas: origem do agendamento/cadastro, descrição e visibilidade dos serviços no app, etc.
 */
const MIGRATION_2 = `
ALTER TABLE services ADD COLUMN description TEXT;
ALTER TABLE services ADD COLUMN client_visible INTEGER NOT NULL DEFAULT 1;
ALTER TABLE appointments ADD COLUMN origin TEXT NOT NULL DEFAULT 'loja';
ALTER TABLE appointments ADD COLUMN cancel_reason TEXT;
ALTER TABLE clients ADD COLUMN origin TEXT NOT NULL DEFAULT 'loja';
ALTER TABLE clients ADD COLUMN app_invite_code TEXT;
ALTER TABLE clients ADD COLUMN app_invite_expires TEXT;
ALTER TABLE adoption_interested ADD COLUMN client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE adoption_interested ADD COLUMN origin TEXT NOT NULL DEFAULT 'loja';

CREATE TABLE client_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL UNIQUE REFERENCES clients(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  last_login TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE TABLE api_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN ('staff','client')),
  subject_id INTEGER NOT NULL,
  device TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime')),
  last_seen TEXT DEFAULT (datetime('now','localtime'))
);
CREATE INDEX idx_sessions_subject ON api_sessions(kind, subject_id);
CREATE TABLE client_notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'info',
  title TEXT NOT NULL, body TEXT,
  appointment_id INTEGER REFERENCES appointments(id) ON DELETE CASCADE,
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE INDEX idx_cnotif_client ON client_notifications(client_id, read);
CREATE INDEX idx_appt_client ON appointments(client_id, date);
CREATE INDEX idx_pets_client ON pets(client_id);
CREATE INDEX idx_vaccines_pet ON vaccines(pet_id);
CREATE INDEX idx_clients_invite ON clients(app_invite_code);

-- Avisos automáticos para o cliente (só para quem tem conta no app).
CREATE TRIGGER trg_client_appt_status AFTER UPDATE OF status ON appointments
WHEN NEW.status <> OLD.status
  AND EXISTS (SELECT 1 FROM client_accounts ca WHERE ca.client_id = NEW.client_id AND ca.active = 1)
  AND NOT (NEW.status = 'Cancelado' AND COALESCE(NEW.cancel_reason,'') LIKE 'Cancelado pelo cliente%')
BEGIN
  INSERT INTO client_notifications (client_id, type, title, body, appointment_id)
  SELECT NEW.client_id, 'status',
    p.name || ': ' || NEW.status,
    CASE NEW.status
      WHEN 'Confirmado' THEN 'Seu agendamento de ' || COALESCE(NEW.service_name,'serviço') || ' em ' || strftime('%d/%m', NEW.date) || ' às ' || NEW.start_time || ' foi confirmado.'
      WHEN 'Aguardando chegada' THEN 'Estamos esperando ' || p.name || ' para ' || COALESCE(NEW.service_name,'o atendimento') || '.'
      WHEN 'Em atendimento' THEN p.name || ' já está sendo atendido(a).'
      WHEN 'Finalizado' THEN 'O atendimento de ' || p.name || ' terminou.'
      WHEN 'Aguardando retirada' THEN p.name || ' está pronto(a) para retirada' || CASE WHEN NEW.delivery = 1 THEN ' (vamos levar até você).' ELSE '.' END
      WHEN 'Entregue' THEN 'Obrigado pela confiança! ' || p.name || ' foi entregue.'
      WHEN 'Cancelado' THEN 'O agendamento de ' || COALESCE(NEW.service_name,'serviço') || ' em ' || strftime('%d/%m', NEW.date) || ' foi cancelado pelo pet shop.'
      ELSE 'Situação atualizada para ' || NEW.status || '.'
    END,
    NEW.id
  FROM pets p WHERE p.id = NEW.pet_id;
END;

CREATE TRIGGER trg_client_appt_moved AFTER UPDATE OF date, start_time ON appointments
WHEN (NEW.date <> OLD.date OR NEW.start_time <> OLD.start_time) AND NEW.status <> 'Cancelado'
  AND EXISTS (SELECT 1 FROM client_accounts ca WHERE ca.client_id = NEW.client_id AND ca.active = 1)
BEGIN
  INSERT INTO client_notifications (client_id, type, title, body, appointment_id)
  SELECT NEW.client_id, 'remarcado', p.name || ': agendamento remarcado',
    COALESCE(NEW.service_name,'Serviço') || ' agora em ' || strftime('%d/%m', NEW.date) || ' às ' || NEW.start_time || '.', NEW.id
  FROM pets p WHERE p.id = NEW.pet_id;
END;

CREATE TRIGGER trg_client_appt_new AFTER INSERT ON appointments
WHEN NEW.origin <> 'app'
  AND EXISTS (SELECT 1 FROM client_accounts ca WHERE ca.client_id = NEW.client_id AND ca.active = 1)
BEGIN
  INSERT INTO client_notifications (client_id, type, title, body, appointment_id)
  SELECT NEW.client_id, 'agendado', 'Novo agendamento para ' || p.name,
    COALESCE(NEW.service_name,'Serviço') || ' em ' || strftime('%d/%m', NEW.date) || ' às ' || NEW.start_time || '.', NEW.id
  FROM pets p WHERE p.id = NEW.pet_id;
END;

UPDATE services SET description = 'Banho com shampoo e condicionador, secagem, escovação, limpeza de ouvidos e perfume.' WHERE name = 'Banho completo' AND description IS NULL;
UPDATE services SET description = 'Banho com shampoo neutro, secagem e escovação.' WHERE name = 'Banho simples' AND description IS NULL;
UPDATE services SET description = 'Banho completo + tosa no padrão da raça ou no estilo que você preferir.' WHERE name = 'Tosa completa' AND description IS NULL;
UPDATE services SET description = 'Aparo das regiões íntimas, barriga e patinhas.' WHERE name = 'Tosa higiênica' AND description IS NULL;
UPDATE services SET description = 'Tosa uniforme na máquina, na altura combinada.' WHERE name = 'Tosa na máquina' AND description IS NULL;
UPDATE services SET description = 'Acabamento feito à mão, ideal para raças de pelo longo.' WHERE name = 'Tosa na tesoura' AND description IS NULL;
UPDATE services SET description = 'Corte e lixamento das unhas.' WHERE name = 'Corte de unhas' AND description IS NULL;
UPDATE services SET description = 'Higienização dos ouvidos com produto próprio.' WHERE name = 'Limpeza de ouvidos' AND description IS NULL;
UPDATE services SET description = 'Máscara hidratante para pelos ressecados ou embaraçados.' WHERE name = 'Hidratação' AND description IS NULL;

INSERT OR IGNORE INTO settings (key, value) VALUES
  ('client_booking_enabled', '1'),
  ('client_min_notice_hours', '2'),
  ('client_max_days_ahead', '30'),
  ('client_cancel_hours', '2'),
  ('client_signup_open', '1'),
  ('client_welcome', 'Agende banho, tosa e cuidados do seu pet sem precisar ligar.'),
  ('server_enabled', '1'),
  ('server_port', '3737');
`

const MIGRATIONS = [null, SCHEMA, MIGRATION_2]
const LATEST = MIGRATIONS.length - 1

const clean = (params = []) =>
  params.map((v) => (v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v))

function enableFk() {
  db.run('PRAGMA foreign_keys = ON')
}

async function open(dir) {
  SQL = await initSqlJs({ wasmBinary: fs.readFileSync(require.resolve('sql.js/dist/sql-wasm.wasm')) })
  fs.mkdirSync(dir, { recursive: true })
  file = path.join(dir, 'caramelo-molhado.sqlite')
  const exists = fs.existsSync(file)
  db = exists ? new SQL.Database(fs.readFileSync(file)) : new SQL.Database()
  enableFk()
  const v = scalar('PRAGMA user_version')
  migrate(v)
  return { file, isNew: !exists || v < 1 }
}

// Aplica as migrações pendentes dentro de uma transação (bancos antigos são atualizados sem perder dados).
function migrate(from) {
  if (from >= LATEST) return
  for (let n = from + 1; n <= LATEST; n++) {
    db.run('BEGIN')
    try {
      db.exec(MIGRATIONS[n])
      db.run(`PRAGMA user_version = ${n}`)
      db.run('COMMIT')
    } catch (e) {
      try { db.run('ROLLBACK') } catch {}
      throw new Error(`Falha ao atualizar o banco para a versão ${n}: ${e.message}`)
    }
  }
  saveNow()
}

function scalar(sql, params = []) {
  const st = db.prepare(sql)
  try {
    st.bind(clean(params))
    return st.step() ? Object.values(st.getAsObject())[0] : null
  } finally {
    st.free()
  }
}

function all(sql, params = []) {
  const st = db.prepare(sql)
  try {
    st.bind(clean(params))
    const rows = []
    while (st.step()) rows.push(st.getAsObject())
    return rows
  } finally {
    st.free()
  }
}

function get(sql, params = []) {
  return all(sql, params)[0] || null
}

function run(sql, params = []) {
  db.run(sql, clean(params))
  const changes = db.getRowsModified()
  const lastInsertRowid = scalar('SELECT last_insert_rowid()')
  scheduleSave()
  return { changes, lastInsertRowid }
}

function batch(statements) {
  db.run('BEGIN')
  try {
    const out = statements.map((s) => {
      db.run(s.sql, clean(s.params))
      return { changes: db.getRowsModified(), lastInsertRowid: scalar('SELECT last_insert_rowid()') }
    })
    db.run('COMMIT')
    scheduleSave()
    return out
  } catch (e) {
    try { db.run('ROLLBACK') } catch {}
    throw e
  }
}

function scheduleSave() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(saveNow, 350)
}

// Escrita atômica: grava em arquivo temporário e renomeia (evita corromper o banco se o app fechar no meio).
function saveNow() {
  clearTimeout(saveTimer)
  saveTimer = null
  if (!db) return
  const data = Buffer.from(db.export())
  enableFk() // db.export() reinicia os PRAGMAs
  const tmp = file + '.tmp'
  fs.writeFileSync(tmp, data)
  fs.renameSync(tmp, file)
}

function exportBytes() {
  saveNow()
  return fs.readFileSync(file)
}

// Troca o banco atual por um arquivo de backup, depois de validar que é um banco do sistema.
function replaceWith(buffer) {
  const test = new SQL.Database(buffer)
  try {
    const st = test.prepare("SELECT name FROM sqlite_master WHERE type='table'")
    const names = []
    while (st.step()) names.push(st.getAsObject().name)
    st.free()
    for (const t of ['users', 'clients', 'pets', 'appointments', 'settings']) {
      if (!names.includes(t)) throw new Error('Este arquivo não é um backup válido do Caramelo Molhado.')
    }
  } finally {
    test.close()
  }
  db.close()
  db = new SQL.Database(buffer)
  enableFk()
  migrate(scalar('PRAGMA user_version')) // backups antigos (v1) são atualizados na hora
  saveNow()
}

module.exports = { LATEST, open, all, get, run, batch, scalar, saveNow, exportBytes, replaceWith, file: () => file }
