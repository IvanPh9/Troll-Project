<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useStopsStore } from '@/stores/stops'
import { Stop } from '@/models/stop'
import SvgIcon from '@/components/ui/SvgIcon.vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const route = useRoute()
const router = useRouter()
const stopsStore = useStopsStore()

const stopName = computed(() => (route.params.name as string) || '')

// Всі потоки зупинки з цією назвою
const stops = computed(() => {
  return stopsStore.stopsList
    .filter(s => s.name.toLowerCase() === stopName.value.toLowerCase())
    .sort((a, b) => a.directionCode - b.directionCode)
})

const goBack = () => {
  router.push({ path: '/base/stops', query: route.query })
}

// === ЦВЕТОВА СХЕМА ДЛЯ МАРШРУТІВ ===
const getFlowColor = (index: number) => {
  const colors = [
    '#EF4444', // Red
    '#A855F7', // Purple
    '#3B82F6', // Light Blue
    '#F59E0B', // Amber
    '#0D9488', // Teal
    '#EC4899', // Pink
    '#10B981'  // Green
  ]
  return colors[index % colors.length]
}

// === ДИНАМІЧНІ МАРШРУТИ ЗУПИНКИ ===
const stopRoutes = computed(() => {
  const routeMap: Record<string, string[]> = {
    'Залізничний вокзал': ['1', '57A', '7'],
    'Центральний ринок': ['2', '10A', '12', '15A'],
    'Універмаг «Київ»': ['1', '2', '7', '10A'],
    'АТ «Хімпром»': ['5', '8'],
    'Тролейбусне депо (КП «Електроавтотранс» )': ['1', '2', '3', '5', '7'],
    'Сумський державний університет (СумДУ)': ['3', '4', '9'],
    'Автовокзал': ['2', '7', '12'],
    'Вулиця Героїв Крут': ['1', '4', '15A']
  }
  
  const nameKey = stopName.value.trim()
  const matchedKey = Object.keys(routeMap).find(k => k.toLowerCase() === nameKey.toLowerCase())
  return matchedKey ? routeMap[matchedKey] : ['1', '57A', '7']
})

// === ЛОГІКА РЕДАГУВАННЯ / ДОДАВАННЯ НАПРЯМКУ ===
const isModalOpen = ref(false)
const formStopId = ref<number | null>(null)
const formName = ref('')
const formType = ref('normal')
const formDirectionCode = ref(1)
const formDirectionComment = ref('')
const formCoordinates = ref('')
const formPlatformsCount = ref(1)
const validationErrors = ref<Record<string, string>>({})

const openAddModal = () => {
  formStopId.value = null
  formName.value = stopName.value
  formType.value = 'normal'
  
  // Визначаємо наступний вільний код напрямку
  const maxCode = stops.value.length > 0 ? Math.max(...stops.value.map(s => s.directionCode)) : 0
  formDirectionCode.value = maxCode + 1
  
  formDirectionComment.value = ''
  formCoordinates.value = ''
  formPlatformsCount.value = 1
  validationErrors.value = {}
  isModalOpen.value = true
}

const openEditModal = (stop: Stop) => {
  formStopId.value = stop.stopId
  formName.value = stop.name
  formType.value = stop.type
  formDirectionCode.value = stop.directionCode
  formDirectionComment.value = stop.directionComment
  formCoordinates.value = stop.getLatLngString()
  formPlatformsCount.value = stop.platformsCount
  validationErrors.value = {}
  isModalOpen.value = true
}

const closeModal = () => {
  isModalOpen.value = false
}

const saveStop = () => {
  validationErrors.value = {}

  let newId = formStopId.value
  if (!newId) {
    const maxId = stopsStore.stopsList.length > 0
      ? Math.max(...stopsStore.stopsList.map(s => s.stopId))
      : 0
    newId = maxId + 1
  }

  const tempStop = new Stop(
    newId,
    formName.value.trim(),
    formType.value,
    Number(formDirectionCode.value),
    formDirectionComment.value.trim(),
    formCoordinates.value.trim(),
    0,
    Number(formPlatformsCount.value)
  )

  const { isValid, errors } = tempStop.validate()
  if (!isValid) {
    validationErrors.value = errors
    return
  }

  // Перевірка на дублювання коду напрямку
  const isDuplicate = stopsStore.stopsList.some(s => 
    s.stopId !== formStopId.value &&
    s.name.toLowerCase() === formName.value.trim().toLowerCase() &&
    s.directionCode === Number(formDirectionCode.value)
  )

  if (isDuplicate) {
    validationErrors.value = { directionCode: `Напрямок №${formDirectionCode.value} для цієї зупинки вже існує` }
    return
  }

  try {
    if (formStopId.value) {
      stopsStore.updateStop(formStopId.value, tempStop)
    } else {
      stopsStore.addStop(tempStop)
    }
    closeModal()
  } catch (err: any) {
    try {
      const parsedErrors = JSON.parse(err.message)
      validationErrors.value = parsedErrors
    } catch {
      alert(err.message)
    }
  }
}

const deleteStop = (id: number) => {
  if (confirm("Ви впевнені, що хочете видалити цей напрямок зупинки?")) {
    stopsStore.deleteStop(id)
    if (stops.value.length === 0) {
      goBack()
    }
  }
}

// === ІНТЕГРАЦІЯ LEAFLET MAP ===
const mapContainer = ref<HTMLElement | null>(null)
let leafletMap: any = null
let markersLayer: any = null

onMounted(() => {
  if (mapContainer.value) {
    leafletMap = L.map(mapContainer.value, {
      center: [50.9077, 34.7981],
      zoom: 15,
      zoomControl: true
    })

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
    }).addTo(leafletMap)

    markersLayer = L.layerGroup().addTo(leafletMap)
    
    renderMarkersAndZoom()

    // Виклик invalidateSize після завершення анімації переходу сторінки Vue (0.3s)
    setTimeout(() => {
      if (leafletMap) {
        leafletMap.invalidateSize({ animate: true })
      }
    }, 350)
  }
})

onBeforeUnmount(() => {
  if (leafletMap) {
    try {
      leafletMap.remove()
    } catch (e) {
      console.warn("Leaflet map removal warning:", e)
    }
    leafletMap = null
  }
  markersLayer = null
})

const createFlowIcon = (directionCode: number, type: string) => {
  const typeBorderColor = type === 'depo' ? '#64748B' : type === 'end' ? '#EF4444' : '#0D9488'
  return L.divIcon({
    html: `<div class="w-7 h-7 rounded-full bg-white shadow-md flex items-center justify-center hover:scale-110 transition-transform cursor-pointer font-bold text-xs text-gray-800" style="border: 2.5px solid ${typeBorderColor};">${directionCode}</div>`,
    className: 'leaflet-custom-flow-icon',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14]
  })
}

const renderMarkersAndZoom = () => {
  if (!leafletMap || !markersLayer || !L) return

  markersLayer.clearLayers()

  const points: any[] = []

  stops.value.forEach(stop => {
    if (stop.latitude && stop.longitude) {
      const marker = L.marker([stop.latitude, stop.longitude], {
        icon: createFlowIcon(stop.directionCode, stop.type)
      })

      const popupHtml = `
        <div class="p-1.5 text-center font-sans">
          <div class="inline-block px-2 py-0.5 rounded-full text-[9px] font-bold bg-teal-55 text-teal-700 border border-teal-100/50 mb-1">
            Напрямок ${stop.directionCode}
          </div>
          <h4 class="font-bold text-gray-800 text-xs leading-tight mb-1">${stop.name}</h4>
          <p class="text-[11px] text-gray-550 font-semibold mb-1">${stop.directionComment || 'Без коментаря'}</p>
          <p class="text-[10px] text-gray-400 font-medium">${stop.platformsCount} платформи</p>
        </div>
      `
      marker.bindPopup(popupHtml)
      markersLayer.addLayer(marker)
      points.push([stop.latitude, stop.longitude])
    }
  })

  if (points.length > 0) {
    if (points.length === 1) {
      leafletMap.setView(points[0], 16)
    } else {
      leafletMap.fitBounds(points, { padding: [40, 40] })
    }
  }
}

const focusOnStop = (stop: Stop) => {
  if (leafletMap && stop.latitude && stop.longitude) {
    leafletMap.setView([stop.latitude, stop.longitude], 17, { animate: true })
  }
}

watch(stops, () => {
  renderMarkersAndZoom()
}, { deep: true })
</script>

<template>
  <div class="absolute inset-0 w-full h-full bg-[#F4F7F9] flex flex-col md:flex-row gap-5 p-5 pt-[90px] md:pt-[90px] overflow-hidden">
    
    <!-- ЛІВА КОЛОНКА (Два окремих заокруглених блоки з маргінами) -->
    <div class="w-full md:w-1/3 flex flex-col gap-5 h-full flex-shrink-0 overflow-hidden">
      
      <!-- БЛОК 1 (Зверху ліворуч): Схема маршрутів та легенда -->
      <div class="flex-shrink-0 bg-white rounded-3xl p-6 flex flex-col justify-center shadow-sm border-none">
        
        <div class="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4 text-center">Схема маршрутів</div>
        
        <!-- Зразок капсули та ліній маршрутів -->
        <div class="flex items-center justify-center w-full my-4">
          <!-- Вертикальна капсула / коло -->
          <div 
            class="w-8 border-[3px] border-slate-800 bg-white rounded-full z-10 flex-shrink-0 transition-all duration-300 shadow-sm"
            :style="{ height: Math.max(32, stopRoutes.length * 12 + (stopRoutes.length - 1) * 8 + 20) + 'px' }"
          ></div>
          <!-- Горизонтальні лінії маршрутів -->
          <div 
            class="flex flex-col justify-center gap-2 w-36 -ml-[3px] z-0 transition-all duration-300"
            :style="{ height: Math.max(32, stopRoutes.length * 12 + (stopRoutes.length - 1) * 8 + 20) + 'px' }"
          >
            <div 
              v-for="(routeNum, index) in stopRoutes" 
              :key="routeNum"
              class="h-3 w-full rounded-r-md transition-all duration-300 shadow-sm"
              :style="{ backgroundColor: getFlowColor(index) }"
            ></div>
          </div>
        </div>
        
        <!-- Легенда маршрутів (круглі квадрати) -->
        <div class="mt-4 w-full border-t border-gray-100 pt-4 flex flex-col items-center">
          <div class="flex items-center justify-center gap-3 flex-wrap">
            <div 
              v-for="(routeNum, index) in stopRoutes" 
              :key="routeNum"
              class="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm transition-transform hover:scale-105"
              :style="{ backgroundColor: getFlowColor(index) }"
            >
              {{ routeNum }}
            </div>
          </div>
        </div>
      </div>

      <!-- БЛОК 2 (Знизу ліворуч): Карта напрямків у власному заокругленому боксі -->
      <div 
        ref="mapContainer" 
        class="w-full flex-1 rounded-3xl border-none shadow-sm overflow-hidden bg-slate-50 relative z-0"
      ></div>
    </div>

    <!-- ПРАВА КОЛОНКА (Вся інформація у власному окремому заокругленому боксі) -->
    <div class="w-full md:w-2/3 flex flex-col bg-white rounded-3xl overflow-hidden h-full p-8 shadow-sm border-none">
      
      <!-- Заголовок та кнопка створення нового потоку з кнопкою Назад -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-5 border-b border-gray-100 pb-6 mb-6 flex-shrink-0">
        <div class="flex items-center gap-5">
          <button
            @click="goBack"
            class="group flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 transition-all cursor-pointer text-slate-700 font-bold border-none shadow-none"
            title="Повернутися до списку"
          >
            <SvgIcon name="chevron-left" class="w-4.5 h-4.5 text-slate-500 group-hover:-translate-x-1 transition-transform" />
            Назад
          </button>
          
          <div class="h-10 w-px bg-slate-200 hidden sm:block"></div>
          
          <div class="flex flex-col">
            <h2 class="text-3xl font-bold text-gray-800 leading-tight tracking-tight">{{ stopName }}</h2>
            <div class="mt-1.5">
              <span class="text-[10px] text-teal-700 bg-teal-50 px-2.5 py-1 rounded-lg font-bold uppercase tracking-wider">Станція мережі</span>
            </div>
          </div>
        </div>
        
        <button 
          @click="openAddModal"
          class="px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold rounded-2xl flex items-center gap-2 shadow-sm hover:shadow-md transition-all cursor-pointer self-start sm:self-auto border-none"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/>
          </svg>
          Додати напрямок
        </button>
      </div>

      <!-- Список потоків (займає весь залишок висоти правої колонки) -->
      <div class="flex-1 overflow-y-auto space-y-3.5 pr-2 custom-scrollbar">
        <div v-if="stops.length === 0" class="text-center py-16 text-gray-400 text-sm font-medium">
          Напрямків не створено
        </div>

        <div 
          v-for="stop in stops" 
          :key="stop.stopId"
          @click="focusOnStop(stop)"
          class="relative p-5 bg-white border border-gray-100 hover:border-teal-200 rounded-3xl shadow-xs hover:shadow-md transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-5 cursor-pointer overflow-hidden group"
        >
          <!-- Accent border on hover -->
          <div class="absolute left-0 top-0 bottom-0 w-1.5 bg-teal-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>

          <div class="space-y-2 flex-1 pl-1">
            <div class="flex items-center flex-wrap gap-2.5">
              <span class="text-[10px] px-2.5 py-1 rounded-lg font-bold bg-teal-50 text-teal-700 border-none">
                Напрямок {{ stop.directionCode }}
              </span>
              
              <span 
                class="text-[9px] px-2.5 py-1 rounded-lg font-bold uppercase tracking-wider border-none"
                :class="[
                  stop.type === 'depo' ? 'bg-slate-100 text-slate-600' :
                  stop.type === 'end' ? 'bg-red-50 text-red-600' :
                  'bg-teal-50 text-teal-600'
                ]"
              >
                {{ stop.type === 'depo' ? 'Депо' : stop.type === 'end' ? 'Кінцева' : 'Звичайна' }}
              </span>

              <span class="text-[9px] px-2.5 py-1 rounded-lg font-bold bg-amber-50 text-amber-700 border-none tracking-wider">
                Платформ: {{ stop.platformsCount }}
              </span>
            </div>

            <h4 class="text-base font-bold text-gray-800">
              {{ stop.directionComment || 'Без коментаря до напрямку' }}
            </h4>

            <div class="flex items-center gap-2 text-[12px] text-gray-400 font-semibold pt-1">
              <svg class="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>{{ stop.getLatLngString() }}</span>
              <span class="text-gray-300 mx-1">•</span>
              <a 
                :href="stop.getGoogleMapsUrl()" 
                target="_blank" 
                @click.stop
                class="text-teal-600 hover:text-teal-700 hover:underline font-bold transition-colors"
              >
                Google Maps
              </a>
            </div>
          </div>

          <!-- Дії з потоком -->
          <div class="flex items-center gap-1.5 self-end sm:self-center relative z-10">
            <button
              @click.stop="openEditModal(stop)"
              class="w-10 h-10 rounded-xl flex items-center justify-center text-gray-400 hover:text-teal-600 hover:bg-teal-50 transition-colors bg-transparent border-none shadow-none cursor-pointer"
              title="Редагувати"
            >
              <SvgIcon name="pencil" class="w-4.5 h-4.5" />
            </button>
            <button
              @click.stop="deleteStop(stop.stopId)"
              class="w-10 h-10 rounded-xl flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors bg-transparent border-none shadow-none cursor-pointer"
              title="Видалити"
            >
              <SvgIcon name="trash" class="w-4.5 h-4.5" />
            </button>
          </div>
        </div>
      </div>

    </div>

    <!-- МОДАЛЬНЕ ВІКНО РЕДАГУВАННЯ / ДОДАВАННЯ НАПРЯМКУ (z-index 9999) -->
    <transition
      enter-active-class="transition ease-out duration-300"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition ease-in duration-200"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div v-if="isModalOpen" class="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
        <div class="bg-white rounded-[2rem] w-full max-w-md p-6 shadow-2xl border border-gray-100 transform transition-all relative">
          
          <div class="flex items-start justify-between pb-6 mb-6 border-b border-gray-100 relative">
            <div class="flex items-center gap-4">
              <div class="w-14 h-14 bg-teal-50 text-teal-600 rounded-full flex items-center justify-center border border-teal-100">
                <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <h3 class="text-xl font-bold text-gray-800">
                  {{ formStopId ? 'Редагувати напрямок' : 'Додати напрямок' }}
                </h3>
                <p class="text-xs text-gray-500">Вкажіть характеристики точки зупинки</p>
              </div>
            </div>
            
            <button @click="closeModal" class="text-gray-400 hover:text-gray-600 transition-colors p-1.5 rounded-full hover:bg-gray-50 absolute right-0 top-0">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <form @submit.prevent="saveStop" class="space-y-4" novalidate>
            
            <div class="space-y-1.5">
              <label class="text-sm font-semibold text-gray-700 pl-1">Назва станції / зупинки</label>
              <input
                v-model="formName"
                type="text"
                class="w-full bg-gray-50 border border-gray-200 text-gray-400 text-sm rounded-2xl px-4 py-3 outline-none cursor-not-allowed"
                disabled
              >
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div class="space-y-1.5">
                <label class="text-sm font-semibold text-gray-700 pl-1">Тип зупинки <span class="text-red-500">*</span></label>
                <select
                  v-model="formType"
                  class="w-full bg-[#F8FAFC] border border-gray-200 text-gray-800 text-sm rounded-2xl px-4 py-3 outline-none focus:bg-white focus:border-teal-500 focus:ring-4 focus:ring-teal-50 transition-all appearance-none cursor-pointer"
                >
                  <option value="normal">Звичайна</option>
                  <option value="end">Кінцева</option>
                  <option value="depo">Депо</option>
                </select>
              </div>

              <div class="space-y-1.5">
                <label class="text-sm font-semibold text-gray-700 pl-1">Кількість платформ</label>
                <input
                  v-model="formPlatformsCount"
                  type="number"
                  min="1"
                  class="w-full bg-[#F8FAFC] border text-gray-800 text-sm rounded-2xl px-4 py-3 outline-none focus:bg-white focus:border-teal-500 focus:ring-4 focus:ring-teal-50 transition-all"
                  :class="validationErrors.platformsCount ? 'border-red-400 focus:border-red-400 focus:ring-red-50' : 'border-gray-200'"
                  required
                >
                <p v-if="validationErrors.platformsCount" class="text-xs text-red-500 pl-1 mt-1">{{ validationErrors.platformsCount }}</p>
              </div>
            </div>

            <div class="grid grid-cols-4 gap-3">
              <div class="col-span-1 space-y-1.5">
                <label class="text-sm font-semibold text-gray-700 pl-1" title="Код напрямку">Код <span class="text-red-500">*</span></label>
                <input
                  v-model="formDirectionCode"
                  type="number"
                  min="1"
                  class="w-full bg-[#F8FAFC] border text-gray-800 text-sm rounded-2xl px-3 py-3 outline-none focus:bg-white focus:border-teal-500 focus:ring-4 focus:ring-teal-50 transition-all text-center font-bold"
                  :class="validationErrors.directionCode ? 'border-red-400 focus:border-red-400 focus:ring-red-50' : 'border-gray-200'"
                  required
                >
              </div>
              <div class="col-span-3 space-y-1.5">
                <label class="text-sm font-semibold text-gray-700 pl-1">Напрямок руху (коментар)</label>
                <input
                  v-model="formDirectionComment"
                  type="text"
                  placeholder="Наприклад: В бік Хімпрому"
                  class="w-full bg-[#F8FAFC] border text-gray-800 text-sm rounded-2xl px-4 py-3 outline-none focus:bg-white focus:border-teal-500 focus:ring-4 focus:ring-teal-50 transition-all"
                  :class="validationErrors.directionComment ? 'border-red-400 focus:border-red-400 focus:ring-red-50' : 'border-gray-200'"
                >
              </div>
            </div>
            <p v-if="validationErrors.directionCode" class="text-xs text-red-500 pl-1 mt-0.5">{{ validationErrors.directionCode }}</p>
            <p v-if="validationErrors.directionComment" class="text-xs text-red-500 pl-1 mt-0.5">{{ validationErrors.directionComment }}</p>

            <div class="space-y-1.5">
              <label class="text-sm font-semibold text-gray-700 pl-1">Координати (Google Maps)</label>
              <input
                v-model="formCoordinates"
                type="text"
                placeholder="50.9077, 34.7981 або посилання..."
                class="w-full bg-[#F8FAFC] border text-gray-800 text-sm rounded-2xl px-4 py-3 outline-none focus:bg-white focus:border-teal-500 focus:ring-4 focus:ring-teal-50 transition-all"
                :class="validationErrors.coordinates ? 'border-red-400 focus:border-red-400 focus:ring-red-50' : 'border-gray-200'"
              />
              <p v-if="validationErrors.coordinates" class="text-xs text-red-500 pl-1 mt-1">{{ validationErrors.coordinates }}</p>
            </div>

            <div class="pt-6 border-t border-gray-100 flex flex-col sm:flex-row gap-3 justify-end">
              <button
                type="button"
                @click="closeModal"
                class="px-6 py-3 rounded-2xl text-gray-600 bg-gray-50 hover:bg-gray-100 font-medium transition-colors border border-transparent hover:border-gray-200 text-sm"
              >
                Скасувати
              </button>
              <button
                type="submit"
                class="px-8 py-3 rounded-2xl text-white bg-teal-600 hover:bg-teal-700 font-medium transition-all text-sm shadow-md"
              >
                Зберегти
              </button>
            </div>

          </form>
        </div>
      </div>
    </transition>

  </div>
</template>

<style scoped>
.menu-fade-enter-active,
.menu-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.menu-fade-enter-from,
.menu-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #E2E8F0;
  border-radius: 9999px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #CBD5E1;
}
</style>
