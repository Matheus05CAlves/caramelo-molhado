const { contextBridge, ipcRenderer } = require('electron')

async function call(channel, ...args) {
  const res = await ipcRenderer.invoke(channel, ...args)
  if (!res.ok) throw new Error(res.error)
  return res.data
}

contextBridge.exposeInMainWorld('api', {
  platform: 'desktop',
  db: {
    all: (sql, params = []) => call('db:all', sql, params),
    get: (sql, params = []) => call('db:get', sql, params),
    run: (sql, params = []) => call('db:run', sql, params),
    batch: (statements) => call('db:batch', statements),
  },
  audit: (action, entity, detail) => call('audit:log', action, entity, detail),
  auth: {
    login: (u, p) => call('auth:login', u, p),
    logout: () => call('auth:logout'),
    session: () => call('auth:session'),
    register: (name, email, password) => call('auth:register', name, email, password),
    changePassword: (o, n) => call('auth:changePassword', o, n),
  },
  users: {
    list: () => call('users:list'),
    save: (u) => call('users:save', u),
    saveProfile: (u) => call('users:saveProfile', u),
    setPassword: (id, pw) => call('users:setPassword', id, pw),
  },
  demo: { load: () => call('demo:load'), remove: () => call('demo:remove') },
  clients: {
    appAccess: (id) => call('clients:appAccess', id),
    newInvite: (id) => call('clients:newInvite', id),
    setAppActive: (id, active) => call('clients:setAppActive', id, active),
  },
  server: { apply: () => call('server:apply') },
  app: {
    info: () => call('app:info'),
    backup: () => call('app:backup'),
    restore: () => call('app:restore'),
    openBackupFolder: () => call('app:openBackupFolder'),
    openExternal: (url) => call('app:openExternal', url),
    showItem: (p) => call('app:showItem', p),
  },
  export: {
    pdf: (html, name, landscape) => call('export:pdf', html, name, landscape),
    file: (base64, name, ext, label) => call('export:file', base64, name, ext, label),
  },
  geo: {
    cep: (cep) => call('geo:cep', cep),
    lookup: (client) => call('geo:lookup', client),
  },
})
