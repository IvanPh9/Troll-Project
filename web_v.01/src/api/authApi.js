/**
 * Заглушка API для авторизації (Auth API Service)
 * 
 * Згідно з вимогами:
 * - Робимо функції запитів на бекенд (без реального fetch/axios реквесту)
 * - Віддаємо { login, password }
 * - Приймаємо JWT-токен або викидаємо помилку (наприклад, 401 Unauthorized)
 */

import { MOCK_USERS, generateMockJwt, decodeMockJwt } from './mockDb.js'
import { httpClient } from './httpClient.js'

/**
 * Запит на авторизацію (Login)
 * @param {Object} credentials
 * @param {string} credentials.login - Логін користувача
 * @param {string} credentials.password - Пароль користувача
 * @returns {Promise<{ success: boolean, token: string, user: Object }>}
 */
export async function loginApi({ login, password }) {
  // Логуємо виклик через HTTP-клієнт
  await httpClient.post('/auth/login', { login, password: '***' })

  // Невелика штучна затримка для реалістичності роботи інтерфейсу (імітація мережі)
  await new Promise(resolve => setTimeout(resolve, 300))

  if (!login || !password) {
    const error = new Error('Будь ласка, введіть логін та пароль')
    error.status = 400
    throw error
  }

  const cleanLogin = login.trim().toLowerCase()
  const user = MOCK_USERS.find(
    u => u.login.toLowerCase() === cleanLogin && u.password === password
  )

  if (!user) {
    const error = new Error('Невірний логін або пароль')
    error.status = 401
    throw error
  }

  // Створюємо JWT токен для успішного входу
  const token = generateMockJwt(user)

  // Повертаємо JWT-токен та базові дані користувача
  return {
    success: true,
    token,
    user: {
      id: user.id,
      login: user.login,
      name: user.name,
      role: user.role,
      email: user.email
    }
  }
}

/**
 * Запит на перевірку дійсності JWT токена (Verify Token / Me)
 * @param {string} token - JWT токен
 * @returns {Promise<{ success: boolean, user: Object }>}
 */
export async function verifyTokenApi(token) {
  await httpClient.get('/auth/me')

  await new Promise(resolve => setTimeout(resolve, 100))

  const payload = decodeMockJwt(token)
  if (!payload) {
    const error = new Error('Сесія закінчилася або токен недійсний')
    error.status = 401
    throw error
  }

  return {
    success: true,
    user: {
      id: payload.sub,
      login: payload.login,
      name: payload.name,
      role: payload.role,
      email: payload.email
    }
  }
}

/**
 * Запит на вихід з системи (Logout)
 * @returns {Promise<{ success: boolean }>}
 */
export async function logoutApi() {
  await httpClient.post('/auth/logout')
  return {
    success: true,
    message: 'Успішний вихід'
  }
}
