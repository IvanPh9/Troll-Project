import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { loginApi, logoutApi, verifyTokenApi } from '@/api/authApi'

export const useAuthStore = defineStore('auth', () => {
  // 1. Стан (State)
  const token = ref(typeof localStorage !== 'undefined' ? localStorage.getItem('auth_token') : null)
  
  let initialUser = null
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('auth_user') : null
    if (raw) initialUser = JSON.parse(raw)
  } catch (e) {
    initialUser = null
  }
  const user = ref(initialUser)

  const isLoading = ref(false)
  const errorMessage = ref(null)

  // 2. Геттери (Getters)
  const isAuthenticated = computed(() => Boolean(token.value))
  const currentUser = computed(() => user.value)
  const userRole = computed(() => user.value?.role || 'guest')

  // 3. Дії (Actions)

  /**
   * Авторизація користувача за логіном та паролем
   * @param {{ login: string, password: string }} credentials
   * @returns {Promise<Object>}
   */
  async function login(credentials) {
    isLoading.value = true
    errorMessage.value = null

    try {
      const response = await loginApi(credentials)

      // Зберігаємо JWT-токен та дані користувача
      token.value = response.token
      user.value = response.user

      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('auth_token', response.token)
        localStorage.setItem('auth_user', JSON.stringify(response.user))
      }

      return response
    } catch (err) {
      errorMessage.value = err.message || 'Помилка авторизації'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Вихід з системи (Logout)
   */
  async function logout() {
    try {
      await logoutApi()
    } catch (e) {
      // Ігноруємо помилки мережі при виході
    } finally {
      token.value = null
      user.value = null
      errorMessage.value = null
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('auth_token')
        localStorage.removeItem('auth_user')
      }
    }
  }

  /**
   * Перевірка валідності збереженого токена
   */
  async function checkAuth() {
    if (!token.value) {
      return false
    }

    try {
      const res = await verifyTokenApi(token.value)
      user.value = res.user
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('auth_user', JSON.stringify(res.user))
      }
      return true
    } catch (err) {
      // Якщо токен недійсний чи прострочений - очищуємо сесію
      await logout()
      return false
    }
  }

  return {
    token,
    user,
    isLoading,
    errorMessage,
    isAuthenticated,
    currentUser,
    userRole,
    login,
    logout,
    checkAuth
  }
})
