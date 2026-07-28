<script setup lang="ts">
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useStopsStore } from '@/stores/stops'
import { Stop } from '@/models/stop'
import SvgIcon from '@/components/ui/SvgIcon.vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const store = useStopsStore()
const router = useRouter()
const route = useRoute()

const isDeleteMode = computed(() => store.isDeleteMode)

// === ДІАЛОГ ПІДТВЕРДЖЕННЯ ВИДАЛЕННЯ ===
const isDeleteConfirmModalOpen = ref(false)
const selectedGroupNameForDelete = ref<string>('')

const triggerDeleteConfirmation = (name: string) => {
  selectedGroupNameForDelete.value = name
  isDeleteConfirmModalOpen.value = true
}

const closeDeleteConfirmModal = () => {
  isDeleteConfirmModalOpen.value = false
  selectedGroupNameForDelete.value = ''
}

const confirmDeleteGroup = () => {
  if (selectedGroupNameForDelete.value) {
    const targets = store.stopsList.filter(s => s.name.toLowerCase() === selectedGroupNameForDelete.value.toLowerCase())
    targets.forEach(t => store.deleteStop(t.stopId))
    closeDeleteConfirmModal()
  }
}

// === ЛОГІКА ДОДАВАННЯ ЗУПИНКИ ===
const isModalOpen = ref(false)
const formName = ref('')
const formType = ref('normal')
const formDirectionCode = ref(1)
const formDirectionComment = ref('')
const formCoordinates = ref('')
const formPlatformsCount = ref(1)
const validationErrors = ref<Record<string, string>>({})

watch(() => store.isAddStopModalOpen, (newVal) => {
  if (newVal) {
    formName.value = ''
    formType.value = 'normal'
    formDirectionCode.value = 1
    formDirectionComment.value = ''
    formCoordinates.value = ''
    formPlatformsCount.value = 1
    validationErrors.value = {}
    isModalOpen.value = true
  }
})

const closeModal = () => {
  isModalOpen.value = false
  store.isAddStopModalOpen = false
}

const saveStop = () => {
  validationErrors.value = {}

  const maxId = store.stopsList.length > 0
    ? Math.max(...store.stopsList.map(s => s.stopId))
    : 0
  const newId = maxId + 1

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

  const isDuplicate = store.stopsList.some(s => 
    s.name.toLowerCase() === formName.value.trim().toLowerCase() &&
    s.directionCode === Number(formDirectionCode.value)
  )

  if (isDuplicate) {
    validationErrors.value = { directionCode: `Напрямок №${formDirectionCode.value} для цієї зупинки вже існує` }
    return
  }

  try {
    store.addStop(tempStop)
    closeModal()
    viewDetail(tempStop.name)
  } catch (err: any) {
    try {
      const parsedErrors = JSON.parse(err.message)
      validationErrors.value = parsedErrors
    } catch {
      alert(err.message)
    }
  }
}

// === ЛОГІКА ФІЛЬТРАЦІЇ ТА СОРТУВАННЯ ===
const currentType = computed(() => (route.query.type as string) || 'all')

const isTypeMenuOpen = ref(false)

const closeMenus = () => {
  isTypeMenuOpen.value = false
}

const setTypeFilter = (typeStr: string) => {
  const query = { ...route.query }
  if (typeStr === 'all') delete query.type
  else query.type = typeStr
  router.replace({ query }).catch(console.warn)
  isTypeMenuOpen.value = false
}

const searchQuery = ref('')

const displayedStops = computed(() => {
  let result = [...store.stopsList]

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase().trim()
    result = result.filter(s => 
      s.name.toLowerCase().includes(q) || 
      (s.directionComment && s.directionComment.toLowerCase().includes(q))
    )
  }

  if (currentType.value !== 'all') {
    result = result.filter(s => s.type === currentType.value)
  }

  return result
})

// Групування відфільтрованого результату
const groupedStops = computed(() => {
  const groups: Record<string, Stop[]> = {}
  
  displayedStops.value.forEach(stop => {
    if (!groups[stop.name]) {
      groups[stop.name] = []
    }
    groups[stop.name].push(stop)
  })

  return Object.keys(groups).map(name => ({
    name,
    stops: groups[name]
  })).sort((a, b) => a.name.localeCompare(b.name))
})

const typeLabel = computed(() => {
  if (currentType.value === 'normal') return 'Звичайні'
  if (currentType.value === 'end') return 'Кінцеві'
  if (currentType.value === 'depo') return 'Депо'
  return 'Всі типи'
})

const typeDotClass = computed(() => {
  if (currentType.value === 'normal') return 'bg-teal-500 shadow-[0_0_4px_#0d9488]'
  if (currentType.value === 'end') return 'bg-red-500 shadow-[0_0_4px_#ef4444]'
  if (currentType.value === 'depo') return 'bg-slate-500 shadow-[0_0_4px_#64748b]'
  return 'bg-teal-500 shadow-[0_0_4px_#0d9488]'
})

const viewDetail = (name: string) => {
  router.push({ name: 'stop-detail', params: { name }, query: route.query })
}

// === ІНТЕГРАЦІЯ LEAFLET MAP ===
const mapContainer = ref<HTMLElement | null>(null)
let leafletMap: any = null
let markersLayer: any = null

onMounted(() => {
  window.viewStopDetail = (name: string) => {
    if (isDeleteMode.value) {
      triggerDeleteConfirmation(name)
    } else {
      viewDetail(name)
    }
  }

  if (mapContainer.value) {
    leafletMap = L.map(mapContainer.value, {
      center: [50.9077, 34.7981], // Центр міста Суми
      zoom: 13,
      zoomControl: false 
    })

    L.control.zoom({
      position: 'bottomright'
    }).addTo(leafletMap)

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
    }).addTo(leafletMap)

    markersLayer = L.layerGroup().addTo(leafletMap)
    renderMapMarkers()

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
  delete (window as any).viewStopDetail
})

const createCustomIcon = () => {
  const borderColor = isDeleteMode.value ? '#EF4444' : '#000000'
  const shadowColor = isDeleteMode.value ? 'rgba(239, 68, 68, 0.4)' : 'rgba(0,0,0,0.15)'
  const borderSize = isDeleteMode.value ? '3px' : '2.5px'
  
  return L.divIcon({
    html: `<div class="w-6 h-6 rounded-full bg-white shadow-md flex items-center justify-center hover:scale-110 transition-transform cursor-pointer" style="border: ${borderSize} solid ${borderColor}; box-shadow: 0 2px 6px ${shadowColor};"></div>`,
    className: 'leaflet-custom-circle-icon',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12]
  })
}

const renderMapMarkers = () => {
  if (!leafletMap || !markersLayer || !L) return
  
  markersLayer.clearLayers()

  groupedStops.value.forEach(group => {
    const firstStop = group.stops.find(s => s.latitude && s.longitude)
    if (firstStop) {
      const marker = L.marker([firstStop.latitude, firstStop.longitude], {
        icon: createCustomIcon()
      })

      // При кліку на зупинку — центруємо карту на ній
      marker.on('click', (e: any) => {
        leafletMap.setView(e.target.getLatLng(), leafletMap.getZoom(), { animate: true })
      })

      const btnBgColor = isDeleteMode.value ? 'bg-red-500 hover:bg-red-650' : 'bg-teal-600 hover:bg-teal-700'
      const btnText = isDeleteMode.value ? 'Видалити' : 'Детальніше'
      const indicatorColor = isDeleteMode.value ? 'border-red-500' : 'border-black'

      const popupHtml = `
        <div class="p-2 text-center font-sans" style="min-width: 160px;">
          <div class="w-4 h-4 rounded-full border-2 bg-white mx-auto mb-1 ${indicatorColor}"></div>
          <h4 class="font-bold text-gray-800 text-sm mb-1 leading-tight">${group.name}</h4>
          <p class="text-xs text-gray-400 font-semibold mb-2">Напрямків: ${group.stops.length}</p>
          <button 
            class="px-4 py-1.5 text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer inline-block ${btnBgColor}"
            onclick="window.viewStopDetail('${group.name.replace(/'/g, "\\'")}')"
          >
            ${btnText}
          </button>
        </div>
      `
      marker.bindPopup(popupHtml)
      markersLayer.addLayer(marker)
    }
  })
}

watch(
  () => groupedStops.value,
  () => {
    renderMapMarkers()
  },
  { deep: true, immediate: true }
)

watch(isDeleteMode, () => {
  renderMapMarkers()
})
</script>

<template>
  <div class="w-full h-full relative">

    <!-- Overlay для закриття меню -->
    <div v-if="isTypeMenuOpen" @click="closeMenus" class="fixed inset-0 z-40"></div>

    <!-- КАРТА НА 100% ПОВНИЙ ЕКРАН (фіксована підкладка) -->
    <div 
      ref="mapContainer" 
      class="fixed inset-0 w-screen h-screen z-0 bg-slate-50 overflow-hidden"
    ></div>

    <!-- КРУГЛА РІДКА СКЛЯНА ПАНЕЛЬ КЕРУВАННЯ ЗВЕРХУ (Capsule Glass HUD) -->
    <div class="fixed top-[90px] inset-x-0 z-50 pointer-events-none flex justify-center px-4">
      <div class="w-auto flex items-center gap-2 bg-white/55 backdrop-blur-xl py-1.5 px-3.5 rounded-full border border-gray-200/40 shadow-[0_12px_24px_rgba(13,148,136,0.05),_0_1px_1px_rgba(255,255,255,0.4)_inset] pointer-events-auto">
        
        <!-- Рядок пошуку (безваговий, прозорий, обмежений 100px) -->
        <div class="relative flex-shrink-0 w-45">
          <input
              v-model="searchQuery"
              type="text"
              placeholder="Шукати..."
              class="w-full bg-transparent border-none text-gray-700 text-xs pl-7 pr-1 py-1.5 outline-none focus:ring-0 font-medium placeholder-gray-400"
          >
          <div class="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none flex items-center justify-center">
            <SvgIcon name="search" class="w-3.5 h-3.5" />
          </div>
        </div>

        <!-- Вибір типу (круглий, скляний) -->
        <div class="relative w-full md:w-auto flex-shrink-0 border-l border-gray-200/20 pl-2">
          <button @click="isTypeMenuOpen = !isTypeMenuOpen; isSortMenuOpen = false"
                  class="w-full md:w-auto h-8 px-4 rounded-full bg-white/50 hover:bg-white/80 border border-white/40 text-[11px] font-semibold text-gray-600 flex items-center justify-between md:justify-start gap-1.5 shadow-xs cursor-pointer transition-all"
                  :class="{ 'border-teal-300/40 text-teal-700 bg-teal-55/20': currentType !== 'all' }">
            <div class="w-1.5 h-1.5 rounded-full" :class="typeDotClass"></div>
            <span>{{ typeLabel }}</span>
            <SvgIcon name="chevron-down" class="w-3 h-3 text-gray-400 transition-transform duration-200" :class="isTypeMenuOpen ? 'rotate-180' : ''" />
          </button>
          
          <transition name="menu-fade">
            <div v-show="isTypeMenuOpen" class="pointer-events-auto absolute right-0 mt-2 w-48 bg-white/90 backdrop-blur-xl border border-white/40 rounded-2xl shadow-xl py-1 z-[9999]">
              <button @click="setTypeFilter('all')" class="w-full text-left px-4 py-1.5 text-xs text-gray-700 hover:bg-gray-50 flex items-center justify-between rounded-t-xl" :class="{ 'font-semibold text-teal-600 bg-teal-50/50': currentType === 'all' }">
                <span class="flex items-center gap-2">
                  <div class="w-1.5 h-1.5 rounded-full bg-teal-500"></div>
                  Всі типи
                </span>
                <span v-if="currentType === 'all'" class="w-1.5 h-1.5 bg-teal-600 rounded-full"></span>
              </button>
              <button @click="setTypeFilter('normal')" class="w-full text-left px-4 py-1.5 text-xs text-gray-700 hover:bg-gray-50 flex items-center justify-between" :class="{ 'font-semibold text-teal-600 bg-teal-50/50': currentType === 'normal' }">
                <span class="flex items-center gap-2">
                  <div class="w-1.5 h-1.5 rounded-full bg-teal-500"></div>
                  Звичайні
                </span>
                <span v-if="currentType === 'normal'" class="w-1.5 h-1.5 bg-teal-600 rounded-full"></span>
              </button>
              <button @click="setTypeFilter('end')" class="w-full text-left px-4 py-1.5 text-xs text-gray-700 hover:bg-gray-50 flex items-center justify-between" :class="{ 'font-semibold text-red-655 bg-teal-50/50': currentType === 'end' }">
                <span class="flex items-center gap-2">
                  <div class="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                  Kінцеві
                </span>
                <span v-if="currentType === 'end'" class="w-1.5 h-1.5 bg-teal-600 rounded-full"></span>
              </button>
              <button @click="setTypeFilter('depo')" class="w-full text-left px-4 py-1.5 text-xs text-gray-700 hover:bg-gray-50 flex items-center justify-between rounded-b-xl" :class="{ 'font-semibold text-slate-700 bg-teal-50/50': currentType === 'depo' }">
                <span class="flex items-center gap-2">
                  <div class="w-1.5 h-1.5 rounded-full bg-slate-500"></div>
                  Депо
                </span>
                <span v-if="currentType === 'depo'" class="w-1.5 h-1.5 bg-teal-600 rounded-full"></span>
              </button>
            </div>
          </transition>
        </div>

      </div>
    </div>

    <!-- МОДАЛЬНЕ ВІКНО ДОДАВАННЯ ЗУПИНКИ -->
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
                <h3 class="text-2xl font-semibold text-gray-800">Нова зупинка</h3>
                <p class="text-sm text-gray-500">Створіть першу точку для нової станції</p>
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
              <label class="text-sm font-semibold text-gray-700 pl-1">Назва станції / зупинки <span class="text-red-500">*</span></label>
              <input
                v-model="formName"
                type="text"
                placeholder="Наприклад: Залізничний вокзал"
                class="w-full bg-[#F8FAFC] border text-gray-800 text-sm rounded-2xl px-4 py-3 outline-none focus:bg-white focus:border-teal-500 focus:ring-4 focus:ring-teal-50 transition-all"
                :class="validationErrors.name ? 'border-red-400 focus:border-red-400 focus:ring-red-50' : 'border-gray-200'"
                required
              >
              <p v-if="validationErrors.name" class="text-xs text-red-500 pl-1 mt-1">{{ validationErrors.name }}</p>
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
              <label class="text-sm font-semibold text-gray-700 pl-1 flex items-center justify-between">
                <span>Координати (Google Maps)</span>
              </label>
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

    <!-- ДІАЛОГ ПІДТВЕРДЖЕННЯ ВИДАЛЕННЯ ГРУПИ ЗУПИНОК -->
    <transition
      enter-active-class="transition ease-out duration-250"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition ease-in duration-200"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div v-if="isDeleteConfirmModalOpen" class="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/45 backdrop-blur-xs">
        <div class="bg-white rounded-[2rem] w-full max-w-sm p-6 shadow-2xl border border-gray-150 relative">
          <div class="flex flex-col items-center text-center">
            <div class="w-14 h-14 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4 border border-red-100 shadow-sm animate-pulse">
              <SvgIcon name="trash" class="w-6 h-6" />
            </div>
            <h3 class="text-xl font-bold text-gray-800 mb-2">Видалити зупинку?</h3>
            <p class="text-sm text-gray-500 mb-6 px-2">
              Ви впевнені, що хочете видалити <strong>всі напрямки</strong> для зупинки <strong>"{{ selectedGroupNameForDelete }}"</strong>? Цю дію неможливо буде скасувати.
            </p>
            <div class="flex w-full gap-3">
              <button
                type="button"
                @click="closeDeleteConfirmModal"
                class="flex-1 py-3 rounded-2xl text-gray-600 bg-gray-50 hover:bg-gray-100 font-semibold transition-all text-sm border border-gray-200"
              >
                Скасувати
              </button>
              <button
                type="button"
                @click="confirmDeleteGroup"
                class="flex-1 py-3 rounded-2xl text-white bg-red-500 hover:bg-red-655 font-semibold transition-all text-sm shadow-md hover:shadow-lg"
              >
                Видалити
              </button>
            </div>
          </div>
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
</style>