const fs = require('fs');

// 1. Update RouteConstructor.vue
let constructorContent = fs.readFileSync('src/modules/route-constructor/RouteConstructor.vue', 'utf8');

// Replace activeSegment computed property
const oldActiveSegBlock = /const activeSegmentId = computed\(\(\) => route\.query\.segmentId\);[\s\S]*?watch\(activeSegment[\s\S]*?\};/s;

const newActiveSegBlock = `const activeSegmentId = computed(() => route.query.segmentId);
const activeSegment = computed(() => {
  if (!activeSegmentId.value) return null;
  const idStr = String(activeSegmentId.value);

  // 1. Search main segments
  let found = segments.value.find(s => String(s.id) === idStr);
  if (found) return found;

  // 2. Search branch sections
  for (const br of branches.value) {
    if (!br.sections) br.sections = [];
    const sectionCount = Math.max((br.nodes || []).length + 1, 1);
    while (br.sections.length < sectionCount) {
      const sIdx = br.sections.length;
      br.sections.push({
        id: 'br_sec_' + br.id + '_' + sIdx,
        stops: [],
        travelTime: 5,
        interval: '20',
        intervalMax: '25'
      });
    }
    for (let sIdx = 0; sIdx < br.sections.length; sIdx++) {
      const sec = br.sections[sIdx];
      if (sec && (String(sec.id) === idStr || idStr === ('br-seg-' + br.id + '-' + sIdx) || idStr === ('br_sec_' + br.id + '_' + sIdx))) {
        if (!sec.id) sec.id = 'br_sec_' + br.id + '_' + sIdx;
        if (!sec.stops) sec.stops = [];
        if (sec.travelTime === undefined) sec.travelTime = 5;
        if (sec.interval === undefined) sec.interval = '20';
        if (sec.intervalMax === undefined) sec.intervalMax = '25';
        return sec;
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

constructorContent = constructorContent.replace(oldActiveSegBlock, newActiveSegBlock);

// Allow clicking "Налаштувати" for branch segments in allSegmentsList sidebar view
constructorContent = constructorContent.replace(
  `<button v-if="!segItem.isBranch" @click="router.push({ query: { ...route.query, segmentId: segItem.id } })"`,
  `<button @click="router.push({ query: { ...route.query, segmentId: segItem.id } })"`
);

// Ensure allSegmentsList assigns real section ID to branch items
const oldBranchSecPush = /list\.push\(\{\s*id: 'br-seg-' \+ br\.id \+ '-' \+ si,/g;
const newBranchSecPush = `if (!br.sections) br.sections = [];
      if (!br.sections[si]) {
        br.sections[si] = { id: 'br_sec_' + br.id + '_' + si, stops: [], travelTime: 5, interval: '20', intervalMax: '25' };
      }
      const secObj = br.sections[si];
      if (!secObj.id) secObj.id = 'br_sec_' + br.id + '_' + si;

      list.push({
        id: secObj.id,`;

constructorContent = constructorContent.replace(oldBranchSecPush, newBranchSecPush);

fs.writeFileSync('src/modules/route-constructor/RouteConstructor.vue', constructorContent);

// 2. Update RouteCanvas.vue selectBranchSection
let canvasContent = fs.readFileSync('src/modules/route-constructor/components/RouteCanvas.vue', 'utf8');

const oldSelectFunc = /function selectBranchSection\(br, secIdx = 0, segIndex = 0, isRight = true\)[\s\S]*?zoomAnimFrame = requestAnimationFrame\(step\);\n\}/;

const newSelectFunc = `function selectBranchSection(br, secIdx = 0, segIndex = 0, isRight = true) {
  if (!br.sections) br.sections = [];
  while (br.sections.length <= secIdx) {
    const sIdx = br.sections.length;
    br.sections.push({
      id: 'br_sec_' + br.id + '_' + sIdx,
      stops: [],
      travelTime: 5,
      interval: '20',
      intervalMax: '25'
    });
  }
  const sec = br.sections[secIdx];
  if (!sec.id) {
    sec.id = 'br_sec_' + br.id + '_' + secIdx;
  }
  if (!sec.stops) sec.stops = [];
  if (sec.travelTime === undefined) sec.travelTime = 5;
  if (sec.interval === undefined) sec.interval = '20';
  if (sec.intervalMax === undefined) sec.intervalMax = '25';

  if (router && route) {
    router.push({ query: { ...route.query, segmentId: String(sec.id) } });
  }

  // Camera zoom to branch section
  if (!layout.value) return;
  const l = layout.value;
  const cx = isRight ? (l.rightX + getBranchDx(br)) : (l.leftX - getBranchDx(br));
  const sY = getBranchSectionStartY(br, secIdx + 1, segIndex, isRight);
  const eY = getBranchSectionEndY(br, secIdx + 1, segIndex, isRight);
  const cy = (sY + eY) / 2;
  const segH = Math.abs(eY - sY);

  let targetH = segH + 160;
  let targetW = targetH * (800 / 1200);
  if (targetW < 350) {
    targetW = 350;
    targetH = targetW * (1200 / 800);
  }
  if (targetW > 800) {
    targetW = 800;
    targetH = 1200;
  }

  const targetX = cx - targetW / 2;
  const targetY = cy - targetH / 2;
  const startX = vbX.value;
  const startY = vbY.value;
  const startW = vbW.value;
  const startH = vbH.value;
  const duration = 500;
  const startTime = performance.now();

  if (zoomAnimFrame) cancelAnimationFrame(zoomAnimFrame);
  function step(time) {
    let progress = (time - startTime) / duration;
    if (progress > 1) progress = 1;
    const ease = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
    vbX.value = startX + (targetX - startX) * ease;
    vbY.value = startY + (targetY - startY) * ease;
    vbW.value = startW + (targetW - startW) * ease;
    vbH.value = startH + (targetH - startH) * ease;
    if (progress < 1) {
      zoomAnimFrame = requestAnimationFrame(step);
    }
  }
  zoomAnimFrame = requestAnimationFrame(step);
}`;

canvasContent = canvasContent.replace(oldSelectFunc, newSelectFunc);

fs.writeFileSync('src/modules/route-constructor/components/RouteCanvas.vue', canvasContent);

console.log('Successfully fixed branch segment sidebar editor matching and rendering!');
