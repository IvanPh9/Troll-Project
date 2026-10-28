<template>
  <div class="relative w-full" ref="rootRef">
    <div class="relative flex items-center">
      <input type="text"
        v-model="query"
        @focus="onFocus"
        @input="isOpen = true"
        placeholder="Пошук або створення..."
        class="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-semibold text-gray-700 focus:outline-none focus:border-blue-400 pr-6"
      />
      <button v-if="modelValue" 
              type="button"
              @click.stop="clearSelection" 
              class="absolute right-2 text-gray-400 hover:text-gray-600 text-xs font-bold focus:outline-none cursor-pointer p-0.5"
              title="Очистити прив'язку">
        ✕
      </button>
    </div>
    
    <div v-if="isOpen" class="absolute z-[100] w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
      <div v-for="rs in filteredStops" :key="rs.id"
           @click="selectStop(rs)"
           class="px-3 py-2 cursor-pointer hover:bg-blue-50 text-xs border-b border-gray-50 last:border-0">
        <div class="flex items-center justify-between gap-2">
          <span class="font-bold text-gray-800">{{ rs.name }}</span>
          <span class="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 shrink-0">#{{ rs.id }}</span>
        </div>
        <div class="text-[9px] text-gray-400 uppercase" v-if="rs.direction">Напрям: {{ rs.direction }}</div>
      </div>
      
      <div v-if="query && query.trim() && !exactMatch" 
           @click="createNewStop"
           class="px-3 py-2 cursor-pointer hover:bg-green-50 text-xs text-green-600 border-t border-gray-100 flex items-center gap-1">
        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
        <span class="font-bold">Додати "{{ query.trim() }}"</span>
      </div>
      
      <div v-if="filteredStops.length === 0 && !query" class="px-3 py-2 text-xs text-gray-400">
        Введіть назву зупинки...
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';

const props = defineProps({
  modelValue: { type: [Number, String], default: null },
  stops: { type: Array, required: true }
});
const emit = defineEmits(['update:modelValue', 'create']);

const rootRef = ref(null);
const query = ref('');
const isOpen = ref(false);

function syncQueryWithSelected() {
  if (props.modelValue != null && props.modelValue !== '') {
    const s = props.stops.find(s => String(s.id) === String(props.modelValue));
    if (s) {
      query.value = s.name;
      return;
    }
  }
  query.value = '';
}

const closeDropdown = (e) => {
  if (rootRef.value && !rootRef.value.contains(e.target)) {
    isOpen.value = false;
    syncQueryWithSelected();
  }
};

const onFocus = () => {
  isOpen.value = true;
};

onMounted(() => {
  document.addEventListener('click', closeDropdown);
  syncQueryWithSelected();
});

onUnmounted(() => {
  document.removeEventListener('click', closeDropdown);
});

watch(() => props.modelValue, () => {
  syncQueryWithSelected();
}, { immediate: true });

watch(() => props.stops, () => {
  syncQueryWithSelected();
}, { deep: true });

const filteredStops = computed(() => {
  if (!query.value) return props.stops;
  const q = query.value.toLowerCase().trim();
  return props.stops.filter(s => 
    s.name.toLowerCase().includes(q) || 
    String(s.id).includes(q) ||
    `#${s.id}`.includes(q) ||
    (s.direction && s.direction.toLowerCase().includes(q))
  );
});

const exactMatch = computed(() => {
  if (!query.value) return false;
  const q = query.value.trim().toLowerCase();
  return props.stops.some(s => s.name.toLowerCase() === q);
});

function selectStop(rs) {
  query.value = rs.name;
  isOpen.value = false;
  emit('update:modelValue', rs.id);
}

function clearSelection() {
  query.value = '';
  isOpen.value = false;
  emit('update:modelValue', null);
}

function createNewStop() {
  const trimmed = query.value.trim();
  if (!trimmed) return;
  emit('create', trimmed);
  isOpen.value = false;
}
</script>
