<template>
  <div class="relative w-full" ref="rootRef">
    <input type="text"
      v-model="query"
      @focus="isOpen = true"
      @input="isOpen = true"
      placeholder="Пошук або створення..."
      class="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-semibold text-gray-700 focus:outline-none focus:border-blue-400"
    />
    
    <div v-if="isOpen" class="absolute z-[100] w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
      <div v-for="rs in filteredStops" :key="rs.id"
           @click="selectStop(rs)"
           class="px-3 py-2 cursor-pointer hover:bg-blue-50 text-xs border-b border-gray-50 last:border-0">
        <div class="font-bold text-gray-800">{{ rs.name }}</div>
        <div class="text-[9px] text-gray-400 uppercase" v-if="rs.direction">Напрям: {{ rs.direction }}</div>
      </div>
      
      <div v-if="query && !exactMatch" 
           @click="createNewStop"
           class="px-3 py-2 cursor-pointer hover:bg-green-50 text-xs text-green-600 border-t border-gray-100 flex items-center gap-1">
        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
        <span class="font-bold">Додати "{{ query }}"</span>
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

const closeDropdown = (e) => {
  if (rootRef.value && !rootRef.value.contains(e.target)) {
    isOpen.value = false;
    // Reset query to selected name if clicked outside without selecting
    const s = props.stops.find(s => s.id === props.modelValue);
    if (s) query.value = s.name;
    else query.value = '';
  }
};

onMounted(() => {
  document.addEventListener('click', closeDropdown);
  if (props.modelValue) {
    const s = props.stops.find(s => s.id === props.modelValue);
    if (s) query.value = s.name;
  }
});

onUnmounted(() => {
  document.removeEventListener('click', closeDropdown);
});

watch(() => props.modelValue, (newVal) => {
  if (newVal) {
    const s = props.stops.find(s => s.id === newVal);
    if (s) query.value = s.name;
  } else {
    query.value = '';
  }
});

const filteredStops = computed(() => {
  if (!query.value) return props.stops;
  const q = query.value.toLowerCase();
  return props.stops.filter(s => 
    s.name.toLowerCase().includes(q) || 
    (s.direction && s.direction.toLowerCase().includes(q))
  );
});

const exactMatch = computed(() => {
  return props.stops.some(s => s.name.toLowerCase() === query.value.trim().toLowerCase());
});

function selectStop(rs) {
  query.value = rs.name;
  isOpen.value = false;
  emit('update:modelValue', rs.id);
}

function createNewStop() {
  emit('create', query.value.trim());
  isOpen.value = false;
}
</script>
