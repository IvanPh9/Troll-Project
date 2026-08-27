const fs = require('fs');

let content = fs.readFileSync('src/modules/route-constructor/RouteConstructor.vue', 'utf8');

// Remove watcher from line 500
content = content.replace(`
watch(activeSegment, (newVal) => {
  if (newVal) {
    isSidebarOpen.value = true;
  }
}, { immediate: true });`, '');

// Clean definition of activeSegment with String matching and watcher AFTER activeSegment
const oldActiveSeg = `const activeSegmentId = computed(() => route.query.segmentId);
const activeSegment = computed(() => {
  if (!activeSegmentId.value) return null;
  const id = parseInt(activeSegmentId.value);
  let found = segments.value.find(s => s.id === id);
  if (found) return found;
  // Also search branches if needed
  for (const br of branches.value) {
    if (br.sections) {
      for (const sec of br.sections) {
        if (sec.id === id) return sec;
      }
    }
  }
  return null;
});`;

const newActiveSeg = `const activeSegmentId = computed(() => route.query.segmentId);
const activeSegment = computed(() => {
  if (!activeSegmentId.value) return null;
  const idStr = String(activeSegmentId.value);
  let found = segments.value.find(s => String(s.id) === idStr);
  if (found) return found;
  // Also search branches
  for (const br of branches.value) {
    if (br.sections) {
      for (const sec of br.sections) {
        if (String(sec.id) === idStr) return sec;
      }
    }
  }
  return null;
});

watch(activeSegment, (newVal) => {
  if (newVal) {
    isSidebarOpen.value = true;
  }
}, { immediate: true });`;

content = content.replace(oldActiveSeg, newActiveSeg);

fs.writeFileSync('src/modules/route-constructor/RouteConstructor.vue', content);
console.log('Successfully fixed watch order in RouteConstructor.vue!');
