<script setup lang="ts">
import { ref, computed } from 'vue'
import SvgIcon from '@/components/ui/SvgIcon.vue'

// Props
const props = defineProps<{
  displayedStops: any[]
  stopsList: any[]
}>()

// === Логіка для кругової діаграми розподілу зупинок за типами ===
const hoveredSlice = ref<any>(null)

const pieSlices = computed(() => {
  if (props.displayedStops.length === 0) return []

  const types = [
    { label: 'Звичайні', value: 'normal', color: '#ccfbf1', stops: [] as any[] },
    { label: 'Кінцеві', value: 'end', color: '#99f6e4', stops: [] as any[] },
    { label: 'Депо', value: 'depo', color: '#2dd4bf', stops: [] as any[] }
  ]

  props.displayedStops.forEach(stop => {
    const foundType = types.find(t => t.value === stop.type)
    if (foundType) {
      foundType.stops.push(stop)
    } else {
      types[0].stops.push(stop)
    }
  })

  // Фільтруємо ті типи, яких немає у списку
  const activeTypes = types.filter(t => t.stops.length > 0)
  
  const totalCount = activeTypes.reduce((acc, t) => acc + t.stops.length, 0)
  let cumulativeFraction = 0

  return activeTypes.map((t) => {
    const fraction = totalCount > 0 ? t.stops.length / totalCount : 0

    const startAngle = cumulativeFraction * 2 * Math.PI
    const startX = Math.cos(startAngle)
    const startY = Math.sin(startAngle)

    cumulativeFraction += fraction

    const endAngle = cumulativeFraction * 2 * Math.PI
    const endX = Math.cos(endAngle)
    const endY = Math.sin(endAngle)

    const largeArcFlag = fraction > 0.5 ? 1 : 0

    const pathData = fraction === 1
        ? `M 1 0 A 1 1 0 1 1 1 -0.001 Z`
        : `M 0 0 L ${startX} ${startY} A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY} Z`

    const getStopWord = (count: number) => {
      if (count === 1) return 'зупинка'
      if (count >= 2 && count <= 4) return 'зупинки'
      return 'зупинок'
    }

    const stopWord = getStopWord(t.stops.length)
    const stopsText = t.stops.map(s => s.name).slice(0, 5).join(', ') + 
      (t.stops.length > 5 ? ` та ще ${t.stops.length - 5}` : '')

    return {
      type: t.label,
      count: t.stops.length,
      stopWord,
      stopsText,
      color: t.color,
      pathData
    }
  })
})

// Кінцеві зупинки для правого віджета
const endStops = computed(() => {
  return props.displayedStops.filter(s => s.type === 'end')
})
</script>

<template>
  <!-- ЛІВА ЧАСТИНА: Віджети статистики зупинок -->
  <div class="flex flex-col sm:flex-row gap-4 w-full lg:w-auto relative z-10">

    <!-- Віджет "Типи зупинок" -->
    <div class="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex items-center gap-4 w-full sm:w-[22rem]">
      <div class="relative flex-shrink-0" @mouseleave="hoveredSlice = null">

        <svg viewBox="-1 -1 2 2" class="w-20 h-20 transform -rotate-90 rounded-full overflow-hidden">
          <path
              v-for="slice in pieSlices"
              :key="'slice-' + slice.type"
              :d="slice.pathData"
              :fill="slice.color"
              :stroke="slice.color"
              stroke-width="0.015"
              stroke-linejoin="round"
              class="transition-opacity duration-200 cursor-pointer hover:opacity-85 outline-none"
              @mouseenter="hoveredSlice = slice"
          />
        </svg>

        <!-- Повідомлення порожньої діаграми -->
        <div v-if="pieSlices.length === 0" class="absolute inset-0 bg-gray-50 rounded-full flex items-center justify-center text-gray-400">
          <SvgIcon name="empty-chart" class="w-6 h-6" />
        </div>

        <div class="absolute inset-0 rounded-full shadow-inner pointer-events-none border border-black/5"></div>

        <!-- Тултип -->
        <div
            v-show="hoveredSlice"
            class="absolute z-50 pointer-events-none flex flex-col items-center transform transition-all duration-150 ease-out bottom-full left-1/2 -translate-x-1/2 mb-2"
            :class="hoveredSlice ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'"
        >
          <div class="relative z-10 w-max max-w-[220px] bg-white/80 backdrop-blur-md border border-white/60 text-xs rounded-xl px-3 py-2.5 shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
            <div class="font-semibold text-teal-700 mb-1">
              {{ hoveredSlice?.type }} <span class="text-gray-500 font-normal">({{ hoveredSlice?.count }} {{ hoveredSlice?.stopWord }})</span>
            </div>
            <div class="text-gray-700 leading-relaxed whitespace-normal break-words">
              {{ hoveredSlice?.stopsText }}
            </div>
          </div>
          <div class="w-3 h-3 bg-white/80 backdrop-blur-md border-b border-r border-white/60 transform rotate-45 -mt-1.5 shadow-sm relative z-0"></div>
        </div>

      </div>

      <div class="flex-1 min-w-0">
        <h3 class="text-sm font-semibold text-gray-800 leading-tight">Розподіл зупинок</h3>
        <p class="text-[10px] text-gray-400 mt-0.5 mb-2">За типом призначення</p>
        
        <!-- Легенда діаграми -->
        <div class="space-y-1">
          <div 
              v-for="slice in pieSlices" 
              :key="'legend-' + slice.type" 
              class="flex items-center gap-2 text-[11px] text-gray-600 hover:text-gray-900 transition-colors"
          >
            <div class="w-2.5 h-2.5 rounded-full flex-shrink-0" :style="{ backgroundColor: slice.color }"></div>
            <span class="font-medium truncate">{{ slice.type }}</span>
            <span class="text-gray-400 ml-auto flex-shrink-0">({{ slice.count }})</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Віджет "Кінцеві станції" -->
    <div class="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm w-full sm:w-64 flex flex-col justify-between">
      <div class="flex justify-between items-center border-b border-gray-100 pb-2 mb-2">
        <h3 class="text-sm font-semibold text-gray-800">Кінцеві станції</h3>
        <span class="text-xs font-medium bg-teal-50 text-teal-600 px-2 py-0.5 rounded-full">Активні</span>
      </div>
      <ul class="text-sm text-gray-600 space-y-1.5 overflow-y-auto max-h-20 pr-1">
        <li v-for="stop in endStops" :key="'end-' + stop.stopId" class="flex justify-between items-center">
          <span class="flex items-center gap-1.5 truncate">
            <div class="w-1.5 h-1.5 bg-teal-500 rounded-full shadow-[0_0_4px_#14b8a6]"></div>
            {{ stop.name }}
          </span>
          <span class="text-xs text-gray-400 flex-shrink-0 ml-1">№{{ stop.directionCode }}</span>
        </li>
        <li v-if="endStops.length === 0" class="text-xs text-gray-400 text-center py-2">
          Немає кінцевих зупинок
        </li>
      </ul>
    </div>

  </div>
</template>
