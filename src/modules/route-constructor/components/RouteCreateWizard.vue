<template>
  <div class="fixed inset-0 z-[120] flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm p-6 select-none animate-in fade-in duration-300"
       @keydown.left="handleBack"
       @keydown.right="handleNext"
       @keydown.enter="handleNext"
       @keydown.esc="$emit('cancel')">

    <!-- Subtle cancel button in top-right -->
    <button type="button"
            @click="$emit('cancel')"
            class="absolute top-6 right-6 w-9 h-9 rounded-full bg-gray-100/80 hover:bg-gray-200/90 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
            title="Скасувати створення">
      ✕
    </button>

    <!-- Main Centered Content Box (Borderless, Minimalist) -->
    <div class="w-full max-w-[520px] flex flex-col items-center justify-center">

      <!-- Section Title & Subtitle ("Кожен розділ має мати назву") with smooth fade -->
      <div class="text-center mb-6 min-h-[58px] flex flex-col items-center justify-center">
        <transition name="wizard-title" mode="out-in">
          <div :key="currentStep" class="flex flex-col items-center">
            <h2 class="text-xl font-extrabold text-gray-900 tracking-tight">
              {{ stepTitles[currentStep - 1] }}
            </h2>
            <p class="text-xs text-gray-500 mt-1">
              {{ stepSubtitles[currentStep - 1] }}
            </p>
          </div>
        </transition>
      </div>

      <!-- Step Content Area with smooth directional slide & ample padding to prevent clipping -->
      <div class="w-full min-h-[250px] flex items-center justify-center overflow-hidden px-3 py-2">
        <transition :name="slideDirection === 'forward' ? 'wizard-slide-forward' : 'wizard-slide-backward'" mode="out-in">

          <!-- ════════════════════════════════════════
               STEP 1: TRANSPORT TYPE (Trolleybus vs Bus)
          ════════════════════════════════════════ -->
          <div v-if="currentStep === 1" key="step1" class="w-full flex items-center justify-center gap-4">
            <!-- Trolleybus Card -->
            <div @click="selectTransport('trolleybus')"
                 class="flex-1 flex flex-col items-center justify-between p-6 h-[220px] rounded-[28px] cursor-pointer transition-all duration-200 border-2"
                 :class="form.transportType === 'trolleybus'
                   ? 'bg-white shadow-sm border-blue-500'
                   : 'bg-[#f4f4f6] border-transparent hover:bg-gray-200/60'">
              <div class="text-base font-bold italic tracking-tight text-gray-900 text-center select-none leading-snug">
                Тролейбусний<br />маршрут
              </div>

              <!-- Schematic: single solid thick black line + terminal circle (thick bar without vertical stick) -->
              <svg width="138" height="36" viewBox="0 0 138 36" fill="none" class="my-auto overflow-visible">
                <!-- Main route line (thick solid bar running right into destination circle) -->
                <line x1="16" y1="18" x2="118" y2="18" stroke="#1c1c1e" stroke-width="9" stroke-linecap="round" class="drive-line" />
                <!-- End destination circle node -->
                <circle cx="118" cy="18" r="9" stroke="#1c1c1e" stroke-width="4.5" fill="white" class="drive-circle" />
              </svg>

              <!-- Bottom Pill Button (Visual selection + blue confirmation when selected) -->
              <button type="button"
                      @click.stop="form.transportType === 'trolleybus' ? confirmStep1() : selectTransport('trolleybus')"
                      class="w-28 h-7 rounded-full transition-all duration-200 flex items-center justify-center text-xs font-bold cursor-pointer active:scale-95"
                      :class="form.transportType === 'trolleybus'
                        ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md'
                        : 'bg-[#d1d1d6] text-gray-600 hover:bg-gray-300'">
                <span>{{ form.transportType === 'trolleybus' ? 'Підтвердити' : 'Обрати' }}</span>
                <span v-if="form.transportType === 'trolleybus'" class="ml-1">→</span>
              </button>
            </div>

            <!-- Bus Card -->
            <div @click="selectTransport('bus')"
                 class="flex-1 flex flex-col items-center justify-between p-6 h-[220px] rounded-[28px] cursor-pointer transition-all duration-200 border-2"
                 :class="form.transportType === 'bus'
                   ? 'bg-white shadow-sm border-blue-500'
                   : 'bg-[#f4f4f6] border-transparent hover:bg-gray-200/60'">
              <div class="text-base font-bold italic tracking-tight text-gray-900 text-center select-none leading-snug">
                Автобусний<br />маршрут
              </div>

              <!-- Schematic: thick route line with white center line + terminal circle (bus style) -->
              <svg width="138" height="36" viewBox="0 0 138 36" fill="none" class="my-auto overflow-visible">
                <!-- Outer thick dark line running right into destination circle -->
                <line x1="16" y1="18" x2="118" y2="18" stroke="#1c1c1e" stroke-width="9" stroke-linecap="round" class="drive-line" />
                <!-- White center line running along the bus route -->
                <line x1="16" y1="18" x2="118" y2="18" stroke="#ffffff" stroke-width="2.8" stroke-linecap="round" class="drive-line" />
                <!-- End destination circle node -->
                <circle cx="118" cy="18" r="9" stroke="#1c1c1e" stroke-width="4.5" fill="white" class="drive-circle" />
              </svg>

              <!-- Bottom Pill Button (Visual selection + blue confirmation when selected) -->
              <button type="button"
                      @click.stop="form.transportType === 'bus' ? confirmStep1() : selectTransport('bus')"
                      class="w-28 h-7 rounded-full transition-all duration-200 flex items-center justify-center text-xs font-bold cursor-pointer active:scale-95"
                      :class="form.transportType === 'bus'
                        ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md'
                        : 'bg-[#d1d1d6] text-gray-600 hover:bg-gray-300'">
                <span>{{ form.transportType === 'bus' ? 'Підтвердити' : 'Обрати' }}</span>
                <span v-if="form.transportType === 'bus'" class="ml-1">→</span>
              </button>
            </div>
          </div>

          <!-- ════════════════════════════════════════
               STEP 2: ROUTE NUMBER, LETTER & COLOR
          ════════════════════════════════════════ -->
          <div v-else-if="currentStep === 2" key="step2" class="w-full flex flex-col gap-5">
            <!-- Top row: Live Preview Badge + Inputs -->
            <div class="flex items-center gap-4">
              <!-- Route Badge Preview -->
              <div class="w-16 h-16 rounded-[22px] flex items-center justify-center text-white font-black text-2xl tracking-tight transition-all duration-300 shadow-xs shrink-0 select-none"
                   :style="{ backgroundColor: form.color }">
                {{ (form.number || '1') + (form.letter || '') }}
              </div>

              <!-- Inputs for Number & Letter -->
              <div class="grid grid-cols-2 gap-3 flex-1">
                <div>
                  <label class="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">НОМЕР МАРШРУТУ</label>
                  <input v-model="form.number"
                         type="text"
                         maxlength="4"
                         placeholder="1"
                         class="w-full text-center text-base font-bold bg-[#f4f4f6] border border-gray-200/80 rounded-2xl py-2.5 text-gray-900 focus:outline-none focus:bg-white focus:border-blue-500 transition-all duration-200" />
                </div>
                <div>
                  <label class="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">БУКВА (ОПЦІЯ)</label>
                  <input v-model="form.letter"
                         type="text"
                         maxlength="2"
                         placeholder="А"
                         class="w-full text-center text-base font-bold bg-[#f4f4f6] border border-gray-200/80 rounded-2xl py-2.5 text-gray-900 focus:outline-none focus:bg-white focus:border-blue-500 transition-all duration-200" />
                </div>
              </div>
            </div>

            <!-- Color Swatches Row -->
            <div>
              <label class="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-2">КОЛІР МАРШРУТУ</label>
              <div class="flex items-center gap-2.5 flex-wrap">
                <button v-for="c in presetColors" :key="c"
                        type="button"
                        @click="form.color = c"
                        class="w-8 h-8 rounded-full transition-all duration-250 flex items-center justify-center text-white text-xs font-bold shadow-xs cursor-pointer active:scale-95"
                        :class="form.color.toLowerCase() === c.toLowerCase() ? 'scale-110 ring-2 ring-offset-2 ring-gray-400' : 'hover:scale-105'"
                        :style="{ backgroundColor: c }">
                  <span v-if="form.color.toLowerCase() === c.toLowerCase()">✓</span>
                </button>

                <!-- Custom color button with Pipette ("для останнього кольору") -->
                <label class="w-8 h-8 rounded-full border border-gray-200/90 relative flex items-center justify-center cursor-pointer shadow-xs transition-all duration-250 shrink-0 active:scale-95"
                       :class="isCustomColor ? 'scale-110 ring-2 ring-offset-2 ring-gray-400' : 'hover:scale-105'"
                       :style="isCustomColor ? { backgroundColor: form.color } : { backgroundColor: '#f4f4f6' }"
                       title="Обрати власний колір">
                  <svg width="15" height="17" viewBox="0 0 20 22" fill="none" xmlns="http://www.w3.org/2000/svg" class="transition-colors duration-200">
                    <path d="M1.16244 20.0561C2.69174 21.5854 4.4847 21.603 5.98763 20.1001C7.03353 19.0542 8.12338 16.6372 8.94076 15.6176L10.7689 17.4546C11.5072 18.2016 12.4124 18.2016 13.1331 17.4809L14.2933 16.312C14.8734 15.7319 14.9876 15.0463 14.6185 14.4135L18.2572 10.7749C19.2855 9.74654 19.2591 8.51608 18.2132 7.47018L11.305 0.553185C10.2943 -0.457558 8.60678 -0.0444716 8.264 1.47604C7.56088 4.52584 7.42904 5.24654 6.62045 6.50338C6.04037 6.25729 5.42513 6.39791 4.89779 6.92525L3.73763 8.08541C3.01693 8.80611 3.01693 9.7026 3.764 10.4497L5.59213 12.2778C4.59017 13.0952 2.16439 14.185 1.11849 15.2309C-0.384436 16.7338 -0.375647 18.5268 1.16244 20.0561ZM12.597 9.88717C13.0277 10.3178 15.3392 9.07858 16.3412 7.99752L16.974 8.62154C17.3343 8.99068 17.3343 9.39498 16.9915 9.73775L13.5199 13.2182L7.89486 7.58443C8.88803 6.05514 9.0726 4.93893 9.77572 2.34615C9.8724 1.95943 10.1888 1.85397 10.4525 2.11764L14.5306 6.19576C14.3021 7.59322 13.5374 8.63033 12.6146 9.55318C12.5003 9.65865 12.5179 9.80807 12.597 9.88717ZM5.17025 9.05221L5.8558 8.38424C6.04916 8.19088 6.2601 8.18209 6.46224 8.38424L12.8343 14.7563C13.0277 14.9497 13.0277 15.1694 12.8255 15.3628L12.1663 16.0395C11.9642 16.2417 11.7445 16.2505 11.5423 16.0483L9.43295 13.9213C9.0726 13.561 8.5892 13.5962 8.17611 13.9917C7.49056 14.6684 6.29525 17.5424 4.89779 18.9399C4.09799 19.7485 3.13119 19.7397 2.29623 18.9223C1.47885 18.0874 1.47885 17.1118 2.27865 16.3208C3.6849 14.9233 6.55013 13.728 7.22689 13.0424C7.6224 12.6294 7.65756 12.146 7.2972 11.7856L5.17025 9.66744C4.97689 9.46529 4.97689 9.25436 5.17025 9.05221ZM3.57943 18.6938C4.15072 18.6938 4.61654 18.228 4.61654 17.6567C4.61654 17.0854 4.15072 16.6108 3.57943 16.6108C2.99935 16.6108 2.53353 17.0854 2.53353 17.6567C2.53353 18.228 2.99935 18.6938 3.57943 18.6938Z"
                          :fill="isCustomColor ? '#ffffff' : '#1C1C1E'"/>
                  </svg>
                  <input type="color" v-model="form.color" class="opacity-0 absolute inset-0 cursor-pointer w-full h-full" />
                </label>
              </div>
            </div>
          </div>

          <!-- ════════════════════════════════════════
               STEP 3: FIRST TIME PERIOD (06:00 - 09:00)
          ════════════════════════════════════════ -->
          <div v-else-if="currentStep === 3" key="step3" class="w-full flex flex-col gap-3">
            <label class="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">ЧАСОВИЙ ДІАПАЗОН ДОБИ</label>
            
            <div class="flex items-center gap-3">
              <!-- Start Time -->
              <div class="flex-1">
                <span class="text-[11px] text-gray-400 block mb-1">Початок</span>
                <div class="bg-[#f4f4f6] border border-gray-200/80 rounded-2xl px-4 py-2.5 flex items-center justify-between focus-within:bg-white focus-within:border-blue-500 transition-all duration-200">
                  <input v-model="form.timeStart"
                         type="text"
                         maxlength="5"
                         placeholder="06:00"
                         class="text-base font-bold text-gray-900 bg-transparent focus:outline-none w-full" />
                  <svg class="w-4 h-4 text-gray-500 shrink-0 ml-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                  </svg>
                </div>
              </div>

              <span class="text-gray-400 font-bold self-end mb-3.5">—</span>

              <!-- End Time -->
              <div class="flex-1">
                <span class="text-[11px] text-gray-400 block mb-1">Кінець</span>
                <div class="bg-[#f4f4f6] border border-gray-200/80 rounded-2xl px-4 py-2.5 flex items-center justify-between focus-within:bg-white focus-within:border-blue-500 transition-all duration-200">
                  <input v-model="form.timeEnd"
                         type="text"
                         maxlength="5"
                         placeholder="09:00"
                         class="text-base font-bold text-gray-900 bg-transparent focus:outline-none w-full" />
                  <svg class="w-4 h-4 text-gray-500 shrink-0 ml-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                  </svg>
                </div>
              </div>
            </div>
          </div>

          <!-- ════════════════════════════════════════
               STEP 4: TERMINI COUNT (1 vs 2) & NAMES
          ════════════════════════════════════════ -->
          <div v-else-if="currentStep === 4" key="step4" class="w-full flex flex-col gap-4">
            <label class="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">ОБЕРІТЬ СТРУКТУРУ КІНЦЕВИХ ТОЧОК</label>

            <div class="flex flex-col gap-3">
              <!-- 2 Termini Option (Classic) -->
              <div @click="form.terminiCount = 2"
                   class="rounded-2xl p-4 flex items-start gap-3.5 cursor-pointer transition-all duration-250 border-2"
                   :class="form.terminiCount === 2
                     ? 'border-blue-500 bg-white shadow-xs'
                     : 'border-transparent bg-[#f4f4f6] hover:bg-gray-200/60'">
                <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold text-base transition-colors duration-250"
                     :class="form.terminiCount === 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'">
                  <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M7 16l-4-4m0 0l4-4m-4 4h18" />
                    <path d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </div>
                <div class="flex-1">
                  <div class="flex items-center justify-between">
                    <span class="text-sm font-bold text-gray-900">2 кінцеві станції</span>
                    <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Класичний</span>
                  </div>
                  <p class="text-xs text-gray-500 mt-1 leading-relaxed">
                    Двосторонній маршрут між двома кінцевими точками (Кінцева 1 ⇄ Кінцева 2).
                  </p>
                </div>
              </div>

              <!-- 1 Terminus Option (Loop) -->
              <div @click="form.terminiCount = 1"
                   class="rounded-2xl p-4 flex items-start gap-3.5 cursor-pointer transition-all duration-250 border-2"
                   :class="form.terminiCount === 1
                     ? 'border-purple-500 bg-white shadow-xs'
                     : 'border-transparent bg-[#f4f4f6] hover:bg-gray-200/60'">
                <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold text-base transition-colors duration-250"
                     :class="form.terminiCount === 1 ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-600'">
                  <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                    <path d="M21 3v5h-5" />
                  </svg>
                </div>
                <div class="flex-1">
                  <div class="flex items-center justify-between">
                    <span class="text-sm font-bold text-gray-900">1 кінцева станція</span>
                    <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">Кільцевий</span>
                  </div>
                  <p class="text-xs text-gray-500 mt-1 leading-relaxed">
                    Кільцевий маршрут з однією базовою кінцевою станцією відправлення та прибуття.
                  </p>
                </div>
              </div>
            </div>

            <!-- Termini Names -->
            <div>
              <label class="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">НАЗВИ КІНЦЕВИХ ТОЧОК</label>
              <div class="bg-[#f4f4f6] rounded-2xl p-3 flex flex-col gap-2">
                <div class="flex items-center gap-2">
                  <span class="text-xs font-bold text-gray-600 w-24 shrink-0">Кінцева 1:</span>
                  <input v-model="form.terminus1Name"
                         type="text"
                         placeholder="Кінцева 1"
                         class="flex-1 text-xs font-bold bg-white border border-gray-200/80 rounded-xl px-3 py-2 text-gray-800 focus:outline-none focus:border-blue-400 transition-all duration-200" />
                </div>
                <div v-if="form.terminiCount === 2" class="flex items-center gap-2">
                  <span class="text-xs font-bold text-gray-600 w-24 shrink-0">Кінцева 2:</span>
                  <input v-model="form.terminus2Name"
                         type="text"
                         placeholder="Кінцева 2"
                         class="flex-1 text-xs font-bold bg-white border border-gray-200/80 rounded-xl px-3 py-2 text-gray-800 focus:outline-none focus:border-blue-400 transition-all duration-200" />
                </div>
              </div>
            </div>
          </div>
        </transition>
      </div>

      <!-- ════════════════════════════════════════
           PAGINATION DOTS (4 Steps, matching screenshots)
      ════════════════════════════════════════ -->
      <div class="flex items-center justify-center gap-1.5 mt-8">
        <button v-for="s in 4" :key="s"
                type="button"
                @click="goToStep(s)"
                class="transition-all duration-400 ease-out cursor-pointer"
                :class="currentStep === s
                  ? 'w-7 h-2 rounded-full bg-gray-400/90 shadow-2xs'
                  : 'w-2 h-2 rounded-full bg-gray-300/80 hover:bg-gray-400 hover:scale-125'"
                :title="`Крок ${s}`" />
      </div>

      <!-- Action Navigation Row (Steps 2, 3, 4) with smooth fade -->
      <div class="min-h-[44px] mt-4 flex items-center justify-center w-full">
        <transition name="wizard-actions" mode="out-in">
          <div v-if="currentStep > 1" class="flex items-center justify-center gap-4 w-full">
            <button type="button"
                    @click="handleBack"
                    class="text-xs font-bold text-gray-400 hover:text-gray-700 px-3 py-1.5 transition-colors cursor-pointer active:scale-95">
              ← Назад
            </button>

            <!-- Next button for Step 2 & 3 -->
            <button v-if="currentStep < 4"
                    type="button"
                    @click="handleNext"
                    class="text-xs font-bold text-gray-700 hover:text-black bg-gray-100 hover:bg-gray-200/80 px-5 py-2 rounded-full transition-all duration-200 cursor-pointer flex items-center gap-1.5 active:scale-95">
              <span>Далі</span>
              <span>→</span>
            </button>

            <!-- Final Submit button for Step 4 -->
            <button v-else
                    type="button"
                    @click="handleFinish"
                    class="text-xs font-bold text-white px-5 py-2 rounded-full shadow-xs hover:opacity-95 active:scale-95 transition-all duration-200 cursor-pointer flex items-center gap-1.5"
                    :style="{ backgroundColor: form.color }">
              <span>Створити схему</span>
              <span>✓</span>
            </button>
          </div>
        </transition>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue';

const emit = defineEmits(['create', 'cancel']);

const currentStep = ref(1);
const slideDirection = ref('forward');

const stepTitles = [
  'Тип транспорту',
  'Номер та колір маршруту',
  'Часовий діапазон',
  'Кінцеві станції'
];

const stepSubtitles = [
  'Оберіть вид рухомого складу для створення схеми',
  'Задайте числовий номер, літеру та фірмовий колір',
  'Вкажіть межі першого часового проміжку доби',
  'Оберіть конфігурацію кінцевих точок та їх назви'
];

const presetColors = [
  '#1D43EF', // Royal Blue
  '#10B981', // Emerald Green
  '#8B5CF6', // Purple
  '#EF4444', // Red
  '#F59E0B', // Orange/Amber
  '#06B6D4', // Cyan
  '#EC4899', // Pink
  '#374151'  // Dark Charcoal
];

const form = reactive({
  transportType: 'trolleybus',
  number: '1',
  letter: 'А',
  color: '#1D43EF',
  timeStart: '06:00',
  timeEnd: '09:00',
  intervalMin: 15,
  intervalMax: 20,
  travelTime: 40,
  terminiCount: 2,
  terminus1Name: 'Кінцева 1',
  terminus2Name: 'Кінцева 2'
});

const isCustomColor = computed(() => {
  return !presetColors.some(c => c.toLowerCase() === form.color.toLowerCase());
});

function selectTransport(type) {
  // Purely visual selection, no auto-advance!
  form.transportType = type;
}

function confirmStep1() {
  slideDirection.value = 'forward';
  currentStep.value = 2;
}

function handleBack() {
  if (currentStep.value > 1) {
    slideDirection.value = 'backward';
    currentStep.value--;
  } else {
    emit('cancel');
  }
}

function handleNext() {
  if (currentStep.value === 1) {
    confirmStep1();
  } else if (currentStep.value < 4) {
    slideDirection.value = 'forward';
    currentStep.value++;
  } else {
    handleFinish();
  }
}

function handleFinish() {
  emit('create', { ...form });
}

function goToStep(s) {
  if (s >= 1 && s <= 4 && s !== currentStep.value) {
    slideDirection.value = s > currentStep.value ? 'forward' : 'backward';
    currentStep.value = s;
  }
}
</script>

<style scoped>
/* ────────── Forward transition (Slide Left with soft blur & scale) ────────── */
.wizard-slide-forward-enter-active,
.wizard-slide-forward-leave-active,
.wizard-slide-backward-enter-active,
.wizard-slide-backward-leave-active {
  transition: opacity 0.34s cubic-bezier(0.25, 1, 0.5, 1),
              transform 0.34s cubic-bezier(0.25, 1, 0.5, 1),
              filter 0.34s cubic-bezier(0.25, 1, 0.5, 1);
  will-change: opacity, transform, filter;
}

.wizard-slide-forward-enter-from {
  opacity: 0;
  transform: translateX(36px) scale(0.98);
  filter: blur(4px);
}
.wizard-slide-forward-leave-to {
  opacity: 0;
  transform: translateX(-36px) scale(0.98);
  filter: blur(4px);
}

/* ────────── Backward transition (Slide Right with soft blur & scale) ────────── */
.wizard-slide-backward-enter-from {
  opacity: 0;
  transform: translateX(-36px) scale(0.98);
  filter: blur(4px);
}
.wizard-slide-backward-leave-to {
  opacity: 0;
  transform: translateX(36px) scale(0.98);
  filter: blur(4px);
}

/* ────────── Title soft crossfade & glide ────────── */
.wizard-title-enter-active,
.wizard-title-leave-active {
  transition: opacity 0.28s cubic-bezier(0.25, 1, 0.5, 1),
              transform 0.28s cubic-bezier(0.25, 1, 0.5, 1);
}
.wizard-title-enter-from {
  opacity: 0;
  transform: translateY(6px);
}
.wizard-title-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

/* ────────── Action buttons fade ────────── */
.wizard-actions-enter-active,
.wizard-actions-leave-active {
  transition: opacity 0.24s ease-out, transform 0.24s ease-out;
}
.wizard-actions-enter-from,
.wizard-actions-leave-to {
  opacity: 0;
  transform: translateY(4px);
}

/* ────────── Schematic Line Drive Animation ("шо б до кінця доїхала") ────────── */
.drive-line {
  stroke-dasharray: 120;
  stroke-dashoffset: 0;
  animation: driveLineAnim 0.75s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

.drive-circle {
  transform-origin: 118px 18px;
  animation: popCircleAnim 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) 0.52s backwards;
}

@keyframes driveLineAnim {
  from {
    stroke-dashoffset: 120;
    opacity: 0.2;
  }
  to {
    stroke-dashoffset: 0;
    opacity: 1;
  }
}

@keyframes popCircleAnim {
  0% {
    transform: scale(0.4);
    opacity: 0;
  }
  70% {
    transform: scale(1.18);
    opacity: 1;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

div:hover > svg .drive-line {
  animation: driveLineAnim 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
div:hover > svg .drive-circle {
  animation: popCircleAnim 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) 0.4s backwards;
}
</style>