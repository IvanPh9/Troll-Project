<script setup lang="ts">

</script>

<template>
  <div class="flex-1 flex flex-col justify-center items-center pb-5 h-full">
    <header class="text-center mb-25 m-8">
      <h1 class=" text-4xl font-semibold text-slate-700 font-serif italic mb-2">Суми Електроавтотранс</h1>
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