/**
 * Заглушка бази даних (Mock Database)
 * Оскільки справжньої БД та бекенду поки немає,
 * тут зберігаються тестові користувачі та логіка генерації/валідації JWT-токена.
 */

export const MOCK_USERS = [
  {
    id: 1,
    login: 'admin',
    password: 'admin123',
    name: 'Адміністратор Системи',
    role: 'admin',
    email: 'admin@sumy-eat.gov.ua'
  },
  {
    id: 2,
    login: 'dispatcher',
    password: 'disp123',
    name: 'Диспетчер Мартиненко',
    role: 'dispatcher',
    email: 'disp@sumy-eat.gov.ua'
  },
  {
    id: 3,
    login: 'driver',
    password: 'driver123',
    name: 'Водій Пищик Іван',
    role: 'driver',
    email: 'driver@sumy-eat.gov.ua'
  }
]

/**
 * Допоміжна функція кодування в Base64URL
 */
function base64UrlEncode(str) {
  try {
    return btoa(unescape(encodeURIComponent(str)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
  } catch (e) {
    return btoa(str)
  }
}

/**
 * Допоміжна функція декодування з Base64URL
 */
function base64UrlDecode(str) {
  try {
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/')
    while (base64.length % 4) {
      base64 += '='
    }
    return decodeURIComponent(escape(atob(base64)))
  } catch (e) {
    return atob(str)
  }
}

/**
 * Генерація валідного за форматом JWT токена (Header.Payload.Signature)
 */
export function generateMockJwt(user) {
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  }

  const nowInSec = Math.floor(Date.now() / 1000)
  const payload = {
    sub: user.id,
    login: user.login,
    name: user.name,
    role: user.role,
    email: user.email,
    iat: nowInSec,
    exp: nowInSec + 60 * 60 * 24 // дійсний 24 години
  }

  const encodedHeader = base64UrlEncode(JSON.stringify(header))
  const encodedPayload = base64UrlEncode(JSON.stringify(payload))
  const mockSignature = base64UrlEncode(`sumy_eat_signature_hash_${user.id}_${nowInSec}`)

  return `${encodedHeader}.${encodedPayload}.${mockSignature}`
}

/**
 * Перевірка та розкодування JWT токена
 */
export function decodeMockJwt(token) {
  if (!token || typeof token !== 'string') return null

  const parts = token.split('.')
  if (parts.length !== 3) return null

  try {
    const payloadStr = base64UrlDecode(parts[1])
    const payload = JSON.parse(payloadStr)

    // Перевірка терміну дії (exp)
    const nowInSec = Math.floor(Date.now() / 1000)
    if (payload.exp && payload.exp < nowInSec) {
      return null // токен закінчився
    }

    return payload
  } catch (err) {
    console.error('Помилка розкодування токена:', err)
    return null
  }
}
