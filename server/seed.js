const db = require('./db')
const { hashPassword } = require('./auth')

const EMPLOYEE_PERMS = { clients_edit: true, pets_edit: true, appointments_edit: true, map_view: true }

const pad = (n) => String(n).padStart(2, '0')
const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const day = (n) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return fmt(d)
}

function cpf(base) {
  const nums = String(base).padStart(9, '0').split('').map(Number)
  const dv = (arr) => {
    const sum = arr.reduce((s, v, i) => s + v * (arr.length + 1 - i), 0)
    const r = (sum * 10) % 11
    return r === 10 ? 0 : r
  }
  const d1 = dv(nums)
  const d2 = dv([...nums, d1])
  const s = [...nums, d1, d2].join('')
  return `${s.slice(0, 3)}.${s.slice(3, 6)}.${s.slice(6, 9)}-${s.slice(9)}`
}

function setSetting(key, value) {
  db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, typeof value === 'string' ? value : JSON.stringify(value)])
}

// Cria o que o sistema precisa para funcionar (sempre, na primeira execução).
function seedDefaults() {
  const hours = {}
  for (let d = 0; d <= 6; d++) hours[d] = { open: d >= 1 && d <= 6, start: '08:00', end: '18:00' }
  setSetting('shop_name', 'Caramelo Molhado Pet Shop Inc.')
  setSetting('shop_phone', '')
  setSetting('shop_address', '')
  setSetting('hours', hours)
  setSetting('slot_interval', '30')
  setSetting('capacity', '1')
  setSetting('vaccine_alert_days', '30')

  const services = [
    ['Banho completo', 'Banho', 60, 70, 'Banho com shampoo e condicionador, secagem, escovação, limpeza de ouvidos e perfume.'],
    ['Banho simples', 'Banho', 30, 45, 'Banho com shampoo neutro, secagem e escovação.'],
    ['Tosa completa', 'Tosa', 90, 90, 'Banho completo + tosa no padrão da raça ou no estilo que você preferir.'],
    ['Tosa higiênica', 'Tosa', 30, 35, 'Aparo das regiões íntimas, barriga e patinhas.'],
    ['Tosa na máquina', 'Tosa', 60, 65, 'Tosa uniforme na máquina, na altura combinada.'],
    ['Tosa na tesoura', 'Tosa', 90, 100, 'Acabamento feito à mão, ideal para raças de pelo longo.'],
    ['Corte de unhas', 'Cuidados', 30, 20, 'Corte e lixamento das unhas.'],
    ['Limpeza de ouvidos', 'Cuidados', 30, 25, 'Higienização dos ouvidos com produto próprio.'],
    ['Hidratação', 'Cuidados', 30, 40, 'Máscara hidratante para pelos ressecados ou embaraçados.'],
  ]
  services.forEach(([name, cat, dur, price, description], i) =>
    db.run('INSERT INTO services (name, category, duration_min, price, sort, description) VALUES (?,?,?,?,?,?)', [name, cat, dur, price, i, description]),
  )

  const { salt, hash } = hashPassword('admin123')
  db.run(
    `INSERT INTO users (name, username, password_hash, salt, role, job_title, must_change_password, permissions)
     VALUES (?,?,?,?,?,?,?,?)`,
    ['Administrador', 'admin', hash, salt, 'admin', 'Administrador', 1, '{}'],
  )
}

function addUser(name, username, pw, title, birth, email, phone) {
  const { salt, hash } = hashPassword(pw)
  return db.run(
    `INSERT INTO users (name, username, password_hash, salt, role, job_title, birth_date, email, phone, permissions, demo)
     VALUES (?,?,?,?,?,?,?,?,?,?,1)`,
    [name, username, hash, salt, 'employee', title, birth, email, phone, JSON.stringify(EMPLOYEE_PERMS)],
  ).lastInsertRowid
}

// Dados demonstrativos: tudo marcado com demo=1 (ou ligado a um cliente demo) para poder ser removido em um clique.
function seedDemo() {
  const maria = addUser('Maria Souza', 'maria', 'maria123', 'Tosadora', '1992-04-18', 'maria@caramelomolhado.demo', '(11) 98888-1111')
  const joao = addUser('João Pereira', 'joao', 'joao123', 'Banhista', '1996-09-02', 'joao@caramelomolhado.demo', '(11) 97777-2222')

  const addClient = (c) =>
    db.run(
      `INSERT INTO clients (name,cpf,phone,whatsapp,email,birth_date,cep,street,number,complement,neighborhood,city,state,reference,lat,lng,geo_status,
        pref_time,pref_service,contact_pref,notify_ok,notes,demo) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)`,
      [c.name, c.cpf, c.phone, c.phone, c.email, c.birth, c.cep, c.street, c.number, c.complement || '', c.neighborhood, 'São Paulo', 'SP', c.reference || '',
        c.lat, c.lng, 'ok', c.pref_time || 'Manhã', c.pref_service || '', c.contact || 'WhatsApp', 1, c.notes || ''],
    ).lastInsertRowid

  const clients = {
    carlos: addClient({ name: 'Carlos Eduardo Lima', cpf: cpf(123456789), phone: '(11) 99111-2001', email: 'carlos.lima@email.demo', birth: '1985-03-12', cep: '04101-300', street: 'Rua Vergueiro', number: '2450', neighborhood: 'Vila Mariana', reference: 'Próximo ao metrô Ana Rosa', lat: -23.5889, lng: -46.6371, pref_service: 'Leva e traz' }),
    ana: addClient({ name: 'Ana Paula Ribeiro', cpf: cpf(234567891), phone: '(11) 99222-3002', email: 'ana.ribeiro@email.demo', birth: '1990-07-25', cep: '05422-001', street: 'Rua dos Pinheiros', number: '870', complement: 'Apto 52', neighborhood: 'Pinheiros', lat: -23.5651, lng: -46.6865, pref_time: 'Tarde' }),
    beatriz: addClient({ name: 'Beatriz Nogueira', cpf: cpf(345678912), phone: '(11) 99333-4003', email: 'bia.nogueira@email.demo', birth: '1988-11-05', cep: '04077-000', street: 'Av. Ibirapuera', number: '3103', neighborhood: 'Moema', reference: 'Em frente ao shopping', lat: -23.6048, lng: -46.6663, notes: 'Prefere ser avisada quando o pet estiver pronto.' }),
    diego: addClient({ name: 'Diego Fernandes', cpf: cpf(456789123), phone: '(11) 99444-5004', email: 'diego.f@email.demo', birth: '1979-01-30', cep: '03312-000', street: 'Rua Tuiuti', number: '1120', neighborhood: 'Tatuapé', lat: -23.5403, lng: -46.5741, pref_service: 'Leva e traz' }),
    fernanda: addClient({ name: 'Fernanda Castro', cpf: cpf(567891234), phone: '(11) 99555-6005', email: 'fe.castro@email.demo', birth: '1994-06-14', cep: '05012-000', street: 'Rua Cardoso de Almeida', number: '640', neighborhood: 'Perdizes', lat: -23.5362, lng: -46.6772, pref_time: 'Tarde' }),
    gabriel: addClient({ name: 'Gabriel Moreira', cpf: cpf(678912345), phone: '(11) 99666-7006', email: 'gabriel.m@email.demo', birth: '1998-12-22', cep: '02012-000', street: 'Av. Cruzeiro do Sul', number: '1800', neighborhood: 'Santana', lat: -23.5081, lng: -46.6264, contact: 'Ligação' }),
    helena: addClient({ name: 'Helena Martins', cpf: cpf(789123456), phone: '(11) 99777-8007', email: 'helena.martins@email.demo', birth: '1983-09-09', cep: '04210-000', street: 'Rua Silva Bueno', number: '980', neighborhood: 'Ipiranga', lat: -23.5887, lng: -46.6089 }),
  }

  const addPet = (clientKey, p) =>
    db.run(
      `INSERT INTO pets (client_id,name,species,breed,sex,birth_date,weight,size,color,microchip,temperament,with_dogs,with_people,fears,allergies,restrictions,notes)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [clients[clientKey], p.name, 'Cachorro', p.breed, p.sex, p.birth, p.weight, p.size, p.color, p.chip || '', p.temper, p.dogs || 'Sociável', p.people || 'Sociável',
        p.fears || '', p.allergies || '', p.restrictions || '', p.notes || ''],
    ).lastInsertRowid

  const pets = {
    thor: addPet('carlos', { name: 'Thor', breed: 'Vira-lata caramelo', sex: 'Macho', birth: '2020-05-10', weight: 28.4, size: 'Grande', color: 'Caramelo', chip: '985112003456789', temper: 'Brincalhão e muito carinhoso', notes: 'Adora água. Pode usar secador em potência alta.' }),
    mel: addPet('ana', { name: 'Mel', breed: 'Poodle', sex: 'Fêmea', birth: '2019-02-14', weight: 5.2, size: 'Pequeno', color: 'Branca', temper: 'Calma', fears: 'Barulho do secador', notes: 'Usar secador em potência baixa.' }),
    bolinha: addPet('ana', { name: 'Bolinha', breed: 'Shih-tzu', sex: 'Fêmea', birth: '2021-08-03', weight: 6.1, size: 'Pequeno', color: 'Branca e caramelo', temper: 'Agitada', dogs: 'Pode ficar agitada', allergies: 'Shampoo com fragrância forte' }),
    luna: addPet('beatriz', { name: 'Luna', breed: 'Golden Retriever', sex: 'Fêmea', birth: '2018-11-20', weight: 27.0, size: 'Grande', color: 'Dourada', chip: '985112009876543', temper: 'Dócil', notes: 'Sensível nas patas, cortar unhas com cuidado.' }),
    rex: addPet('diego', { name: 'Rex', breed: 'Pastor Alemão', sex: 'Macho', birth: '2017-06-01', weight: 32.5, size: 'Grande', color: 'Preto e fogo', temper: 'Reservado', dogs: 'Reativo com machos', people: 'Desconfiado no início', restrictions: 'Usar focinheira na tosa', fears: 'Tesoura' }),
    pipoca: addPet('fernanda', { name: 'Pipoca', breed: 'Lhasa Apso', sex: 'Fêmea', birth: '2022-01-17', weight: 7.0, size: 'Pequeno', color: 'Creme', temper: 'Brincalhona', notes: 'Tosa estilo bebê.' }),
    nina: addPet('gabriel', { name: 'Nina', breed: 'Spitz Alemão', sex: 'Fêmea', birth: '2023-03-08', weight: 3.2, size: 'Pequeno', color: 'Laranja', temper: 'Ativa', fears: 'Pessoas desconhecidas' }),
    biscoito: addPet('helena', { name: 'Biscoito', breed: 'Dachshund', sex: 'Macho', birth: '2016-10-12', weight: 8.4, size: 'Pequeno', color: 'Caramelo', temper: 'Tranquilo', restrictions: 'Evitar pegar no colo pela coluna' }),
  }

  const vax = (pet, name, applied, next, vet) =>
    db.run('INSERT INTO vaccines (pet_id,name,applied_at,next_dose,vet,notes) VALUES (?,?,?,?,?,?)', [pets[pet], name, applied, next, vet, ''])
  vax('thor', 'V10 (múltipla)', day(-335), day(30 - 0 + 0), 'Dra. Renata Alves')
  vax('thor', 'Antirrábica', day(-350), day(15), 'Dra. Renata Alves')
  vax('mel', 'V10 (múltipla)', day(-400), day(-35), 'Dr. Paulo Mendes')
  vax('mel', 'Antirrábica', day(-200), day(165), 'Dr. Paulo Mendes')
  vax('bolinha', 'V10 (múltipla)', day(-100), day(265), 'Dr. Paulo Mendes')
  vax('luna', 'Antirrábica', day(-358), day(7), 'Dra. Camila Rocha')
  vax('luna', 'Gripe canina', day(-180), day(185), 'Dra. Camila Rocha')
  vax('rex', 'V10 (múltipla)', day(-60), day(305), 'Dr. Eduardo Prado')
  vax('pipoca', 'Antirrábica', day(-90), day(275), 'Dra. Camila Rocha')
  vax('nina', 'V10 (múltipla)', day(-20), day(10), 'Dra. Renata Alves')
  vax('biscoito', 'Antirrábica', day(-420), day(-55), 'Dr. Eduardo Prado')

  const weight = (pet, offset, w) => db.run('INSERT INTO weights (pet_id,date,weight) VALUES (?,?,?)', [pets[pet], day(offset), w])
  weight('thor', -180, 27.1); weight('thor', -90, 27.9); weight('thor', -3, 28.4)
  weight('mel', -150, 5.0); weight('mel', -30, 5.2)
  weight('luna', -120, 26.4); weight('luna', -10, 27.0)
  weight('rex', -100, 32.0); weight('rex', -14, 32.5)

  const svc = {}
  for (const s of db.all('SELECT id,name,category,duration_min,price FROM services')) svc[s.name] = s
  const emp = { maria, joao }

  // [dia, hora, pet, cliente, serviço, status, funcionário, busca, entrega, obs do funcionário]
  const appts = [
    [0, '08:00', 'thor', 'carlos', 'Banho completo', 'Entregue', 'maria', 0, 0, 'Tudo certo, cliente retirou às 09:15.'],
    [0, '09:00', 'mel', 'ana', 'Tosa higiênica', 'Em atendimento', 'joao', 0, 0, ''],
    [0, '09:30', 'bolinha', 'ana', 'Banho simples', 'Aguardando retirada', 'maria', 0, 1, ''],
    [0, '10:00', 'luna', 'beatriz', 'Banho completo', 'Aguardando chegada', 'maria', 1, 0, ''],
    [0, '11:00', 'rex', 'diego', 'Tosa na máquina', 'Confirmado', 'joao', 1, 0, ''],
    [0, '14:00', 'pipoca', 'fernanda', 'Banho completo', 'Confirmado', 'maria', 1, 1, ''],
    [0, '15:30', 'nina', 'gabriel', 'Hidratação', 'Agendado', 'joao', 0, 0, ''],
    [1, '08:30', 'thor', 'carlos', 'Tosa completa', 'Confirmado', 'maria', 1, 1, ''],
    [1, '10:30', 'luna', 'beatriz', 'Corte de unhas', 'Agendado', 'joao', 0, 0, ''],
    [1, '14:00', 'rex', 'diego', 'Banho completo', 'Confirmado', 'joao', 1, 1, ''],
    [1, '16:00', 'biscoito', 'helena', 'Limpeza de ouvidos', 'Agendado', 'maria', 0, 0, ''],
    [2, '09:00', 'pipoca', 'fernanda', 'Tosa na tesoura', 'Confirmado', 'maria', 0, 0, ''],
    [2, '13:30', 'nina', 'gabriel', 'Banho completo', 'Agendado', 'joao', 0, 0, ''],
    [3, '08:00', 'bolinha', 'ana', 'Banho completo', 'Agendado', 'maria', 0, 0, ''],
    [3, '11:00', 'mel', 'ana', 'Hidratação', 'Agendado', 'joao', 0, 0, ''],
    [-3, '09:00', 'thor', 'carlos', 'Banho completo', 'Entregue', 'maria', 0, 0, 'Pelagem em ótimo estado.'],
    [-7, '10:00', 'mel', 'ana', 'Tosa higiênica', 'Entregue', 'joao', 0, 0, 'Ficou nervosa com o secador.'],
    [-9, '15:00', 'pipoca', 'fernanda', 'Banho simples', 'Entregue', 'maria', 0, 0, ''],
    [-10, '14:00', 'luna', 'beatriz', 'Banho completo', 'Entregue', 'maria', 0, 0, 'Nós nas orelhas, removidos.'],
    [-14, '09:00', 'rex', 'diego', 'Tosa na máquina', 'Entregue', 'joao', 0, 0, 'Usada focinheira conforme ficha.'],
    [-21, '11:00', 'biscoito', 'helena', 'Banho simples', 'Entregue', 'maria', 0, 0, ''],
  ]
  for (const [off, time, pet, cli, sname, status, who, pickup, delivery, staffNotes] of appts) {
    const s = svc[sname]
    db.run(
      `INSERT INTO appointments (client_id,pet_id,service_id,service_name,category,employee_id,date,start_time,duration_min,status,price,pickup,delivery,staff_notes)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [clients[cli], pets[pet], s.id, s.name, s.category, emp[who], day(off), time, s.duration_min, status, s.price, pickup, delivery, staffNotes],
    )
  }

  const adopt = (a) =>
    db.run(
      `INSERT INTO adoption_animals (name,approx_age,sex,breed,size,rescue_story,health,vaccines,neutered,temperament,description,entered_at,status,demo)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,1)`,
      [a.name, a.age, a.sex, a.breed, a.size, a.story, a.health, a.vaccines, a.neutered, a.temper, a.desc, day(a.entered), a.status],
    ).lastInsertRowid
  const pipo = adopt({ name: 'Pipo', age: '8 meses', sex: 'Macho', breed: 'Vira-lata caramelo', size: 'Médio', story: 'Encontrado ainda filhote em frente ao pet shop, sozinho numa noite de chuva.', health: 'Saudável', vaccines: 'V10 (1ª dose)', neutered: 'Ainda não', temper: 'Brincalhão e sociável', desc: 'Adora crianças e outros cães. Já aprendeu a fazer as necessidades no lugar certo.', entered: -12, status: 'Disponível para adoção' })
  adopt({ name: 'Estrela', age: '2 anos', sex: 'Fêmea', breed: 'Sem raça definida, preta', size: 'Médio', story: 'Resgatada de uma obra abandonada, estava com a cria.', health: 'Saudável', vaccines: 'Em dia', neutered: 'Sim', temper: 'Calma e carinhosa', desc: 'Ótima companhia para apartamento.', entered: -40, status: 'Em processo de adoção' })
  adopt({ name: 'Tobias', age: '5 anos', sex: 'Macho', breed: 'Beagle', size: 'Médio', story: 'Entregue pela família que se mudou.', health: 'Tratando dermatite', vaccines: 'Em dia', neutered: 'Sim', temper: 'Curioso', desc: 'Precisa de tutor paciente durante o tratamento da pele.', entered: -25, status: 'Em tratamento' })
  adopt({ name: 'Amora', age: '1 ano', sex: 'Fêmea', breed: 'Vira-lata', size: 'Pequeno', story: 'Nascida de uma ninhada resgatada.', health: 'Saudável', vaccines: 'Em dia', neutered: 'Sim', temper: 'Dócil', desc: 'Já foi adotada e mandou notícias de casa nova!', entered: -90, status: 'Adotado' })
  db.run('INSERT INTO adoption_interested (animal_id,name,phone,address,notes,demo) VALUES (?,?,?,?,?,1)', [pipo, 'Rafaela Duarte', '(11) 98123-4567', 'Rua Augusta, 1500 - Consolação', 'Tem quintal e já teve cães.'])
  db.run('INSERT INTO adoption_interested (animal_id,name,phone,address,notes,demo) VALUES (?,?,?,?,?,1)', [null, 'Marcos Ventura', '(11) 98234-5678', 'Rua Domingos de Morais, 700 - Vila Mariana', 'Procura um cão calmo.'])

  // Conta de demonstração no app do cliente (Carlos, tutor do Thor).
  const acc = hashPassword('Cliente@123')
  db.run('INSERT OR IGNORE INTO client_accounts (client_id, email, password_hash, salt) VALUES (?,?,?,?)', [clients.carlos, 'carlos.lima@email.demo', acc.hash, acc.salt])
  db.run('INSERT INTO client_notifications (client_id, type, title, body) VALUES (?,?,?,?)', [clients.carlos, 'info', 'Bem-vindo ao app!', 'Agora você acompanha os atendimentos do Thor pelo celular.'])

  setSetting('demo_loaded', '1')
}

// Remove tudo que foi criado como demonstração (clientes demo levam pets, vacinas e agendamentos junto, por cascata).
function removeDemo() {
  db.batch([
    { sql: 'DELETE FROM clients WHERE demo = 1' },
    { sql: 'DELETE FROM adoption_interested WHERE demo = 1' },
    { sql: 'DELETE FROM adoption_animals WHERE demo = 1' },
    { sql: 'DELETE FROM users WHERE demo = 1' },
    { sql: "DELETE FROM notifications" },
    { sql: "DELETE FROM api_sessions WHERE kind='client' AND subject_id NOT IN (SELECT id FROM client_accounts)" },
    { sql: "DELETE FROM api_sessions WHERE kind='staff' AND subject_id NOT IN (SELECT id FROM users)" },
    { sql: "INSERT OR REPLACE INTO settings (key,value) VALUES ('demo_loaded','0')" },
  ])
}

module.exports = { seedDefaults, seedDemo, removeDemo, setSetting }
