<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useRoutesStore, type RouteItem } from '@/stores/routes';
import SvgIcon from '@/components/ui/SvgIcon.vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const route = useRoute();
const router = useRouter();
const routesStore = useRoutesStore();
const { routes } = storeToRefs(routesStore);

// Поточний вибраний маршрут
const currentRouteId = computed(() => {
  const idParam = Number(route.params.id);
  return !isNaN(idParam) ? idParam : (routes.value[0]?.id || 1);
});

const currentRouteIndex = computed(() => {
  return routes.value.findIndex(r => r.id === currentRouteId.value);
});

const currentRoute = computed<RouteItem>(() => {
  return routes.value[currentRouteIndex.value] || routes.value[0];
});

// Сусідні маршрути для кнопок швидкого перемикання (стрілка + колір)
const prevRoute = computed<RouteItem>(() => {
  if (routes.value.length <= 1) return currentRoute.value;
  const idx = (currentRouteIndex.value - 1 + routes.value.length) % routes.value.length;
  return routes.value[idx];
});

const nextRoute = computed<RouteItem>(() => {
  if (routes.value.length <= 1) return currentRoute.value;
  const idx = (currentRouteIndex.value + 1) % routes.value.length;
  return routes.value[idx];
});

const goToRoute = (id: number) => {
  router.push({ name: 'route-detail', params: { id } });
};

const goBack = () => {
  router.push('/base/route');
};

const openConstructor = () => {
  router.push({ name: 'route-create' });
};

const deleteCurrentRoute = () => {
  if (confirm(`Ви дійсно бажаєте видалити маршрут ${currentRoute.value?.number}?`)) {
    routesStore.deleteRoute(currentRoute.value.id);
    if (routes.value.length > 0) {
      router.push({ name: 'route-detail', params: { id: routes.value[0].id } });
    } else {
      router.push('/base/route');
    }
  }
};

// ════════════════════════════════════════
// КЕРУВАННЯ ПАНЕЛЛЮ ТА МАСШТАБУВАННЯМ ГРАФА
// ════════════════════════════════════════
const zoom = ref(1);
const pan = ref({ x: 0, y: 0 });
const isDragging = ref(false);
const dragStart = ref({ x: 0, y: 0 });

const handleMouseDown = (e: MouseEvent) => {
  // Тільки лівий клік на полотні
  if (e.button !== 0) return;
  isDragging.value = true;
  dragStart.value = {
    x: e.clientX - pan.value.x,
    y: e.clientY - pan.value.y
  };
};

const handleMouseMove = (e: MouseEvent) => {
  if (!isDragging.value) return;
  pan.value = {
    x: e.clientX - dragStart.value.x,
    y: e.clientY - dragStart.value.y
  };
};

const handleMouseUp = () => {
  isDragging.value = false;
};

const handleWheel = (e: WheelEvent) => {
  e.preventDefault();
  const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
  const newZoom = Math.min(Math.max(zoom.value * zoomFactor, 0.4), 2.5);
  zoom.value = newZoom;
};

// Кнопка стрілок всередину: масштаб на повний перегляд всього маршруту
const fitRoute = () => {
  zoom.value = 0.95;
  pan.value = { x: 0, y: 0 };
};

// ════════════════════════════════════════
// КАРТА LEAFLET (МІНІ-КАРТА СПРАВА)
// ════════════════════════════════════════
const mapContainer = ref<HTMLElement | null>(null);
let miniMap: any = null;

onMounted(() => {
  if (mapContainer.value) {
    miniMap = L.map(mapContainer.value, {
      center: [50.9100, 34.8000],
      zoom: 12,
      zoomControl: false,
      attributionControl: false
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18
    }).addTo(miniMap);

    // Додаємо лінію маршруту
    const sampleCoords: [number, number][] = [
      [50.9300, 34.7700],
      [50.9238, 34.8048],
      [50.9112, 34.7960],
      [50.8996, 34.8398],
      [50.8872, 34.8475]
    ];
    
    L.polyline(sampleCoords, {
      color: currentRoute.value.color || '#2563eb',
      weight: 4,
      opacity: 0.85
    }).addTo(miniMap);

    setTimeout(() => {
      if (miniMap) miniMap.invalidateSize();
    }, 200);
  }
});

onBeforeUnmount(() => {
  if (miniMap) {
    miniMap.remove();
    miniMap = null;
  }
});
</script>

<template>
  <div class="route-preview-container fixed inset-0 w-screen h-screen bg-[#F8FAFC] flex overflow-hidden select-none">

    <!-- ════════════════════════════════════════
         КНОПКИ НАВІГАЦІЇ ТА ШВИДКОГО ПЕРЕМИКАННЯ
    ════════════════════════════════════════ -->
    <div class="absolute top-6 left-6 z-50 flex items-center gap-3">
      <!-- Назад до списку -->
      <button 
        @click="goBack"
        class="w-10 h-10 rounded-xl bg-white border border-gray-200 shadow-sm flex items-center justify-center text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-all cursor-pointer"
        title="Назад до списку маршрутів"
      >
        <SvgIcon name="arrow-left" class="w-4 h-4" />
      </button>

      <!-- Блок перемикання між маршрутами (Стрілки з кольоровими кружечками) -->
      <div class="flex flex-col gap-1.5 bg-white border border-gray-200/90 rounded-2xl p-1.5 shadow-sm backdrop-blur-md">
        <!-- Попередній маршрут: червона крапка + стрілка ліворуч -->
        <button 
          @click="goToRoute(prevRoute.id)"
          class="flex items-center gap-1.5 px-2.5 py-1 rounded-xl hover:bg-gray-100/80 transition-all cursor-pointer border-none bg-transparent"
          :title="`Перейти до маршруту ${prevRoute.number}`"
        >
          <span class="w-3 h-3 rounded-full flex-shrink-0 shadow-xs" :style="{ backgroundColor: prevRoute.color || '#EF4444' }"></span>
          <span class="text-xs text-gray-500 font-bold">←</span>
        </button>

        <!-- Наступний маршрут: стрілка праворуч + зелена крапка -->
        <button 
          @click="goToRoute(nextRoute.id)"
          class="flex items-center gap-1.5 px-2.5 py-1 rounded-xl hover:bg-gray-100/80 transition-all cursor-pointer border-none bg-transparent"
          :title="`Перейти до маршруту ${nextRoute.number}`"
        >
          <span class="text-xs text-gray-500 font-bold">→</span>
          <span class="w-3 h-3 rounded-full flex-shrink-0 shadow-xs" :style="{ backgroundColor: nextRoute.color || '#10B981' }"></span>
        </button>
      </div>

      <!-- Квадратний бейдж поточного маршруту -->
      <div 
        class="h-14 w-14 rounded-2xl text-white font-black text-xl flex items-center justify-center text-center shadow-md select-none tracking-tight"
        :style="{ backgroundColor: currentRoute.color || '#2563eb' }"
      >
        {{ currentRoute.number }}
      </div>

      <!-- Кнопки масштабу: Центрувати та вписати весь маршрут (Стрілки всередину) -->
      <div class="flex flex-col gap-1 bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
        <button 
          @click="fitRoute"
          class="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-600 hover:text-gray-900 transition-colors cursor-pointer border-none bg-transparent"
          title="Масштаб на перегляд всього маршруту"
        >
          <!-- Іконка стрілок всередину (Fit to screen) -->
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 14h6v6m10-10h-6V4m0 6 7-7M10 14l-7 7"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- ════════════════════════════════════════
         ІНТЕРАКТИВНЕ СЕРЕДОВИЩЕ ПЕРЕГЛЯДУ (PAN & ZOOM)
    ════════════════════════════════════════ -->
    <div 
      class="flex-1 h-full relative cursor-grab active:cursor-grabbing overflow-hidden"
      @mousedown="handleMouseDown"
      @mousemove="handleMouseMove"
      @mouseup="handleMouseUp"
      @mouseleave="handleMouseUp"
      @wheel="handleWheel"
    >
      <div 
        class="absolute inset-0 flex items-center justify-center pointer-events-none transition-transform duration-75"
        :style="{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }"
      >
        <!-- Векторний граф маршруту (Овал з кінцевими, контрольними та проміжними зупинками) -->
        <svg class="w-[540px] h-[760px] overflow-visible pointer-events-auto" viewBox="0 0 460 720">
          
          <!-- Траєкторія руху: П-подібна або замкнена петля із заокругленнями -->
          <!-- Правий напрямок (спуск) та Лівий напрямок (підйом) -->
          <path 
            d="M 160 90 A 70 70 0 0 1 300 90 L 300 610 A 70 70 0 0 1 160 610 L 160 90 Z" 
            fill="none" 
            :stroke="currentRoute.color || '#2563eb'" 
            stroke-width="7" 
            stroke-linecap="round"
            stroke-linejoin="round"
          />

          <!-- Стрілки напрямку руху -->
          <g transform="translate(310, 80) rotate(35)" fill="none" stroke="#94A3B8" stroke-width="2.5" stroke-linecap="round">
            <path d="M 0 0 C 15 15, 20 30, 20 45" />
            <path d="M 14 45 L 20 48 L 24 40" />
          </g>
          <g transform="translate(135, 600) rotate(215)" fill="none" stroke="#94A3B8" stroke-width="2.5" stroke-linecap="round">
            <path d="M 0 0 C 15 15, 20 30, 20 45" />
            <path d="M 14 45 L 20 48 L 24 40" />
          </g>

          <!-- ══════ ТОП ТЕРМІНУС (КІНЦЕВА 1) ══════ -->
          <g transform="translate(230, 20)">
            <circle cx="0" cy="0" r="13" fill="#FFFFFF" stroke="#0F172A" stroke-width="4.5" />
            <text x="0" y="-22" text-anchor="middle" class="font-bold text-sm fill-slate-900">Кінцева 1</text>
            <!-- Іконка нічліг/відпочинок під кільцем -->
            <g transform="translate(-8, 16) scale(0.65)" fill="#64748B">
              <SvgIcon name="bed" class="w-6 h-6" />
            </g>
          </g>

          <!-- ══════ БОТТОМ ТЕРМІНУС (КІНЦЕВА 2) ══════ -->
          <g transform="translate(230, 680)">
            <circle cx="0" cy="0" r="13" fill="#FFFFFF" stroke="#0F172A" stroke-width="4.5" />
            <text x="0" y="32" text-anchor="middle" class="font-bold text-sm fill-slate-900">Кінцева 2</text>
            <!-- Іконки обід / депо / відпочинок над кільцем -->
            <g transform="translate(-24, -28) scale(0.75)" fill="#64748B" class="flex gap-1">
              <SvgIcon name="lunch" class="w-5 h-5 inline" />
              <SvgIcon name="depot" class="w-5 h-5 inline" />
              <SvgIcon name="bed" class="w-5 h-5 inline" />
            </g>
          </g>

          <!-- ══════ ПРАВА СТОРОНА (СПУСК) ══════ -->
          <!-- Контрольна 1 -->
          <g transform="translate(300, 115)">
            <circle cx="0" cy="0" r="8" fill="#FFFFFF" :stroke="currentRoute.color || '#2563eb'" stroke-width="3.5" />
            <text x="18" y="4" class="font-bold text-xs fill-slate-800">Контрольна 1</text>
          </g>

          <!-- Проміжні зупинки справа -->
          <g transform="translate(300, 160)">
            <rect x="-4.5" y="-4.5" width="9" height="9" rx="2" fill="#3B82F6" />
            <text x="18" y="4" class="text-[11px] font-medium fill-slate-500">Зупинка</text>
          </g>
          <g transform="translate(300, 195)">
            <rect x="-4.5" y="-4.5" width="9" height="9" rx="2" fill="#3B82F6" />
            <text x="18" y="4" class="text-[11px] font-medium fill-slate-500">Зупинка</text>
          </g>
          <g transform="translate(300, 230)">
            <rect x="-4.5" y="-4.5" width="9" height="9" rx="2" fill="#3B82F6" />
            <text x="18" y="4" class="text-[11px] font-medium fill-slate-500">Зупинка</text>
          </g>
          <g transform="translate(300, 265)">
            <rect x="-4.5" y="-4.5" width="9" height="9" rx="2" fill="#3B82F6" />
            <text x="18" y="4" class="text-[11px] font-medium fill-slate-500">Зупинка</text>
          </g>

          <!-- Контрольна 2 -->
          <g transform="translate(300, 315)">
            <circle cx="0" cy="0" r="8" fill="#FFFFFF" :stroke="currentRoute.color || '#2563eb'" stroke-width="3.5" />
            <text x="18" y="4" class="font-bold text-xs fill-slate-800">Контрольна 2</text>
          </g>

          <!-- Ще зупинки справа -->
          <g transform="translate(300, 360)">
            <rect x="-4.5" y="-4.5" width="9" height="9" rx="2" fill="#3B82F6" />
            <text x="18" y="4" class="text-[11px] font-medium fill-slate-500">Зупинка</text>
          </g>
          <g transform="translate(300, 395)">
            <rect x="-4.5" y="-4.5" width="9" height="9" rx="2" fill="#3B82F6" />
            <text x="18" y="4" class="text-[11px] font-medium fill-slate-500">Зупинка</text>
          </g>
          <g transform="translate(300, 430)">
            <rect x="-4.5" y="-4.5" width="9" height="9" rx="2" fill="#3B82F6" />
            <text x="18" y="4" class="text-[11px] font-medium fill-slate-500">Зупинка</text>
          </g>
          <g transform="translate(300, 465)">
            <rect x="-4.5" y="-4.5" width="9" height="9" rx="2" fill="#3B82F6" />
            <text x="18" y="4" class="text-[11px] font-medium fill-slate-500">Зупинка</text>
          </g>
          <g transform="translate(300, 500)">
            <rect x="-4.5" y="-4.5" width="9" height="9" rx="2" fill="#3B82F6" />
            <text x="18" y="4" class="text-[11px] font-medium fill-slate-500">Зупинка</text>
          </g>

          <!-- Контрольна 3 -->
          <g transform="translate(300, 580)">
            <circle cx="0" cy="0" r="8" fill="#FFFFFF" :stroke="currentRoute.color || '#2563eb'" stroke-width="3.5" />
            <text x="18" y="4" class="font-bold text-xs fill-slate-800">Контрольна 3</text>
          </g>

          <!-- ══════ ЛІВА СТОРОНА (ПІДЙОМ) ══════ -->
          <!-- Контрольна 1 зліва -->
          <g transform="translate(160, 120)">
            <circle cx="0" cy="0" r="8" fill="#FFFFFF" :stroke="currentRoute.color || '#2563eb'" stroke-width="3.5" />
            <text x="-18" y="4" text-anchor="end" class="font-bold text-xs fill-slate-800">Контрольна 1</text>
          </g>

          <!-- Проміжні зупинки зліва -->
          <g transform="translate(160, 195)">
            <rect x="-4.5" y="-4.5" width="9" height="9" rx="2" fill="#3B82F6" />
            <text x="-18" y="4" text-anchor="end" class="text-[11px] font-medium fill-slate-500">Зупинка</text>
          </g>
          <g transform="translate(160, 280)">
            <rect x="-4.5" y="-4.5" width="9" height="9" rx="2" fill="#3B82F6" />
            <text x="-18" y="4" text-anchor="end" class="text-[11px] font-medium fill-slate-500">Зупинка</text>
          </g>
          <g transform="translate(160, 365)">
            <rect x="-4.5" y="-4.5" width="9" height="9" rx="2" fill="#3B82F6" />
            <text x="-18" y="4" text-anchor="end" class="text-[11px] font-medium fill-slate-500">Зупинка</text>
          </g>
          <g transform="translate(160, 450)">
            <rect x="-4.5" y="-4.5" width="9" height="9" rx="2" fill="#3B82F6" />
            <text x="-18" y="4" text-anchor="end" class="text-[11px] font-medium fill-slate-500">Зупинка</text>
          </g>

          <!-- Контрольна 2 зліва -->
          <g transform="translate(160, 580)">
            <circle cx="0" cy="0" r="8" fill="#FFFFFF" :stroke="currentRoute.color || '#2563eb'" stroke-width="3.5" />
            <text x="-18" y="4" text-anchor="end" class="font-bold text-xs fill-slate-800">Контрольна 2</text>
          </g>

        </svg>
      </div>
    </div>

    <!-- ════════════════════════════════════════
         ПРАВА ІНФОРМАЦІЙНА ПАНЕЛЬ
    ════════════════════════════════════════ -->
    <div class="w-[430px] h-full bg-white border-l border-gray-200/80 p-7 flex flex-col justify-between overflow-y-auto shadow-xl z-20">
      <div class="space-y-5">
        
        <!-- Заголовок маршруту з кольоровим бейджем -->
        <div class="flex items-center justify-between gap-3">
          <div>
            <h1 class="text-2xl font-bold font-serif italic text-slate-800 tracking-tight">Тролейбусний маршрут</h1>
            <p class="text-xs text-gray-500 font-semibold mt-0.5">Кінцева 1 ⇆ Кінцева 2</p>
          </div>
          <div 
            class="h-10 w-10 rounded-xl text-white font-black text-base flex items-center justify-center text-center shadow-xs select-none flex-shrink-0"
            :style="{ backgroundColor: currentRoute.color || '#2563eb' }"
          >
            {{ currentRoute.number }}
          </div>
        </div>

        <!-- Рядок параметрів (іконки та показники) -->
        <div class="bg-slate-50/80 border border-slate-200/60 rounded-2xl p-3 flex items-center justify-between text-xs font-bold text-slate-700">
          <div class="flex items-center gap-1.5" title="Кількість точок">
            <span class="text-gray-400">📍</span>
            <span>15</span>
          </div>
          <div class="flex items-center gap-1" title="Коефіцієнт/відгалуження">
            <span class="text-gray-400">⚡</span>
            <span>0</span>
          </div>
          <div class="flex items-center gap-1.5 font-black text-slate-900" title="Час обороту">
            <SvgIcon name="clock" class="w-3.5 h-3.5 text-blue-500" />
            <span>109 хв</span>
          </div>
          <div class="flex items-center gap-1" title="Режими">
            <span class="text-gray-400">📋</span>
            <span>1 2 5</span>
          </div>
          <div class="flex items-center gap-1" title="Відпочинок">
            <SvgIcon name="bed" class="w-3.5 h-3.5 text-gray-500" />
            <span>2</span>
          </div>
          <div class="flex items-center gap-1" title="Обід">
            <SvgIcon name="lunch" class="w-3.5 h-3.5 text-gray-500" />
            <span>1</span>
          </div>
          <div class="flex items-center gap-1" title="Депо">
            <SvgIcon name="depot" class="w-3.5 h-3.5 text-gray-500" />
            <span>1</span>
          </div>
        </div>

        <!-- Час роботи кінцевих (картки) -->
        <div class="space-y-2 text-xs">
          <div class="bg-slate-50/60 border border-slate-200/70 rounded-2xl px-4 py-2.5 flex items-center justify-between">
            <span class="font-bold text-slate-800">Кінцева 1</span>
            <div class="flex items-center gap-3 text-slate-600 font-semibold text-[11px]">
              <span>5:50-6:00</span>
              <span>21:30-22:00</span>
            </div>
          </div>

          <div class="bg-slate-50/60 border border-slate-200/70 rounded-2xl px-4 py-2.5 flex items-center justify-between">
            <span class="font-bold text-slate-800">Кінцева 2</span>
            <div class="flex items-center gap-3 text-slate-600 font-semibold text-[11px]">
              <span>5:50-6:00</span>
              <span>21:30-22:00</span>
            </div>
          </div>
        </div>

        <!-- Міні-карта Leaflet -->
        <div class="rounded-3xl border border-gray-200/80 overflow-hidden shadow-sm h-52 relative">
          <div ref="mapContainer" class="w-full h-full"></div>
        </div>

      </div>

      <!-- Нижні кнопки дій: Часові дані, Редагувати, Видалити -->
      <div class="flex items-center gap-3 pt-6 border-t border-gray-100">
        <button 
          @click="openConstructor"
          class="flex-1 py-3 px-3 rounded-2xl bg-[#E0E7FF] hover:bg-[#C7D2FE] text-[#3730A3] font-bold text-xs transition-colors cursor-pointer border-none shadow-xs text-center"
        >
          Часові дані
        </button>

        <button 
          @click="openConstructor"
          class="flex-1 py-3 px-3 rounded-2xl bg-[#FEF08A] hover:bg-[#FDE047] text-[#854D0E] font-bold text-xs transition-colors cursor-pointer border-none shadow-xs text-center"
        >
          Редагувати
        </button>

        <button 
          @click="deleteCurrentRoute"
          class="flex-1 py-3 px-3 rounded-2xl bg-[#FECDD3] hover:bg-[#FDA4AF] text-[#9F1239] font-bold text-xs transition-colors cursor-pointer border-none shadow-xs text-center"
        >
          Видалити
        </button>
      </div>

    </div>

  </div>
</template>

<style scoped>
.route-preview-container {
  background-image: radial-gradient(#E2E8F0 1.2px, transparent 1.2px);
  background-size: 24px 24px;
}
</style>
