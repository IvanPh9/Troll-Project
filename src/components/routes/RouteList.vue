<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();

const routes = ref([
  { id: 1, number: '1', name: 'Кінцева 1 - Кінцева 2', status: 'Активний', pointsCount: 15, length: '109 хв' },
]);

const openConstructor = () => {
    router.push({ name: 'route-create' });
};

const deleteRoute = (id) => {
    routes.value = routes.value.filter(r => r.id !== id);
};
</script>

<template>
  <div class="flex-1 flex flex-col p-6 w-full max-w-7xl mx-auto bg-transparent">
    
    <div class="flex justify-between items-center mb-8 pb-4 border-b border-gray-200">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">
          Маршрути
        </h1>
        <p class="text-gray-500 text-sm mt-1">Управління мережею маршрутів та розкладами руху</p>
      </div>
      
      <button @click="openConstructor" class="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-5 rounded-lg shadow-sm hover:shadow transition-all flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
        Створити маршрут
      </button>
    </div>

    <!-- Routes Grid -->
    <div v-if="routes.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div v-for="route in routes" :key="route.id" class="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-all group relative">
        <div class="flex justify-between items-start mb-4">
          <div class="bg-blue-600 text-white font-bold text-xl h-12 w-12 rounded-lg flex items-center justify-center">
            {{ route.number }}
          </div>
          <span :class="['px-2.5 py-1 rounded-full text-xs font-medium', route.status === 'Активний' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-600 border border-gray-200']">
            {{ route.status }}
          </span>
        </div>
        
        <h3 class="text-lg font-semibold text-gray-900 mb-1">{{ route.name }}</h3>
        
        <div class="flex gap-4 mt-3 text-sm text-gray-500 mb-4">
          <div class="flex items-center gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            {{ route.pointsCount }} точок
          </div>
          <div class="flex items-center gap-1.5">
             <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            {{ route.length }}
          </div>
        </div>
        
        <div class="flex justify-between items-center pt-4 border-t border-gray-100">
          <button class="text-blue-600 hover:text-blue-800 font-medium text-sm transition-colors">Переглянути</button>
          <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button class="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-all" title="Редагувати">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
            </button>
            <button @click="deleteRoute(route.id)" class="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-all" title="Видалити">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
    
    <div v-else class="flex-1 flex flex-col items-center justify-center text-gray-500 bg-white rounded-xl border border-gray-200 border-dashed m-8 p-12">
      <div class="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
      </div>
      <p class="text-lg font-medium text-gray-900">Маршрутів ще не створено</p>
      <p class="text-sm mt-1 max-w-sm text-center">Створіть свій перший маршрут за допомогою конструктора</p>
      <button @click="openConstructor" class="mt-6 px-5 py-2 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg text-gray-700 text-sm font-medium transition-colors shadow-sm">Створити маршрут</button>
    </div>
  </div>
</template>