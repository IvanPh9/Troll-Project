<script setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { MOCK_USERS } from '@/api/mockDb'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const loginInput = ref('')
const passwordInput = ref('')
const showPassword = ref(false)
const localError = ref('')

// Швидке заповнення тестовими обліковими записами
const fillCredentials = (mockUser) => {
  loginInput.value = mockUser.login
  passwordInput.value = mockUser.password
  localError.value = ''
}

const handleSubmit = async () => {
  localError.value = ''

  if (!loginInput.value.trim()) {
    localError.value = 'Введіть логін'
    return
  }
  if (!passwordInput.value) {
    localError.value = 'Введіть пароль'
    return
  }

  try {
    // Відправляємо логін та пароль у store -> API заглушку
    await authStore.login({
      login: loginInput.value.trim(),
      password: passwordInput.value
    })

    // При успішному отриманні JWT перенаправляємо на цільову сторінку або на головну
    const redirectPath = route.query.redirect ? String(route.query.redirect) : '/'
    router.push(redirectPath)
  } catch (err) {
    // Помилка авторизації (401 / невірні дані)
    localError.value = err.message || 'Не вдалося виконати вхід'
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-100 via-gray-50 to-teal-50/40">
    <div class="w-full max-w-md bg-white/90 backdrop-blur-xl border border-slate-200/80 shadow-[0_10px_35px_rgba(0,0,0,0.07)] rounded-3xl p-8 sm:p-10 transition-all">
      
      <!-- Логотип та заголовок -->
      <div class="text-center mb-8">
        <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-teal-500/10 text-teal-600 mb-4 border border-teal-200/50 shadow-inner">
          <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h1 class="text-3xl font-semibold text-slate-800 font-serif italic mb-1">
          Суми Електроавтотранс
        </h1>
        <p class="text-sm text-gray-500 font-medium">
          Вхід до інформаційно-диспетчерської системи
        </p>
      </div>

      <!-- Повідомлення про помилку -->
      <div
        v-if="localError || authStore.errorMessage"
        class="mb-6 p-4 rounded-xl bg-red-50 border border-red-200/80 text-red-700 text-sm flex items-start gap-3 animate-shake"
      >
        <svg class="w-5 h-5 flex-shrink-0 mt-0.5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
        </svg>
        <div>
          <span class="font-semibold">Помилка входу:</span> {{ localError || authStore.errorMessage }}
        </div>
      </div>

      <!-- Форма входу -->
      <form @submit.prevent="handleSubmit" class="space-y-5">
        <div>
          <label class="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-2">
            Логін
          </label>
          <div class="relative">
            <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <input
              v-model="loginInput"
              type="text"
              autocomplete="username"
              placeholder="Введіть логін"
              class="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all outline-none text-slate-800 text-sm bg-gray-50/50 hover:bg-white"
            />
          </div>
        </div>

        <div>
          <label class="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-2">
            Пароль
          </label>
          <div class="relative">
            <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <input
              v-model="passwordInput"
              :type="showPassword ? 'text' : 'password'"
              autocomplete="current-password"
              placeholder="••••••••"
              class="w-full pl-11 pr-11 py-3 rounded-xl border border-gray-200 focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all outline-none text-slate-800 text-sm bg-gray-50/50 hover:bg-white"
            />
            <button
              type="button"
              @click="showPassword = !showPassword"
              class="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 transition"
              tabindex="-1"
            >
              <svg v-if="!showPassword" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
              </svg>
            </button>
          </div>
        </div>

        <button
          type="submit"
          :disabled="authStore.isLoading"
          class="w-full py-3.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-900 active:scale-[0.99] text-white font-medium shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
        >
          <svg
            v-if="authStore.isLoading"
            class="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>{{ authStore.isLoading ? 'Перевірка даних...' : 'Увійти в систему' }}</span>
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20%, 60% { transform: translateX(-4px); }
  40%, 80% { transform: translateX(4px); }
}
.animate-shake {
  animation: shake 0.3s ease-in-out;
}
</style>
