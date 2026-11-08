/**
 * Заглушка клієнта надсилання HTTP-запитів (Mock HTTP Client)
 * 
 * У реальному проекті тут використовується axios або fetch з перехоплювачами (interceptors)
 * для автоматичного додавання заголовка Authorization: Bearer <JWT_TOKEN>.
 * 
 * Оскільки бекенду немає, цей клієнт імітує відправку запитів,
 * логує виклики і повертає відповідні відповіді без реального мережевого запиту.
 */

class MockHttpClient {
  constructor(baseURL = '/api') {
    this.baseURL = baseURL
  }

  /**
   * Отримання збереженого JWT токена
   */
  getAuthToken() {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('auth_token') || null
    }
    return null
  }

  /**
   * Імітація заголовків запиту (додавання Authorization Bearer токена)
   */
  getHeaders() {
    const headers = {
      'Content-Type': 'application/json'
    }
    const token = this.getAuthToken()
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    return headers
  }

  /**
   * Заглушка для GET-запиту
   */
  async get(url, params = {}) {
    console.info(`[MockHttpClient] GET ${this.baseURL}${url}`, { params, headers: this.getHeaders() })
    // Заглушка: без реального мережевого запиту повертає успіх
    return { data: null, status: 200 }
  }

  /**
   * Заглушка для POST-запиту
   */
  async post(url, body = {}) {
    console.info(`[MockHttpClient] POST ${this.baseURL}${url}`, { body, headers: this.getHeaders() })
    // Заглушка: без реального мережевого запиту повертає успіх
    return { data: null, status: 200 }
  }

  /**
   * Заглушка для PUT-запиту
   */
  async put(url, body = {}) {
    console.info(`[MockHttpClient] PUT ${this.baseURL}${url}`, { body, headers: this.getHeaders() })
    return { data: null, status: 200 }
  }

  /**
   * Заглушка для DELETE-запиту
   */
  async delete(url) {
    console.info(`[MockHttpClient] DELETE ${this.baseURL}${url}`, { headers: this.getHeaders() })
    return { data: null, status: 200 }
  }
}

export const httpClient = new MockHttpClient()
