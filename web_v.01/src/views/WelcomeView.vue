<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const handleLogout = async () => {
  await authStore.logout()
  router.push('/login')
}
</script>

<template>
  <div class="flex-1 flex flex-col justify-center items-center pb-5 h-full relative">
    <!-- Верхня панель користувача з кнопкою виходу -->
    <div class="absolute top-4 right-4 sm:top-6 sm:right-6 flex items-center gap-3 bg-white/70 backdrop-blur-md px-4 py-2 rounded-2xl border border-slate-200/80 shadow-xs">
      <div class="flex items-center gap-2 text-sm text-slate-700">
        <div class="w-8 h-8 rounded-full bg-teal-500/10 text-teal-700 font-semibold flex items-center justify-center text-xs">
          {{ authStore.currentUser?.name?.charAt(0) || 'U' }}
        </div>
        <div class="hidden sm:block text-left">
          <div class="text-xs font-semibold leading-tight text-slate-800">
            {{ authStore.currentUser?.name || authStore.currentUser?.login || 'Користувач' }}
          </div>
          <div class="text-[10px] text-gray-500 uppercase">
            {{ authStore.currentUser?.role || 'користувач' }}
          </div>
        </div>
      </div>

      <button
        @click="handleLogout"
        title="Вийти з системи"
        class="ml-1 p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition cursor-pointer flex items-center gap-1 text-xs"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
        <span class="hidden sm:inline">Вийти</span>
      </button>
    </div>

    <header class="text-center mb-16 m-8 mt-16 sm:mt-8">
      <h1 class="text-4xl font-semibold text-slate-700 font-serif italic mb-2">Суми Електроавтотранс</h1>
      <p class="text-gray-600">Вітаємо в панелі керування. Оберіть необхідний розділ для початку роботи:</p>
    </header>

    <div class="grid grid-cols-1 md:grid-cols-1 gap-4 w-full max-w-3xl">
      <router-link to="/base" class="bg-slate-200 border border-slate-400 p-6 rounded-2xl shadow-[0_4px_10px_rgba(0,0,0,0.1)] text-center transition-all transform hover:scale-105 hover:shadow-md duration-300 ease-in-out mr-8 ml-8">
        <h3 class="text-2xl font-semibold">Інформаційна база системи</h3>
        <p>Керування зупинками, маршрутами та режимами</p>
      </router-link>

      <div class="bg-gray-50 p-6 text-gray-300 rounded-2xl text-center mr-8 ml-8">
        <h3 class="text-2xl font-semibold ">Розрахунок розкладу чи завантаження з архіву</h3>
        <p>Запуск алгоритму в дію</p>
      </div>

      <div class="bg-gray-50 p-6 text-gray-300 rounded-2xl text-center mr-8 ml-8">
        <h3 class="text-2xl font-semibold">Аналіз та редагування розкладу</h3>
        <p>Регулювання створених розкладів</p>
      </div>

      <router-link to="/symbols" class="bg-white/80 border border-slate-300 p-4 rounded-2xl shadow-xs text-center transition-all transform hover:scale-102 hover:shadow-md duration-300 ease-in-out mr-8 ml-8 text-slate-700 hover:text-slate-900 flex items-center justify-center gap-2 text-sm font-medium">
        <span>📋</span>
        <span>Довідник символів та іконок системи (SvgIcon)</span>
      </router-link>
    </div>
  </div>
</template>

<style scoped>
</style>
