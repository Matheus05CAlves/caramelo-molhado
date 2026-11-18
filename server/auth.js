const crypto = require('crypto')

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex')
  return { salt, hash }
}

function verifyPassword(password, salt, hash) {
  try {
    const test = crypto.scryptSync(String(password), salt, 64)
    const ref = Buffer.from(hash, 'hex')
    return ref.length === test.length && crypto.timingSafeEqual(test, ref)
  } catch {
    return false
  }
}

// Proteção simples contra tentativa e erro: 5 falhas bloqueiam o usuário por 60 segundos.
const fails = new Map()
function checkLock(username) {
  const f = fails.get(username.toLowerCase())
  if (f && f.count >= 5 && Date.now() < f.until) return Math.ceil((f.until - Date.now()) / 1000)
  return 0
}
function registerFail(username) {
  const k = username.toLowerCase()
  const f = fails.get(k) || { count: 0, until: 0 }
  f.count += 1
  if (f.count >= 5) f.until = Date.now() + 60000
  fails.set(k, f)
}
function clearFails(username) {
  fails.delete(username.toLowerCase())
}

// Regra de senha: mínimo 9 caracteres, com letra minúscula, maiúscula e um caractere especial.
function passwordProblem(pw) {
  pw = String(pw || '')
  if (pw.length < 9) return 'A senha precisa ter no mínimo 9 caracteres.'
  if (!/[a-z]/.test(pw)) return 'A senha precisa ter pelo menos uma letra minúscula.'
  if (!/[A-Z]/.test(pw)) return 'A senha precisa ter pelo menos uma letra maiúscula.'
  if (!/[^A-Za-z0-9]/.test(pw)) return 'A senha precisa ter pelo menos um caractere especial (como ! @ # $ %).'
  return ''
}

module.exports = { passwordProblem, hashPassword, verifyPassword, checkLock, registerFail, clearFails }
