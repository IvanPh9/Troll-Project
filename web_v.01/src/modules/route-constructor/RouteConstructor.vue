<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useStopsStore } from '@/stores/stops';
import RouteCanvas from './components/RouteCanvas.vue';
import StopSelector from './components/StopSelector.vue';
import RouteCreateWizard from './components/RouteCreateWizard.vue';
import SvgIcon from '@/components/ui/SvgIcon.vue';
import { useRoutesStore } from '@/stores/routes';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import {
  migrateToGraph,
  traverseGraph,
  addControlNodeGraph,
  addStopGraph,
  removeStopGraph,
  removeNodeGraph,
  addBranchGraph,
  addBranchNodeGraph,
  removeBranchNodeGraph,
  setBranchConfigGraph,
  renameStopIdGraph,
  renameNodeIdGraph,
  rotateGraph180
} from './utils/graphModel.js';
import { useGraphHistory } from './utils/graphHistory.js';
import { calculateBranchLevels } from './utils/branchLevelModel.js';
import { analyzeRouteChains, toggleChainInList } from './utils/routeChains.js';

const router = useRouter();
const route = useRoute();
const stopsStore = useStopsStore();
const routesStore = useRoutesStore();
const canvasRef = ref(null);

const props = defineProps({
  id: { type: [String, Number], default: null },
  isViewMode: { type: Boolean, default: null }
});

/* ─────────── Mode Detection (Create / Edit / View) ─────────── */
const isViewMode = ref(
  route.name === 'route-detail' ||
  route.query.mode === 'view' ||
  props.isViewMode === true
);
if (route.query.mode === 'edit') {
  isViewMode.value = false;
}

// Creation mode: /base/route/create without any id
const isCreatingNew = computed(() => {
  return route.name === 'route-create' && !route.query.id && !props.id;
});

// Editing or viewing an existing route ID
const editingRouteId = computed(() => {
  const raw = props.id || route.params.id || route.query.id;
  const parsed = Number(raw);
  return !isNaN(parsed) && parsed > 0 ? parsed : null;
});

const currentRouteIndex = computed(() => {
  if (!editingRouteId.value) return 0;
  const idx = routesStore.routes.findIndex(r => r.id === editingRouteId.value);
  return idx !== -1 ? idx : 0;
});

const currentRoute = computed(() => {
  if (!editingRouteId.value) return null;
  return routesStore.routes.find(r => r.id === editingRouteId.value) || routesStore.routes[0] || null;
});

const prevRoute = computed(() => {
  if (routesStore.routes.length === 0) return null;
  if (routesStore.routes.length === 1) return routesStore.routes[0];
  const idx = (currentRouteIndex.value - 1 + routesStore.routes.length) % routesStore.routes.length;
  return routesStore.routes[idx];
});

const nextRoute = computed(() => {
  if (routesStore.routes.length === 0) return null;
  if (routesStore.routes.length === 1) return routesStore.routes[0];
  const idx = (currentRouteIndex.value + 1) % routesStore.routes.length;
  return routesStore.routes[idx];
});

function switchRoute(id) {
  if (!id) return;
  if (route.name === 'route-detail' || isViewMode.value) {
    router.push({ name: 'route-detail', params: { id } });
  } else {
    router.push({ name: 'route-create', query: { id } });
  }
}

/* ─────────── Route meta ─────────── */
const routeNumber        = ref('1');
const routeLetter        = ref('А');
const routeColor         = ref('#1D43EF');
const routeTransportType = ref('trolleybus'); // 'trolleybus' | 'bus'
const showCreateWizard   = ref(isCreatingNew.value);
const selectedWorkMode   = ref(1);
const workModes = [
  { id: 1, name: 'Змінний',          value: '1' },
  { id: 2, name: 'Одинарний "Пік"',  value: '2' },
  { id: 3, name: '10 Годинний',      value: '5' },
];

/* ─────────── Time Periods & Per-Period Scrubber Slider ─────────── */
const timeStart = ref(360);   // 06:00
const timeEnd   = ref(510);   // 08:30
const routePeriods = ref([
  { period: '06:00 - 09:00', travelTime: 46, interval: '15', intervalMax: '20', segmentsData: {} },
  { period: '09:00 - 16:00', travelTime: 40, interval: '20', intervalMax: '25', segmentsData: {} },
  { period: '16:00 - 22:00', travelTime: 44, interval: '17', intervalMax: '22', segmentsData: {} }
]);
const selectedPeriodIdx = ref(0);

function fmtTime(min) {
  const clamped = Math.max(0, Math.min(1439, Math.round(Number(min) || 0)));
  return `${String(Math.floor(clamped / 60)).padStart(2,'0')}:${String(clamped % 60).padStart(2,'0')}`;
}

function parseTimeStrToMinutes(tStr, fallback) {
  if (!tStr || !tStr.includes(':')) return fallback;
  const [h, m] = tStr.trim().split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return fallback;
  return Math.max(0, Math.min(1439, h * 60 + m));
}

function getPeriodBounds(idx) {
  const p = routePeriods.value[idx];
  if (!p) return null;
  const parts = String(p.period || '').split('-');
  if (parts.length < 2) return null;
  return {
    start: parseTimeStrToMinutes(parts[0], 0),
    end: parseTimeStrToMinutes(parts[1], 1439)
  };
}

function getMinAllowedStart(idx) {
  if (idx <= 0) return 0;
  const prev = getPeriodBounds(idx - 1);
  return prev ? Math.min(1438, prev.start + 1) : 0;
}

function getMaxAllowedEnd(idx) {
  const next = getPeriodBounds(idx + 1);
  if (!next) return 1439; // 23:59 (в межах 24 годин)
  return Math.max(1, Math.min(1439, next.end - 1));
}

function syncPeriodToTimeInputs(periodStr) {
  const parts = String(periodStr || '').split('-');
  if (parts.length >= 2) {
    const s = parseTimeStrToMinutes(parts[0], 360);
    const e = parseTimeStrToMinutes(parts[1], 540);
    timeStart.value = Math.max(0, Math.min(1438, s));
    timeEnd.value = Math.max(timeStart.value + 1, Math.min(1439, e));
  }
}

function updateActivePeriodTimeString() {
  const p = routePeriods.value[selectedPeriodIdx.value];
  if (p) {
    p.period = `${fmtTime(timeStart.value)} - ${fmtTime(timeEnd.value)}`;
  }
}

function onTimeStartChange(rawVal, inputEl) {
  const parsed = parseTimeStrToMinutes(rawVal, timeStart.value);
  const idx = selectedPeriodIdx.value;
  const minStart = getMinAllowedStart(idx);
  const maxStart = Math.max(minStart, timeEnd.value - 1);
  const clamped = Math.max(minStart, Math.min(maxStart, parsed));

  const oldStart = timeStart.value;
  timeStart.value = clamped;
  updateActivePeriodTimeString();

  if (inputEl) {
    inputEl.value = fmtTime(clamped);
  }

  // Якщо попередній проміжок межував з початком поточного — оновлюємо його кінець
  const prevP = routePeriods.value[idx - 1];
  const prevBounds = getPeriodBounds(idx - 1);
  if (prevP && prevBounds && (prevBounds.end === oldStart || prevBounds.end > clamped)) {
    if (clamped > prevBounds.start) {
      prevP.period = `${fmtTime(prevBounds.start)} - ${fmtTime(clamped)}`;
    }
  }
}

function onTimeEndChange(rawVal, inputEl) {
  const parsed = parseTimeStrToMinutes(rawVal, timeEnd.value);
  const idx = selectedPeriodIdx.value;
  const minEnd = Math.min(1439, timeStart.value + 1);
  const maxEnd = Math.max(minEnd, getMaxAllowedEnd(idx));
  const clamped = Math.max(minEnd, Math.min(maxEnd, parsed));

  const oldEnd = timeEnd.value;
  timeEnd.value = clamped;
  updateActivePeriodTimeString();

  if (inputEl) {
    inputEl.value = fmtTime(clamped);
  }

  // Якщо наступний проміжок межував з кінцем поточного — зсуваємо його початок в межах його кінця
  const nextP = routePeriods.value[idx + 1];
  const nextBounds = getPeriodBounds(idx + 1);
  if (nextP && nextBounds && (nextBounds.start === oldEnd || nextBounds.start < clamped)) {
    if (clamped < nextBounds.end) {
      nextP.period = `${fmtTime(clamped)} - ${fmtTime(nextBounds.end)}`;
    }
  }
}

function shiftTime(delta) {
  const idx = selectedPeriodIdx.value;
  const oldEnd = timeEnd.value;
  const minEnd = Math.min(1439, timeStart.value + 1);
  const maxEnd = Math.max(minEnd, getMaxAllowedEnd(idx));
  const nextEnd = Math.max(minEnd, Math.min(maxEnd, timeEnd.value + delta));
  timeEnd.value = nextEnd;
  updateActivePeriodTimeString();

  // Якщо наступний проміжок починався в кінці поточного — зсуваємо його початок
  const nextP = routePeriods.value[idx + 1];
  const nextBounds = getPeriodBounds(idx + 1);
  if (nextP && nextBounds && (nextBounds.start === oldEnd || nextBounds.start < nextEnd)) {
    if (nextEnd < nextBounds.end) {
      nextP.period = `${fmtTime(nextEnd)} - ${fmtTime(nextBounds.end)}`;
    }
  }
}

const isSplitPeriodOpen = ref(false);
const splitTimeMinutes = ref(450); // 07:30

function openSplitTimePrompt() {
  const startM = timeStart.value;
  const endM = timeEnd.value;
  if (endM - startM < 2) return;
  let midM = Math.round(((startM + endM) / 2) / 5) * 5;
  if (midM <= startM || midM >= endM) {
    midM = Math.floor((startM + endM) / 2);
  }
  splitTimeMinutes.value = midM;
  isSplitPeriodOpen.value = true;
}

function splitTimePeriod() {
  saveActivePeriodSegments();
  const activeP = routePeriods.value[selectedPeriodIdx.value];
  if (!activeP) return;
  const startM = timeStart.value;
  const endM = timeEnd.value;

  const splitM = Math.max(startM + 1, Math.min(endM - 1, splitTimeMinutes.value));
  if (splitM <= startM || splitM >= endM) return;

  timeEnd.value = splitM;
  activeP.period = `${fmtTime(startM)} - ${fmtTime(splitM)}`;

  const clonedSegs = activeP.segmentsData ? JSON.parse(JSON.stringify(activeP.segmentsData)) : {};
  const secondHalf = {
    period: `${fmtTime(splitM)} - ${fmtTime(endM)}`,
    travelTime: activeP.travelTime || totalTime.value || 90,
    interval: activeP.interval || '18',
    intervalMax: activeP.intervalMax || '22',
    segmentsData: clonedSegs,
    disabledIds: activeP.disabledIds ? [...activeP.disabledIds] : []
  };
  routePeriods.value.splice(selectedPeriodIdx.value + 1, 0, secondHalf);
  isSplitPeriodOpen.value = false;
}

function buildPeriodSegmentsMap(graphObj, periodList) {
  const baseSegs = Object.values(graphObj?.segments || {});
  const baseSum = baseSegs.reduce((acc, s) => acc + Number(s.travelTime || 6), 0) || 1;
  const firstPeriodTime = periodList[0]?.travelTime || baseSum;

  return periodList.map((pt, idx) => {
    const segData = pt.segmentsData ? JSON.parse(JSON.stringify(pt.segmentsData)) : {};
    const ratio = firstPeriodTime > 0 ? (pt.travelTime / firstPeriodTime) : (idx === 1 ? 0.88 : (idx === 2 ? 0.95 : 1));
    const defInt = pt.interval || (idx === 0 ? '14' : (idx === 1 ? '18' : (idx === 2 ? '15' : '22')));
    const defIntMax = pt.intervalMax || (idx === 0 ? '18' : (idx === 1 ? '22' : (idx === 2 ? '19' : '27')));

    baseSegs.forEach(s => {
      if (!segData[s.id]) {
        segData[s.id] = {
          travelTime: Math.max(2, Math.round(Number(s.travelTime || 6) * ratio)),
          interval: idx === 0 ? (s.interval || defInt) : defInt,
          intervalMax: idx === 0 ? (s.intervalMax || defIntMax) : defIntMax
        };
      }
    });

    return {
      period: pt.period,
      travelTime: pt.travelTime,
      interval: defInt,
      intervalMax: defIntMax,
      segmentsData: segData,
      disabledIds: pt.disabledIds ? [...pt.disabledIds] : []
    };
  });
}

function saveActivePeriodSegments() {
  const activeP = routePeriods.value[selectedPeriodIdx.value];
  if (!activeP || !routeGraph.value?.segments) return;
  if (!activeP.segmentsData) activeP.segmentsData = {};
  Object.values(routeGraph.value.segments).forEach(s => {
    activeP.segmentsData[s.id] = {
      travelTime: Number(s.travelTime || 6),
      interval: String(s.interval || '18'),
      intervalMax: String(s.intervalMax || '22')
    };
  });
  activeP.travelTime = totalTime.value;
}

function applyPeriodToGraph(idx) {
  const p = routePeriods.value[idx];
  if (!p || !routeGraph.value?.segments) return;
  syncPeriodToTimeInputs(p.period);
  Object.values(routeGraph.value.segments).forEach(s => {
    const savedSeg = p.segmentsData?.[s.id];
    if (savedSeg) {
      s.travelTime = savedSeg.travelTime;
      s.interval = savedSeg.interval;
      s.intervalMax = savedSeg.intervalMax;
    } else if (p.interval && p.intervalMax) {
      s.interval = p.interval;
      s.intervalMax = p.intervalMax;
    }
  });
}

function selectPeriodByIndex(newIdx) {
  const clamped = Math.max(0, Math.min(routePeriods.value.length - 1, Number(newIdx)));
  if (clamped === selectedPeriodIdx.value) return;
  saveActivePeriodSegments();
  isSplitPeriodOpen.value = false;
  selectedPeriodIdx.value = clamped;
  applyPeriodToGraph(clamped);
  nextTick(() => {
    if (isViewMode.value) initMiniMap();
  });
}

function stepPeriod(delta) {
  if (routePeriods.value.length <= 1) return;
  const nextIdx = (selectedPeriodIdx.value + delta + routePeriods.value.length) % routePeriods.value.length;
  selectPeriodByIndex(nextIdx);
}

function addTimePeriod() {
  saveActivePeriodSegments();
  const lastP = routePeriods.value[routePeriods.value.length - 1];
  const lastParts = String(lastP?.period || '16:00 - 20:00').split('-');
  const lastStart = parseTimeStrToMinutes(lastParts[0], 960);
  let startMin = parseTimeStrToMinutes(lastParts[1], 1080);

  // Все в межах 24 годин (до 23:59 = 1439 хв)
  if (startMin >= 1439) {
    if (1439 - lastStart < 2) return;
    startMin = Math.max(lastStart + 1, Math.min(1438, Math.floor((lastStart + 1439) / 2)));
    if (lastP) {
      lastP.period = `${fmtTime(lastStart)} - ${fmtTime(startMin)}`;
    }
  }

  const endMin = Math.min(1439, Math.max(startMin + 1, startMin + 120));
  const newPeriodStr = `${fmtTime(startMin)} - ${fmtTime(endMin)}`;
  const clonedSegs = lastP?.segmentsData ? JSON.parse(JSON.stringify(lastP.segmentsData)) : {};
  routePeriods.value.push({
    period: newPeriodStr,
    travelTime: totalTime.value || 90,
    interval: '20',
    intervalMax: '25',
    segmentsData: clonedSegs,
    disabledIds: lastP?.disabledIds ? [...lastP.disabledIds] : []
  });
  selectPeriodByIndex(routePeriods.value.length - 1);
}

function removeTimePeriod(idx) {
  if (routePeriods.value.length <= 1) return;
  routePeriods.value.splice(idx, 1);
  const nextIdx = Math.min(selectedPeriodIdx.value, routePeriods.value.length - 1);
  selectedPeriodIdx.value = nextIdx;
  applyPeriodToGraph(nextIdx);
}

/* ─────────── Default Creation Mode Data (Clean Empty Scheme) ─────────── */
const initialNodesCreation = [
  { id: 1, type: 'control', isTerminus: true, name: 'Кінцева 1', terminusStop: '', waitMin: 5, waitMax: 9, side: 'top' },
  { id: 2, type: 'control', isTerminus: true, name: 'Кінцева 2', terminusStop: '', waitMin: 5, waitMax: 9, side: 'bottom' },
];

const initialSegmentsCreation = [
  { id: 1, side: 'right', travelTime: 20, interval: '15', intervalMax: '20', stops: [] },
  { id: 2, side: 'left', travelTime: 20, interval: '15', intervalMax: '20', stops: [] },
];

const routeGraph = ref(migrateToGraph(initialNodesCreation, initialSegmentsCreation, []));
const { undoStack, redoStack, actionLogs, takeSnapshot, undo, redo, clearHistory, canUndo, canRedo } = useGraphHistory(routeGraph);

function parseNumberAndLetter(numStr, rawNum, rawLet) {
  if (rawNum !== undefined) {
    return { num: rawNum, letStr: rawLet || '' };
  }
  const s = String(numStr || '1').trim();
  const match = s.match(/^(\d+)(.*)$/);
  if (match) {
    return { num: match[1], letStr: match[2].trim() };
  }
  return { num: s, letStr: '' };
}

function handleWizardCreate(wizardData) {
  routeTransportType.value = wizardData.transportType || 'trolleybus';
  routeNumber.value = wizardData.number || '1';
  routeLetter.value = wizardData.letter || '';
  routeColor.value = wizardData.color || '#1D43EF';

  const pStr = `${wizardData.timeStart} - ${wizardData.timeEnd}`;
  timeStart.value = parseTimeStrToMinutes(wizardData.timeStart, 360);
  timeEnd.value = parseTimeStrToMinutes(wizardData.timeEnd, 540);

  const travelTime = Number(wizardData.travelTime || 40);
  const halfTime = Math.max(1, Math.round(travelTime / 2));
  const intMin = String(wizardData.intervalMin || '15');
  const intMax = String(wizardData.intervalMax || '20');

  let emptyNodes = [];
  let emptySegments = [];

  if (wizardData.terminiCount === 1) {
    emptyNodes = [
      { id: 1, type: 'control', isTerminus: true, name: wizardData.terminus1Name || 'Кінцева 1', terminusStop: '', waitMin: 5, waitMax: 9, side: 'top' },
      { id: 2, type: 'control', isTerminus: false, name: 'Оборотне коло', terminusStop: '', side: 'bottom' }
    ];
    emptySegments = [
      { id: 1, side: 'right', travelTime: halfTime, interval: intMin, intervalMax: intMax, stops: [] },
      { id: 2, side: 'left', travelTime: halfTime, interval: intMin, intervalMax: intMax, stops: [] }
    ];
  } else {
    emptyNodes = [
      { id: 1, type: 'control', isTerminus: true, name: wizardData.terminus1Name || 'Кінцева 1', terminusStop: '', waitMin: 5, waitMax: 9, side: 'top' },
      { id: 2, type: 'control', isTerminus: true, name: wizardData.terminus2Name || 'Кінцева 2', terminusStop: '', waitMin: 5, waitMax: 9, side: 'bottom' }
    ];
    emptySegments = [
      { id: 1, side: 'right', travelTime: halfTime, interval: intMin, intervalMax: intMax, stops: [] },
      { id: 2, side: 'left', travelTime: halfTime, interval: intMin, intervalMax: intMax, stops: [] }
    ];
  }

  routeGraph.value = migrateToGraph(emptyNodes, emptySegments, []);
  routePeriods.value = [
    {
      period: pStr,
      travelTime: travelTime,
      interval: intMin,
      intervalMax: intMax,
      segmentsData: {},
      disabledIds: []
    }
  ];
  selectedPeriodIdx.value = 0;
  applyPeriodToGraph(0);
  clearHistory();

  showCreateWizard.value = false;

  nextTick(() => {
    canvasRef.value?.resetView(true);
  });
}

function handleWizardCancel() {
  showCreateWizard.value = false;
  router.push('/base/route');
}

function initStateForCurrentRoute() {
  if (isCreatingNew.value) {
    showCreateWizard.value = true;
    routeTransportType.value = 'trolleybus';
    routeNumber.value = '1';
    routeLetter.value = 'А';
    routeColor.value = '#1D43EF';
    selectedWorkMode.value = 1;
    routeGraph.value = migrateToGraph(initialNodesCreation, initialSegmentsCreation, []);
    const defaultCreationPeriods = [
      { period: '06:00 - 09:00', travelTime: 40, interval: '15', intervalMax: '20' }
    ];
    routePeriods.value = buildPeriodSegmentsMap(routeGraph.value, defaultCreationPeriods);
    selectedPeriodIdx.value = 0;
    applyPeriodToGraph(0);
    clearHistory();
    return;
  }

  const r = currentRoute.value;
  if (!r) return;

  showCreateWizard.value = false;
  routeTransportType.value = r.transportType || 'trolleybus';
  const { num, letStr } = parseNumberAndLetter(r.number, r.routeNumberRaw, r.routeLetterRaw);
  routeNumber.value = num;
  routeLetter.value = letStr;
  routeColor.value = r.color || '#1D43EF';
  selectedWorkMode.value = r.selectedWorkMode || 1;

  if (r.graph && r.graph.nodes && r.graph.segments) {
    routeGraph.value = JSON.parse(JSON.stringify(r.graph));
  } else {
    routeGraph.value = migrateToGraph(initialNodesCreation, initialSegmentsCreation, []);
  }

  const basePeriods = (r.periodTimes && r.periodTimes.length > 0)
    ? r.periodTimes
    : [
        { period: '06:00 - 09:00', travelTime: 109, interval: '14', intervalMax: '18' },
        { period: '09:00 - 16:00', travelTime: 96, interval: '18', intervalMax: '22' },
        { period: '16:00 - 22:00', travelTime: 104, interval: '15', intervalMax: '19' }
      ];
  routePeriods.value = buildPeriodSegmentsMap(routeGraph.value, basePeriods);
  selectedPeriodIdx.value = 0;
  applyPeriodToGraph(0);
  clearHistory();
}

// Initialize immediately
let loadedRouteKey = `${isCreatingNew.value ? 'create' : String(editingRouteId.value || '')}`;
initStateForCurrentRoute();

watch(
  () => `${String(route.name || '')}|${String(route.params.id || '')}|${String(route.query.id || '')}|${String(route.query.mode || '')}`,
  () => {
    if (route.name === 'route-detail' || route.query.mode === 'view') {
      isViewMode.value = true;
    } else if (route.name === 'route-create' && route.query.mode !== 'view') {
      isViewMode.value = false;
    }

    const nextRouteKey = `${isCreatingNew.value ? 'create' : String(editingRouteId.value || '')}`;
    if (nextRouteKey !== loadedRouteKey) {
      loadedRouteKey = nextRouteKey;
      initStateForCurrentRoute();
    }

    nextTick(() => {
      if (isViewMode.value) {
        isEditable.value = false;
        isBranchMode.value = false;
        initMiniMap();
        canvasRef.value?.resetView(true);
      } else {
        isEditable.value = true;
        canvasRef.value?.resetView(true);
      }
    });
  }
);

watch(
  () => route.query.segmentId,
  (newSegId, oldSegId) => {
    nextTick(() => {
      if (newSegId) {
        canvasRef.value?.focusSegment(newSegId);
      } else if (oldSegId) {
        canvasRef.value?.resetView(true);
      }
    });
  }
);

function handleGlobalKeydown(e) {
  const isCtrlOrCmd = e.ctrlKey || e.metaKey;
  if (!isCtrlOrCmd) return;

  const keyLower = (e.key || '').toLowerCase();
  const code = e.code || '';
  const keyCode = e.keyCode || e.which || 0;

  const isZ = code === 'KeyZ' || keyLower === 'z' || keyLower === 'я' || keyCode === 90;
  const isY = code === 'KeyY' || keyLower === 'y' || keyLower === 'н' || keyCode === 89;

  if (!isZ && !isY) return;

  const activeEl = document.activeElement;
  const isInput = activeEl && (['INPUT', 'TEXTAREA', 'SELECT'].includes(activeEl.tagName) || activeEl.isContentEditable);
  if (isInput) return;

  e.preventDefault();
  e.stopPropagation();

  if (isZ) {
    if (e.shiftKey) {
      redo();
    } else {
      undo();
    }
  } else if (isY) {
    redo();
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeydown, true);
  if (isViewMode.value) {
    isEditable.value = false;
    isBranchMode.value = false;
    nextTick(() => {
      initMiniMap();
      canvasRef.value?.resetView(false);
    });
  }
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown, true);
  if (miniMap) {
    miniMap.remove();
    miniMap = null;
  }
});

const traversedData = computed(() => traverseGraph(routeGraph.value));
const nodes = computed(() => traversedData.value.nodes);
const segments = computed(() => traversedData.value.segments);
const branches = computed(() => traversedData.value.branches);
const branchLevels = computed(() => calculateBranchLevels(branches.value, segments.value, nodes.value));

const hasFinishedBranches = computed(() => (branches.value || []).some(b => b && b.finished));
const isSingleLoopPreview = computed(() => isViewMode.value || !isEditable.value);

const activeChainAnalysis = computed(() => {
  const activeP = routePeriods.value[selectedPeriodIdx.value];
  const disabledList = activeP?.disabledIds || [];
  return analyzeRouteChains(
    nodes.value,
    segments.value,
    branches.value,
    disabledList,
    routeGraph.value?.originNodeId || routeGraph.value?.startNodeId
  );
});

function handleToggleChain(targetId) {
  const activeP = routePeriods.value[selectedPeriodIdx.value];
  if (!activeP) return;
  if (!activeP.disabledIds) activeP.disabledIds = [];
  activeP.disabledIds = toggleChainInList(activeChainAnalysis.value, targetId, activeP.disabledIds);
  nextTick(() => {
    activeP.travelTime = totalTime.value;
    if (isViewMode.value) initMiniMap();
  });
}

function isTargetDisabled(targetId) {
  return activeChainAnalysis.value?.disabledSubSegIds?.has(String(targetId)) || false;
}

function isTargetSwitchable(targetId) {
  if (!targetId || !activeChainAnalysis.value) return false;
  const analysis = activeChainAnalysis.value;
  const ch = analysis.chainByLookupId?.get(String(targetId));
  if (ch) {
    return !!(ch.isBranch || ch.isBypassedMain);
  }
  const subParts = analysis.subSegsByParentSegId?.get(String(targetId)) || [];
  return subParts.some(p => p.isBypassedMain);
}

/* ─────────── Developer Graph Inspector ─────────── */
const ENABLE_GRAPH_INSPECTOR = false; // Тимчасово приховано
const showGraphInspector = ref(false);
const inspectorTab = ref('chain');

const developerLinkedList = computed(() => {
  const chain = [];
  const g = routeGraph.value;
  if (!g || !g.startNodeId) return chain;

  let currNodeId = g.startNodeId;
  const visited = new Set();

  while (currNodeId && !visited.has(currNodeId)) {
    const node = g.nodes[currNodeId];
    if (!node) break;
    visited.add(currNodeId);

    let branchInfo = null;
    if (node.altSegId) {
      const altSections = [];
      let currAltSegId = node.altSegId;
      const visitedAltSegs = new Set();

      while (currAltSegId && !visitedAltSegs.has(currAltSegId)) {
        visitedAltSegs.add(currAltSegId);
        const altSeg = g.segments[currAltSegId];
        if (!altSeg) break;

        const altStops = [];
        let currStopId = altSeg.firstStopId;
        const visitedStops = new Set();
        while (currStopId && !visitedStops.has(currStopId)) {
          visitedStops.add(currStopId);
          const st = g.stops[currStopId];
          if (st) {
            altStops.push({ id: st.id, name: st.name, nextStopId: st.nextStopId });
            currStopId = st.nextStopId;
          } else break;
        }

        altSections.push({
          id: altSeg.id,
          firstStopId: altSeg.firstStopId,
          nextNodeId: altSeg.nextNodeId,
          stops: altStops
        });

        const nextN = g.nodes[altSeg.nextNodeId];
        if (nextN && nextN.isBranchNode && nextN.nextSegId) {
          currAltSegId = nextN.nextSegId;
        } else {
          break;
        }
      }

      if (altSections.length > 0) {
        const lastSec = altSections[altSections.length - 1];
        if (lastSec.stops.length > 0) {
          const lastSt = lastSec.stops[lastSec.stops.length - 1];
          const brConfig = node.branchConfig || {};
          let targetNextStopId = (brConfig.targetType !== 'node' && brConfig.targetStopId) ? brConfig.targetStopId : null;
          lastSt.nextStopId = targetNextStopId;
        }
      }

      const brConfig = node.branchConfig || {};
      let finishDescription = '';
      if ((brConfig.targetType === 'stop' || brConfig.targetType === 'current') && brConfig.targetStopId) {
        const targetStop = g.stops[brConfig.targetStopId];
        const stopName = targetStop?.name || `Stop #${brConfig.targetStopId}`;
        const targetSeg = Object.values(g.segments).find(s => {
          let curr = s.firstStopId;
          const visited = new Set();
          while (curr && !visited.has(curr)) {
            visited.add(curr);
            if (String(curr) === String(brConfig.targetStopId)) return true;
            curr = g.stops[curr]?.nextStopId;
          }
          return false;
        });
        const targetNode = targetSeg ? g.nodes[targetSeg.nextNodeId] : null;
        finishDescription = `Злиття з зупинкою "${stopName}" (ID: ${brConfig.targetStopId}) ➔ далі до контрольної "${targetNode?.name || 'Вузол #' + (targetSeg?.nextNodeId || '?')}"`;
      } else if (brConfig.targetType === 'node' && brConfig.targetNodeId) {
        const targetNode = g.nodes[brConfig.targetNodeId];
        finishDescription = `Злиття з контрольною точкою "${targetNode?.name || 'Вузол #' + brConfig.targetNodeId}" (ID: ${brConfig.targetNodeId})`;
      } else {
        finishDescription = `Злиття з точкою основного кола (targetType: ${brConfig.targetType || 'node'})`;
      }

      branchInfo = {
        altSegId: node.altSegId,
        sections: altSections,
        targetType: brConfig.targetType || 'node',
        targetNodeId: brConfig.targetNodeId,
        targetStopId: brConfig.targetStopId,
        finishDescription
      };
    }

    chain.push({
      type: 'node',
      id: node.id,
      name: node.name || `Вузол ${node.id}`,
      side: node.side || 'top/bot',
      isTerminus: node.isTerminus,
      nextSegId: node.nextSegId,
      altSegId: node.altSegId,
      branchInfo
    });

    if (node.nextSegId) {
      const seg = g.segments[node.nextSegId];
      if (seg) {
        const segStops = [];
        let currStopId = seg.firstStopId;
        const visitedStops = new Set();
        while (currStopId && !visitedStops.has(currStopId)) {
          visitedStops.add(currStopId);
          const st = g.stops[currStopId];
          if (st) {
            segStops.push({ id: st.id, name: st.name, nextStopId: st.nextStopId });
            currStopId = st.nextStopId;
          } else break;
        }

        chain.push({
          type: 'segment',
          id: seg.id,
          side: seg.side || 'main',
          travelTime: seg.travelTime,
          interval: seg.interval,
          intervalMax: seg.intervalMax,
          firstStopId: seg.firstStopId,
          nextNodeId: seg.nextNodeId,
          stops: segStops
        });

        currNodeId = seg.nextNodeId;
      } else {
        break;
      }
    } else {
      break;
    }
  }

  return chain;
});

/* ─────────── Sidebar Toggle & Resize ─────────── */
const isSidebarOpen = ref(true);
const sidebarWidth = ref(380);
const isResizing = ref(false);

const startResize = () => {
  isResizing.value = true;
  document.addEventListener('mousemove', handleResize);
  document.addEventListener('mouseup', stopResize);
};

const handleResize = (e) => {
  if (isResizing.value) {
    const newWidth = window.innerWidth - e.clientX;
    if (newWidth > 300 && newWidth < 800) {
      sidebarWidth.value = newWidth;
    }
  }
};

const stopResize = () => {
  isResizing.value = false;
  document.removeEventListener('mousemove', handleResize);
  document.removeEventListener('mouseup', stopResize);
};

/* ─────────── Branch Mode & Rotation ─────────── */
const isBranchMode = ref(false);
const isChainToggleMode = ref(false);
const isEditable = ref(!isViewMode.value);

/* ─────────── Leaflet Mini Map (View Mode) ─────────── */
const miniMapContainer = ref(null);
let miniMap = null;
let miniMapPolyline = null;

const fallbackCoordinatesMap = {
  1: [[50.9350, 34.7600], [50.9165, 34.7952], [50.9112, 34.7998], [50.8996, 34.8328], [50.8855, 34.8610]],
  2: [[50.8942, 34.7820], [50.9165, 34.7952], [50.9078, 34.7985], [50.9238, 34.8195], [50.9420, 34.7450]],
  3: [[50.8920, 34.7650], [50.9078, 34.7985], [50.8996, 34.8328], [50.8872, 34.8475]],
  4: [[50.9520, 34.7720], [50.9210, 34.8110], [50.8996, 34.8328], [50.8855, 34.8610]],
  5: [[50.9380, 34.8350], [50.9085, 34.8310], [50.9078, 34.7985], [50.8960, 34.7780]],
  6: [[50.9238, 34.8195], [50.9112, 34.7998], [50.8996, 34.8328], [50.8910, 34.8180]]
};

function getRouteRealCoordinates() {
  const coords = [];
  const seenIds = new Set();

  const addStopCoord = (realId) => {
    if (!realId || seenIds.has(realId)) return;
    const st = stopsStore.stopsList.find(s => Number(s.stopId) === Number(realId));
    if (st && st.latitude > 40 && st.longitude > 20) {
      seenIds.add(realId);
      coords.push([st.latitude, st.longitude]);
    }
  };

  if (topNode.value?.realId) addStopCoord(topNode.value.realId);
  const activeRightSegs = (activeChainAnalysis.value?.previewSegments || segments.value).filter(s => s.side === 'right');
  activeRightSegs.forEach(seg => {
    (seg.stops || []).forEach(st => addStopCoord(st.realId));
    const endN = routeGraph.value?.nodes?.[seg.nextNodeId];
    if (endN?.realId) addStopCoord(endN.realId);
  });
  if (bottomNode.value?.realId) addStopCoord(bottomNode.value.realId);

  if (coords.length >= 2) return coords;
  return fallbackCoordinatesMap[editingRouteId.value || 1] || fallbackCoordinatesMap[1];
}

function initMiniMap() {
  if (!miniMapContainer.value) return;
  const coords = getRouteRealCoordinates();
  try {
    if (miniMap && miniMapContainer.value._leaflet_id) {
      if (miniMapPolyline) {
        miniMapPolyline.setLatLngs(coords);
        miniMapPolyline.setStyle({ color: routeColor.value || '#1D43EF' });
        miniMap.invalidateSize();
        miniMap.fitBounds(miniMapPolyline.getBounds(), { padding: [18, 18], animate: false });
      }
      return;
    }

    if (miniMap) {
      miniMap.remove();
      miniMap = null;
    }

    miniMap = L.map(miniMapContainer.value, {
      center: [50.9100, 34.8050],
      zoom: 12,
      zoomControl: false,
      attributionControl: false,
      zoomAnimation: false,
      fadeAnimation: false
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18
    }).addTo(miniMap);

    miniMapPolyline = L.polyline(coords, {
      color: routeColor.value || '#1D43EF',
      weight: 4,
      opacity: 0.9
    }).addTo(miniMap);

    miniMap.fitBounds(miniMapPolyline.getBounds(), { padding: [18, 18], animate: false });
    setTimeout(() => {
      if (miniMap && isViewMode.value) {
        miniMap.invalidateSize();
        if (miniMapPolyline) miniMap.fitBounds(miniMapPolyline.getBounds(), { padding: [18, 18], animate: false });
      }
    }, 180);
  } catch (err) {
    console.error('Mini map init error:', err);
  }
}

watch(isViewMode, (val) => {
  if (val) {
    isEditable.value = false;
    isBranchMode.value = false;
    nextTick(() => {
      initMiniMap();
      canvasRef.value?.resetView(true);
    });
  } else {
    if (miniMap) {
      miniMap.remove();
      miniMap = null;
      miniMapPolyline = null;
    }
    isEditable.value = true;
    nextTick(() => {
      canvasRef.value?.resetView(true);
    });
  }
});

/* ─────────── View Panel Computed Info ─────────── */
const terminus1DisplayName = computed(() => {
  return topNode.value?.terminusStop || topNode.value?.name || 'Кінцева 1';
});

const terminus2DisplayName = computed(() => {
  return bottomNode.value?.terminusStop || bottomNode.value?.name || 'Кінцева 2';
});

const activePeriodObj = computed(() => {
  return routePeriods.value[selectedPeriodIdx.value] || routePeriods.value[0] || { period: '06:00 - 09:00', travelTime: totalTime.value };
});

const currentRouteTravelTime = computed(() => {
  return totalTime.value || activePeriodObj.value?.travelTime || 109;
});

const totalPoints = computed(() => {
  if (activeChainAnalysis.value?.previewNodes) {
    return activeChainAnalysis.value.previewNodes.length + totalStops.value;
  }
  return nodes.value.length + totalStops.value;
});

const restCount = computed(() => {
  return nodes.value.filter(n => n.isTerminus && (n.waitMin > 0 || n.waitMax > 0)).length;
});

const lunchCount = computed(() => {
  return nodes.value.filter(n => n.canLunch).length;
});

const depotCount = computed(() => {
  return nodes.value.filter(n => n.isDepot || getStopType(n.realId) === 'depo').length;
});

const isTableViewOpen = ref(false);

function enterEditMode() {
  isViewMode.value = false;
  isEditable.value = true;
  if (editingRouteId.value) {
    router.replace({ name: 'route-create', query: { id: editingRouteId.value } });
  }
}

function deleteCurrentRoute() {
  const fullBadge = `${routeNumber.value}${routeLetter.value}`;
  if (!confirm(`Ви дійсно бажаєте видалити маршрут ${fullBadge}?`)) return;
  if (editingRouteId.value) {
    routesStore.deleteRoute(editingRouteId.value);
  }
  if (routesStore.routes.length > 0) {
    switchRoute(routesStore.routes[0].id);
  } else {
    router.push('/base/route');
  }
}

function saveCurrentRoute() {
  saveActivePeriodSegments();
  const fullNumber = `${(routeNumber.value || '1').trim()}${(routeLetter.value || '').trim()}`;
  const t1 = topNode.value?.terminusStop || topNode.value?.name || 'Кінцева 1';
  const t2 = bottomNode.value?.terminusStop || bottomNode.value?.name || 'Кінцева 2';
  const isOneTerminus = !bottomNode.value || !bottomNode.value.isTerminus;
  const routeName = isOneTerminus ? `${t1} (Кільцевий)` : `${t1} – ${t2}`;
  const turnaround = routePeriods.value[0]?.travelTime || totalTime.value || 96;
  const clonedGraph = JSON.parse(JSON.stringify(routeGraph.value));

  const periodTimes = routePeriods.value.map(p => ({
    period: p.period,
    travelTime: p.travelTime || turnaround,
    interval: p.interval || '16',
    intervalMax: p.intervalMax || '20',
    segmentsData: p.segmentsData ? JSON.parse(JSON.stringify(p.segmentsData)) : undefined,
    disabledIds: p.disabledIds ? [...p.disabledIds] : []
  }));

  if (editingRouteId.value && routesStore.routes.some(r => r.id === editingRouteId.value)) {
    routesStore.updateRoute(editingRouteId.value, {
      number: fullNumber,
      routeNumberRaw: routeNumber.value,
      routeLetterRaw: routeLetter.value,
      transportType: routeTransportType.value,
      name: routeName,
      color: routeColor.value,
      pointsCount: totalPoints.value,
      length: `${turnaround} хв`,
      selectedWorkMode: selectedWorkMode.value,
      timeStart: timeStart.value,
      timeEnd: timeEnd.value,
      periodTimes,
      graph: clonedGraph
    });
    isViewMode.value = true;
    router.push({ name: 'route-detail', params: { id: editingRouteId.value } });
  } else {
    const maxId = routesStore.routes.reduce((m, r) => Math.max(m, Number(r.id) || 0), 0);
    const newId = maxId + 1;
    routesStore.addRoute({
      id: newId,
      number: fullNumber,
      routeNumberRaw: routeNumber.value,
      routeLetterRaw: routeLetter.value,
      transportType: routeTransportType.value,
      name: routeName,
      status: 'Активний',
      pointsCount: totalPoints.value,
      color: routeColor.value,
      length: `${turnaround} хв`,
      selectedWorkMode: selectedWorkMode.value,
      timeStart: timeStart.value,
      timeEnd: timeEnd.value,
      periodTimes,
      graph: clonedGraph
    });
    isViewMode.value = true;
    router.push({ name: 'route-detail', params: { id: newId } });
  }
}

const isRotated180 = ref(false);
const isRotatingAnim = ref(false);

function handleRotate180() {
  if (isRotatingAnim.value) return;
  isRotatingAnim.value = true;

  setTimeout(() => {
    rotateGraph180(routeGraph.value);
    undoStack.value.forEach(entry => {
      if (entry?.snapshot) rotateGraph180(entry.snapshot);
    });
    redoStack.value.forEach(entry => {
      if (entry?.snapshot) rotateGraph180(entry.snapshot);
    });
    isRotated180.value = !isRotated180.value;
  }, 850);

  setTimeout(() => {
    isRotatingAnim.value = false;
  }, 1550);
}

/* ─────────── routeData object for canvas ─────────── */
const showIssuesOnCanvas = ref(true);

const routeData = computed(() => {
  const singlePreview = isSingleLoopPreview.value;
  const analysis = activeChainAnalysis.value;
  const rawNodes = singlePreview && analysis?.previewNodes?.length
    ? analysis.previewNodes
    : nodes.value;
  const rawSegments = singlePreview && analysis?.previewSegments?.length
    ? analysis.previewSegments
    : segments.value;
  const rawBranches = singlePreview ? [] : branches.value;

  return {
    routeNumber: `${routeNumber.value || '1'}${routeLetter.value || ''}`,
    originNodeId: routeGraph.value?.originNodeId || routeGraph.value?.startNodeId,
    nodes: rawNodes.map(n => ({
      ...n,
      isDepot: n.isDepot || getStopType(n.realId) === 'depo'
    })),
    segments: rawSegments,
    branches: rawBranches,
    color: routeColor.value,
    transportType: routeTransportType.value,
    nodeTravelTimes: analysis?.nodeTravelTimes || null,
    chainAnalysis: singlePreview ? null : analysis,
    validation: (isViewMode.value || !showIssuesOnCanvas.value) ? null : {
      nodeIssues: validationIssues.value.nodeIssues || {},
      stopIssues: validationIssues.value.stopIssues || {},
      segmentIssues: validationIssues.value.segmentIssues || {}
    }
  };
});

// Helper to resolve start and end node for any segment
function getSegmentEndpoints(seg) {
  if (!seg) return { fromNode: null, toNode: null };
  if (seg.isBranch && seg.startNode && seg.endNode) {
    return { fromNode: seg.startNode, toNode: seg.endNode };
  }
  
  const fromNodeId = seg.fromNodeId || Object.keys(routeGraph.value.nodes).find(nId => String(routeGraph.value.nodes[nId]?.nextSegId) === String(seg.id));
  const toNodeId = seg.nextNodeId;
  
  const fromNode = nodes.value.find(n => String(n.id) === String(fromNodeId)) || (fromNodeId ? routeGraph.value.nodes[fromNodeId] : null);
  const toNode = nodes.value.find(n => String(n.id) === String(toNodeId)) || (toNodeId ? routeGraph.value.nodes[toNodeId] : null);
  
  return { fromNode, toNode };
}

// Control nodes forming the currently edited segment
const activeSegmentNodes = computed(() => {
  if (!activeSegment.value) return [];
  const { fromNode, toNode } = getSegmentEndpoints(activeSegment.value);
  if (fromNode && toNode) {
    return [fromNode, toNode];
  }
  return [];
});

function getBranchTargetSegIdx(b) {
  const segs = segments.value;
  if (!b || !segs) return b?.segIdx ?? 0;
  if (b.targetStopId) {
    const sIdx = segs.findIndex(s => s.stops && s.stops.some(st => String(st.id) === String(b.targetStopId)));
    if (sIdx !== -1) return sIdx;
  }
  if (b.targetNodeId && b.targetType !== 'bottom_arc') {
    const sIdx = segs.findIndex(s => String(s.nextNodeId) === String(b.targetNodeId));
    if (sIdx !== -1) return sIdx;
  }
  return b.segIdx ?? 0;
}

function addStop(sIdx, side, insertIdx = -1, isAfterMerge = false) {
  const seg = segments.value[sIdx];
  if (!seg) return;
  takeSnapshot('Додавання зупинки', { sIdx, side, insertIdx, isAfterMerge });
  const newStopId = addStopGraph(routeGraph.value, seg.id, side, insertIdx);

  if ((isAfterMerge || insertIdx === -1) && newStopId) {
    const mergingBranches = (branches.value || []).filter(b => {
      if (!b.finished || b.targetType === 'bottom_arc' || b.targetType === 'node') return false;
      const targetSegIdx = getBranchTargetSegIdx(b);
      const isThisSeg = (targetSegIdx === sIdx);
      const hasValidTargetStop = b.targetStopId && seg.stops && seg.stops.some(st => String(st.id) === String(b.targetStopId));
      return isThisSeg && (!b.targetStopId || !hasValidTargetStop);
    });

    for (const mergingBranch of mergingBranches) {
      const startNodeId = mergingBranch.id.replace('br_', '');
      setBranchConfigGraph(routeGraph.value, startNodeId, {
        targetStopId: newStopId,
        targetType: 'stop'
      });
    }
  }
}

function removeStop(sIdx, stIdx) {
  const seg = segments.value[sIdx];
  if (!seg) return;
  const stopId = seg.stops[stIdx]?.id;
  if (!stopId) return;
  takeSnapshot('Видалення зупинки', { sIdx, stIdx, stopId });
  removeStopGraph(routeGraph.value, seg.id, stopId);
}

function addControlNode(side = 'right', explicitSegIdx = -1, posMode = 'before', insertIdx = -1) {
  let targetSegIdx = explicitSegIdx;

  if (targetSegIdx === -1) {
    const sideSegs = segments.value.filter(s => s.side === side);
    if (sideSegs.length > 0) {
      const targetSeg = side === 'right' ? sideSegs[sideSegs.length - 1] : sideSegs[0];
      targetSegIdx = segments.value.indexOf(targetSeg);
    } else {
      targetSegIdx = side === 'right' ? 0 : (segments.value.length - 1);
    }
  }

  if (targetSegIdx === -1 || !segments.value[targetSegIdx]) return null;
  const targetSegId = segments.value[targetSegIdx].id;

  takeSnapshot('Додавання контрольної точки', { side, targetSegIdx, posMode, insertIdx });
  const newId = addControlNodeGraph(routeGraph.value, targetSegId, posMode, side, insertIdx);

  setTimeout(() => {
    if (canvasRef.value) canvasRef.value.focusNode(newId);
  }, 80);
  
  return newId;
}

function removeNode(idx) {
  const nodeId = nodes.value[idx]?.id;
  if (!nodeId) return;
  takeSnapshot('Видалення вузла', { idx, nodeId });
  removeNodeGraph(routeGraph.value, nodeId);
}

function addBranch(sIdx, parentBranchId = null, parentNodeId = null) {
  const segId = segments.value[sIdx]?.id;
  if (!segId) return null;
  takeSnapshot('Створення розгалуження', { sIdx, parentBranchId, parentNodeId });
  const newBrNodeId = addBranchGraph(routeGraph.value, segId);
  return newBrNodeId;
}

const activeBranchToConfig = ref(null);

function configBranch(br) {
  activeBranchToConfig.value = br;
}

function configNormalMerge() {
  if (activeBranchToConfig.value) {
    takeSnapshot('Завершення розгалуження (порожнє)', { brId: activeBranchToConfig.value.id });
    const startNodeId = activeBranchToConfig.value.id.replace('br_', '');
    setBranchConfigGraph(routeGraph.value, startNodeId, {
      targetType: 'current',
      targetNodeId: null,
      mergeConfigured: 'solid',
      bypassedMainState: 'empty',
      finished: true
    });
  }
  activeBranchToConfig.value = null;
}

function configAddMainLoopSegment() {
  if (activeBranchToConfig.value) {
    takeSnapshot('Завершення розгалуження (з пілами)', { brId: activeBranchToConfig.value.id });
    const br = activeBranchToConfig.value;
    const startNodeId = br.id.replace('br_', '');
    const parentSegId = routeGraph.value.nodes[startNodeId]?.nextSegId;
    const parentSeg = parentSegId ? routeGraph.value.segments[parentSegId] : null;

    setBranchConfigGraph(routeGraph.value, startNodeId, {
      targetType: 'current',
      targetNodeId: null,
      targetStopId: parentSeg ? parentSeg.firstStopId : null,
      mergeConfigured: 'add_inside',
      bypassedMainState: 'add_pills',
      finished: true
    });
  }
  activeBranchToConfig.value = null;
}

function configMakeControlNode() {
  if (activeBranchToConfig.value) {
    takeSnapshot('Завершення розгалуження (у контрольну точку)', { brId: activeBranchToConfig.value.id });
    const br = activeBranchToConfig.value;
    const startNodeId = br.id.replace('br_', '');
    const seg = segments.value[br.segIdx];
    const side = seg ? (seg.side || 'right') : 'right';
    const newControlNodeId = addControlNode(side, br.segIdx, 'after');
    
    setBranchConfigGraph(routeGraph.value, startNodeId, {
      targetType: 'node',
      targetNodeId: newControlNodeId,
      finished: true
    });
  }
  activeBranchToConfig.value = null;
}

const finishBranchTarget = ref(null);
const selectedFinishType = ref('current');
const selectedFinishNodeId = ref(null);

const currentFinishingBranch = computed(() => branches.value.find(b => b.id === finishBranchTarget.value));
const isFinishingSubBranch = computed(() => !!currentFinishingBranch.value?.parentBranchId);

const parentBranchForFinishing = computed(() => {
  if (!isFinishingSubBranch.value) return null;
  return branches.value.find(b => b.id === currentFinishingBranch.value.parentBranchId);
});

const finishingNodeOptions = computed(() => {
  if (isFinishingSubBranch.value) {
    return parentBranchForFinishing.value?.nodes || [];
  } else {
    const brSegIdx = currentFinishingBranch.value?.segIdx ?? 0;
    const seg = segments.value[brSegIdx] || segments.value[0];
    const side = seg?.side || 'right';
    const allSideNodes = nodes.value.filter(n => n.side === side || n.isTerminus);
    const startNodeId = currentFinishingBranch.value?.startNodeId || currentFinishingBranch.value?.id?.replace('br_', '');
    const startIdx = allSideNodes.findIndex(n => String(n.id) === String(startNodeId));
    if (startIdx !== -1) {
      return allSideNodes.slice(startIdx + 1);
    }
    return allSideNodes;
  }
});

function finishBranch(brId) {
  finishBranchTarget.value = brId;
  const br = branches.value.find(b => b.id === brId);
  selectedFinishType.value = br?.targetType || 'current';
  selectedFinishNodeId.value = br?.targetNodeId || finishingNodeOptions.value[0]?.id || null;
}

function confirmFinishBranch() {
  if (!finishBranchTarget.value) return;
  takeSnapshot('Завершення розгалуження', { targetType: selectedFinishType.value });
  const startNodeId = finishBranchTarget.value.replace('br_', '');
  const config = {
    targetType: selectedFinishType.value,
    targetNodeId: selectedFinishNodeId.value,
    finished: true
  };
  if (config.targetType === 'current') {
    config.bypassedMainState = 'add_pills';
    const parentSegId = routeGraph.value.nodes[startNodeId]?.nextSegId;
    const parentSeg = parentSegId ? routeGraph.value.segments[parentSegId] : null;
    config.targetStopId = parentSeg ? parentSeg.firstStopId : null;
    config.targetNodeId = parentSeg ? parentSeg.nextNodeId : null;
  } else if (config.targetType === 'node') {
    config.bypassedMainState = 'add_pills';
    config.targetStopId = null;
    if (!config.targetNodeId && finishingNodeOptions.value.length > 0) {
      config.targetNodeId = finishingNodeOptions.value[0].id;
    }
  } else if (config.targetType === 'bottom_arc' || config.targetType === 'parent_end') {
    config.bypassedMainState = 'add_pills';
    config.targetStopId = null;
    config.targetNodeId = null;
  }
  setBranchConfigGraph(routeGraph.value, startNodeId, config);
  finishBranchTarget.value = null;
}

function addBranchNode(brId, sectionIdx = 0, posMode = 'after') {
  takeSnapshot('Додавання точки на розгалуженні', { brId, sectionIdx, posMode });
  const startNodeId = brId.replace('br_', '');
  addBranchNodeGraph(routeGraph.value, startNodeId, sectionIdx, posMode);
}

function extendBranchWithStop(brId) {
  takeSnapshot('Продовження розгалуження з зупинкою', { brId });
  const startNodeId = brId.replace('br_', '');
  const newBrNodeId = addBranchNodeGraph(routeGraph.value, startNodeId);
  if (newBrNodeId) {
    const newSeg = Object.values(routeGraph.value.segments).find(s => s.nextNodeId === newBrNodeId);
    if (newSeg) {
      addStopGraph(routeGraph.value, newSeg.id, newSeg.side || 'right');
    }
  }
}

function addBranchStop(brId, sectionIdx = 0) {
  const br = branches.value.find(b => b.id === brId);
  if (br && br.sections[sectionIdx]) {
    takeSnapshot('Додавання зупинки на розгалуженні', { brId, sectionIdx });
    addStopGraph(routeGraph.value, br.sections[sectionIdx].id, br.sections[sectionIdx].side || 'right');
  }
}

function editBranchStop() {
  // Handled in sidebar
}

function editBranchNode(brId, bNIdx) {
  const br = branches.value.find(b => b.id === brId);
  if (br && br.nodes && br.nodes[bNIdx]) {
    const currentNode = br.nodes[bNIdx];
    const graphNode = routeGraph.value.nodes[currentNode.id];
    if (graphNode) {
      editNode.value = {
        ...graphNode,
        _branchId: brId,
        _branchNodeIdx: bNIdx
      };
    }
  }
}

function deleteEditedControlNode() {
  if (!editNode.value) return;
  const target = editNode.value;
  if (target._branchId !== undefined && target._branchNodeIdx !== undefined) {
    takeSnapshot('Видалення контрольної точки на розгалуженні', { brId: target._branchId, bNIdx: target._branchNodeIdx });
    removeBranchNodeGraph(routeGraph.value, String(target._branchId).replace('br_', ''), target._branchNodeIdx);
    editNode.value = null;
    return;
  }
  const idx = nodes.value.findIndex(n => String(n.id) === String(target.id));
  if (idx !== -1 && !nodes.value[idx]?.isTerminus) {
    removeNode(idx);
    editNode.value = null;
  }
}

/* ─────────── Edit overlays ─────────── */
const editSeg  = ref(null);
const editNode = ref(null);

/* ─────────── Totals ─────────── */
const totalStops = computed(() => {
  if (activeChainAnalysis.value) {
    return activeChainAnalysis.value.dynamicTotalStops;
  }
  return segments.value.reduce((a, s) => a + s.stops.length, 0);
});
const firstTerminus = computed(() => {
  const originId = routeGraph.value?.originNodeId;
  if (originId) {
    const found = endNodes.value.find(n => String(n.id) === String(originId));
    if (found) return found;
  }
  return endNodes.value[0] || null;
});

const totalTime  = computed(() => {
  if (activeChainAnalysis.value) {
    return activeChainAnalysis.value.dynamicTotalTime;
  }
  const travel = segments.value.reduce((a, s) => a + Number(s.travelTime || 0), 0);
  let wait = endNodes.value.reduce((a, n) => a + Number(n.waitMin || 0), 0);
  if (firstTerminus.value && endNodes.value.length > 1) {
    wait -= Number(firstTerminus.value.waitMin || 0);
  }
  return travel + wait;
});

watch(totalTime, (val) => {
  const activeP = routePeriods.value[selectedPeriodIdx.value];
  if (activeP && Number.isFinite(val)) {
    activeP.travelTime = val;
  }
});
const endNodes   = computed(() => nodes.value.filter(n => n.isTerminus));
const topNode    = computed(() => nodes.value.find(n => !n.side || n.side === 'top') || nodes.value[0] || null);
const bottomNode = computed(() => nodes.value.find(n => n.side === 'bottom') || nodes.value.filter(n => !n.side)[1] || null);

/* ─────────── Validation & Errors ─────────── */
const isErrorDetailsOpen = ref(false);

const validationIssues = computed(() => {
  const redErrors = [];
  const yellowWarnings = [];
  const conflictWarnings = [];

  const terminusCount = nodes.value.filter(n => n.isTerminus).length;
  if (terminusCount === 0) {
    redErrors.push({
      id: 'no-terminus',
      category: 'terminus',
      severity: 'red',
      title: 'Маршрут без кінцевої',
      description: 'Необхідно встановити хоча б одну кінцеву зупинку'
    });
  }

  const realIdOccurrences = new Map();
  const trackOccurrence = (realId, itemInfo) => {
    if (!realId) return;
    const key = String(realId);
    if (!realIdOccurrences.has(key)) realIdOccurrences.set(key, []);
    realIdOccurrences.get(key).push(itemInfo);
  };

  const nodeIssues = {};
  const stopIssues = {};
  const segmentIssues = {};
  const severityPriority = { red: 3, yellow: 2, grey: 1 };
  const setSeverity = (map, key, sev) => {
    if (!key) return;
    const k = String(key);
    const cur = map[k];
    if (cur && (severityPriority[cur] || 0) >= (severityPriority[sev] || 0)) return;
    map[k] = sev;
  };

  // Validate single turnaround loop per time period
  const originId = routeGraph.value?.originNodeId || routeGraph.value?.startNodeId;
  routePeriods.value.forEach((pt, pIdx) => {
    const pAnalysis = (pIdx === selectedPeriodIdx.value)
      ? activeChainAnalysis.value
      : analyzeRouteChains(nodes.value, segments.value, branches.value, pt.disabledIds || [], originId);

    if (pAnalysis && !pAnalysis.hasSingleLoop) {
      let reasonText = '';
      if (pAnalysis.isBrokenLoop) {
        reasonText = 'Коло оберту розірвано — немає неперервного шляху між кінцевими';
      } else if (pAnalysis.isMultipleLoops) {
        reasonText = `Одночасно увімкнено основну ділянку та альтернативу (${pAnalysis.totalLoops} кіл оберту) — вимкніть зайві гілки або ділянки`;
      } else {
        reasonText = 'Увімкнено зайву ділянку або незавершену альтернативу поза єдиним колом оберту';
      }

      redErrors.push({
        id: `period-loop-error-${pIdx}`,
        category: 'loop',
        severity: 'red',
        periodIdx: pIdx,
        title: `Немає єдиного кола оберту (${pt.period})`,
        description: reasonText
      });

      if (pIdx === selectedPeriodIdx.value) {
        if (pAnalysis.isBrokenLoop) {
          (pAnalysis.chains || []).forEach(ch => {
            if (!ch.disabled) return;
            (ch.edges || []).forEach(edge => {
              setSeverity(segmentIssues, edge.id, 'red');
              if (edge.parentSegId !== undefined) setSeverity(segmentIssues, edge.parentSegId, 'red');
            });
          });
        } else {
          // Highlight parallel chains where multiple paths between junctions are enabled simultaneously
          const danglingIds = new Set((pAnalysis.danglingEnabledChains || []).map(c => c.id));
          (pAnalysis.chains || []).forEach(ch => {
            if (ch.disabled) return;
            const hasParallelEnabled = (pAnalysis.chains || []).some(c2 =>
              c2.id !== ch.id &&
              !c2.disabled &&
              c2.side === ch.side &&
              (c2.fromVertex === ch.fromVertex || c2.toVertex === ch.toVertex)
            );
            if (hasParallelEnabled || danglingIds.has(ch.id)) {
              (ch.edges || []).forEach(edge => {
                setSeverity(segmentIssues, edge.id, 'red');
                if (edge.parentSegId !== undefined) setSeverity(segmentIssues, edge.parentSegId, 'red');
              });
            }
          });
        }
      }
    }
  });

  const curDisabledNodes = activeChainAnalysis.value?.disabledNodeIds || new Set();
  const curDisabledStops = activeChainAnalysis.value?.disabledStopIds || new Set();
  const curDisabledSubSegs = activeChainAnalysis.value?.disabledSubSegIds || new Set();

  // Group segments and nodes by direction leg (separated by terminus nodes)
  const legBySegmentId = {};
  const legByNodeId = {};
  let currentLeg = 0;
  const startTerminus = nodes.value.find(n => n.isTerminus) || nodes.value[0];
  if (startTerminus) {
    let currN = startTerminus;
    const visitedN = new Set();
    while (currN && !visitedN.has(String(currN.id))) {
      visitedN.add(String(currN.id));
      if (currN.isTerminus && String(currN.id) !== String(startTerminus.id)) {
        currentLeg++;
      }
      legByNodeId[String(currN.id)] = currentLeg;
      const seg = segments.value.find(s => String(s.fromNodeId) === String(currN.id) || String(s.id) === String(currN.nextSegId));
      if (!seg) break;
      legBySegmentId[String(seg.id)] = currentLeg;
      const nextN = nodes.value.find(n => String(n.id) === String(seg.nextNodeId));
      if (!nextN || String(nextN.id) === String(startTerminus.id)) break;
      currN = nextN;
    }
  }

  const getItemLeg = (item) => {
    if (item.leg !== undefined) return item.leg;
    if (item.type === 'node') {
      const l = legByNodeId[String(item.id)];
      if (l !== undefined) return l;
      const n = nodes.value.find(nd => String(nd.id) === String(item.id));
      return n?.side === 'left' ? 1 : 0;
    }
    if (item.segId) {
      const l = legBySegmentId[String(item.segId)];
      if (l !== undefined) return l;
      const s = segments.value.find(sg => String(sg.id) === String(item.segId));
      return s?.side === 'left' ? 1 : 0;
    }
    return 0;
  };

  nodes.value.forEach(node => {
    if (node.type === 'virtual') return;
    if (!curDisabledNodes.has(String(node.id))) {
      trackOccurrence(node.realId, { type: 'node', id: node.id, name: node.name });
    }

    if (node.isTerminus) {
      if (!node.realId && !node.terminusStop) {
        setSeverity(nodeIssues, node.id, 'red');
        redErrors.push({
          id: `unassigned-terminus-${node.id}`,
          nodeId: node.id,
          category: 'terminus',
          severity: 'red',
          title: `Не призначена кінцева: ${node.name || 'Кінцева'}`,
          description: 'Потрібно прив\'язати кінцеву зупинку'
        });
      }
    } else {
      if (!node.realId) {
        setSeverity(nodeIssues, node.id, 'red');
        redErrors.push({
          id: `unassigned-control-${node.id}`,
          nodeId: node.id,
          category: 'control',
          severity: 'red',
          title: `Не призначена контрольна: ${node.name || 'Контрольна'}`,
          description: 'Потрібно прив\'язати контрольну точку'
        });
      }
    }
  });

  segments.value.forEach(seg => {
    const { fromNode, toNode } = getSegmentEndpoints(seg);
    if (fromNode && nodeIssues[String(fromNode.id)] === 'red') {
      setSeverity(segmentIssues, seg.id, 'red');
    }
    if (toNode && nodeIssues[String(toNode.id)] === 'red') {
      setSeverity(segmentIssues, seg.id, 'red');
    }

    if (seg.stops && seg.stops.length > 0) {
      const segName = getSegmentName(seg);
      seg.stops.forEach(st => {
        if (!curDisabledStops.has(String(st.id))) {
          trackOccurrence(st.realId, { type: 'stop', id: st.id, segId: seg.id, name: st.name });
        }
        if (!st.realId) {
          setSeverity(stopIssues, st.id, 'yellow');
          setSeverity(segmentIssues, seg.id, 'yellow');
          yellowWarnings.push({
            id: `unassigned-stop-${st.id}`,
            stopId: st.id,
            segId: seg.id,
            category: 'stop',
            severity: 'yellow',
            title: `Не призначена зупинка: ${st.name || 'Зупинка'}`,
            description: `${segName}`
          });
        }
      });
    }
  });

  branches.value.forEach(br => {
    const parentSeg = br.segIdx !== undefined ? segments.value[br.segIdx] : null;
    const brLeg = parentSeg ? (legBySegmentId[String(parentSeg.id)] ?? (parentSeg.side === 'left' ? 1 : 0)) : 0;
    const validBrNodes = (br.nodes || []).filter(n => n && n.name !== 'Контрольна (альтернатива)');

    validBrNodes.forEach(bNode => {
      legByNodeId[String(bNode.id)] = brLeg;
      if (!curDisabledNodes.has(String(bNode.id))) {
        trackOccurrence(bNode.realId, { type: 'node', id: bNode.id, name: bNode.name, leg: brLeg });
      }
      if (!bNode.realId) {
        setSeverity(nodeIssues, bNode.id, 'red');
        redErrors.push({
          id: `unassigned-br-control-${bNode.id}`,
          nodeId: bNode.id,
          category: 'control',
          severity: 'red',
          title: `Не призначена контрольна: ${bNode.name || 'Контрольна'}`,
          description: `Альтернатива: ${br.name || 'Розгалуження'}`
        });
      }
    });

    const brOriginNodeId = br.parentBranchId
      ? (br.parentNodeId || br.startNodeId || String(br.id).replace('br_', ''))
      : (br.startNodeId || parentSeg?.fromNodeId || String(br.id).replace('br_', ''));

    let brTargetNodeId = null;
    if (br.finished && !br.targetStopId) {
      if (br.targetType === 'bottom_arc') {
        brTargetNodeId = br.side === 'left' ? topNode.value?.id : bottomNode.value?.id;
      } else {
        brTargetNodeId = br.targetNodeId || parentSeg?.nextNodeId || null;
      }
    }

    (br.sections || []).forEach((sec, si) => {
      legBySegmentId[String(sec.id)] = brLeg;

      const secStartNodeId = si === 0 ? brOriginNodeId : validBrNodes[si - 1]?.id;
      const secEndNodeId = si < validBrNodes.length ? validBrNodes[si]?.id : brTargetNodeId;

      if (secStartNodeId && nodeIssues[String(secStartNodeId)] === 'red') {
        setSeverity(segmentIssues, sec.id, 'red');
      }
      if (secEndNodeId && nodeIssues[String(secEndNodeId)] === 'red') {
        setSeverity(segmentIssues, sec.id, 'red');
      }

      const isSecDisabled = curDisabledSubSegs.has(String(sec.id));
      (sec.stops || []).forEach(st => {
        if (!isSecDisabled && !curDisabledStops.has(String(st.id))) {
          trackOccurrence(st.realId, { type: 'stop', id: st.id, segId: sec.id, name: st.name, leg: brLeg });
        }
        if (!st.realId) {
          setSeverity(stopIssues, st.id, 'yellow');
          setSeverity(segmentIssues, sec.id, 'yellow');
          yellowWarnings.push({
            id: `unassigned-br-stop-${st.id}`,
            stopId: st.id,
            segId: sec.id,
            category: 'stop',
            severity: 'yellow',
            title: `Не призначена зупинка: ${st.name || 'Зупинка'}`,
            description: `Альтернатива: ${br.name || 'Розгалуження'}`
          });
        }
      });
    });
  });

  // Duplicate / conflicting stop assignment check -> only within the SAME direction leg (before passing a terminus) -> grey line on canvas
  realIdOccurrences.forEach((items, realIdKey) => {
    if (items.length > 1) {
      const byLeg = new Map();
      items.forEach(item => {
        const leg = getItemLeg(item);
        if (!byLeg.has(leg)) byLeg.set(leg, []);
        byLeg.get(leg).push(item);
      });

      byLeg.forEach((legItems, legIdx) => {
        if (legItems.length > 1) {
          conflictWarnings.push({
            id: `conflict-stop-${realIdKey}-leg-${legIdx}`,
            category: 'conflict',
            severity: 'grey',
            title: `Попередження: зупинка #${realIdKey} (${legItems[0]?.name || ''})`,
            description: `Зупинка повторюється ${legItems.length} рази до проїзду кінцевої`
          });
          legItems.forEach(item => {
            if (item.type === 'node') {
              setSeverity(nodeIssues, item.id, 'grey');
            } else if (item.type === 'stop') {
              setSeverity(stopIssues, item.id, 'grey');
              if (item.segId) setSeverity(segmentIssues, item.segId, 'grey');
            }
          });
        }
      });
    }
  });

  return {
    redErrors,
    yellowWarnings,
    conflictWarnings,
    nodeIssues,
    stopIssues,
    segmentIssues,
    totalErrors: redErrors.length,
    totalWarnings: yellowWarnings.length,
    totalConflicts: conflictWarnings.length,
    totalCount: redErrors.length + yellowWarnings.length + conflictWarnings.length
  };
});

const getSegmentName = (seg) => {
  if (!seg) return 'Ділянка';
  const { fromNode, toNode } = getSegmentEndpoints(seg);
  if (fromNode && toNode) {
    return `${fromNode.name} → ${toNode.name}`;
  }
  return 'Ділянка';
};

/* ─────────── Sidebar Segment Editor ─────────── */
const activeSegmentId = computed(() => route.query.segmentId);
const activeSegment = computed(() => {
  if (!activeSegmentId.value) return null;
  const rawId = activeSegmentId.value;
  if (String(rawId).startsWith('br_seg_') || String(rawId).startsWith('br_sec_')) {
    for (const br of branches.value) {
      if (br.sections) {
        for (const sec of br.sections) {
          if (String(sec.id) === String(rawId)) {
            sec.isBranch = true;
            const secIdx = br.sections.indexOf(sec);
            
            let realStartNode = null;
            if (secIdx === 0) {
              const mainSeg = segments.value[br.segIdx];
              if (mainSeg) {
                const { fromNode } = getSegmentEndpoints(mainSeg);
                realStartNode = fromNode;
              }
            } else {
              const validBrNodes = (br.nodes || []).filter(n => n && n.name !== 'Контрольна (альтернатива)');
              if (validBrNodes[secIdx - 1]) realStartNode = validBrNodes[secIdx - 1];
              else {
                realStartNode = { id: 'br_node_' + br.id + '_' + (secIdx - 1), name: 'Контрольна', type: 'control' };
              }
            }
            sec.startNode = realStartNode || { id: 'br_sn_' + sec.id, name: "З'єднання", realId: null };

            let realEndNode = null;
            const validBrNodes = (br.nodes || []).filter(n => n && n.name !== 'Контрольна (альтернатива)');
            const brNodesLen = validBrNodes.length;
            if (secIdx < brNodesLen) {
               realEndNode = validBrNodes[secIdx];
            } else {
               if (br.targetStopId) {
                 const targetSeg = segments.value.find(s => s.stops && s.stops.some(st => String(st.id) === String(br.targetStopId)));
                 if (targetSeg) {
                   const { toNode } = getSegmentEndpoints(targetSeg);
                   realEndNode = toNode;
                 }
               }
               if (!realEndNode && br.targetNodeId) {
                 realEndNode = nodes.value.find(n => String(n.id) === String(br.targetNodeId));
               }
               if (!realEndNode) {
                 const mainSeg = segments.value[br.segIdx];
                 if (mainSeg) {
                   const { toNode } = getSegmentEndpoints(mainSeg);
                   realEndNode = toNode;
                 }
               }
            }
            sec.endNode = realEndNode || { id: 'br_en_' + sec.id, name: "Кінець гілки", realId: null };
            
            sec.isBranch = true;
            sec.br = br;

            Object.defineProperty(sec, 'unifiedStops', {
              get() {
                const branchStops = sec.stops || [];
                const secIdx = br.sections.indexOf(sec);
                const isLastSection = secIdx === br.sections.length - 1;
                
                if (br.finished && isLastSection) {
                  let targetSeg = null;
                  let mergeIdx = -1;
                  if (br.targetStopId) {
                    targetSeg = segments.value.find(s => s.stops && s.stops.some(st => String(st.id) === String(br.targetStopId)));
                    if (targetSeg) {
                      mergeIdx = targetSeg.stops.findIndex(st => String(st.id) === String(br.targetStopId));
                    }
                  }
                  if (!targetSeg && (!br.targetType || br.targetType === 'current')) {
                    targetSeg = segments.value[br.segIdx];
                    mergeIdx = targetSeg && targetSeg.stops ? (br.targetStopId ? targetSeg.stops.findIndex(st => String(st.id) === String(br.targetStopId)) : targetSeg.stops.length) : -1;
                  }
                  if (targetSeg && mergeIdx !== -1) {
                    const postMergeStops = (targetSeg.stops || []).slice(mergeIdx);
                    return [...branchStops, ...postMergeStops];
                  }
                }
                return branchStops;
              },
              configurable: true,
              enumerable: true
            });
            
            return sec;
          }
        }
      }
    }
  }
  const id = parseInt(rawId);
  let found = segments.value.find(s => s.id === id);
  if (found) return found;
  for (const br of branches.value) {
    if (br.sections) {
      for (const sec of br.sections) {
        if (sec.id === id) return sec;
      }
    }
  }
  return null;
});

const availableStops = computed(() => {
  return stopsStore.stopsList.map(s => ({
    id: s.stopId,
    name: s.name,
    direction: s.directionComment,
    type: s.type
  }));
});

function getNextSequentialStopId() {
  const maxId = stopsStore.stopsList.reduce((acc, s) => {
    const num = Number(s.stopId);
    return Number.isFinite(num) && num > acc ? num : acc;
  }, 0);
  return maxId + 1;
}

function assignRealStopToSegStop(stopId, realStopIdStr) {
  const graphStop = routeGraph.value.stops[stopId];
  if (!graphStop) return;

  takeSnapshot('Прив\'язка зупинки з реєстру', { stopId, realStopIdStr });
  if (!realStopIdStr) {
    graphStop.realId = null;
    return;
  }
  const realStopId = parseInt(realStopIdStr);
  const realStop = availableStops.value.find(s => String(s.id) === String(realStopId));
  if (realStop) {
    const newId = renameStopIdGraph(routeGraph.value, stopId, realStop.id, realStop.name, {
      realId: realStop.id,
      direction: realStop.direction,
      type: realStop.type
    });
    if (route.query.stopId === String(stopId) && newId) {
      router.replace({ query: { ...route.query, stopId: String(newId) } });
    }
  }
}

function createNewStopForSegStop(stopId, newName) {
  takeSnapshot('Створення нової зупинки в базі', { stopId, newName });
  const newStopId = getNextSequentialStopId();
  stopsStore.addStop({
    stopId: newStopId,
    name: newName,
    directionComment: 'новий напрямок',
    type: 'normal',
    directionCode: 1,
    latitude: 50.9077,
    longitude: 34.7981,
    platformsCount: 1
  });
  const newId = renameStopIdGraph(routeGraph.value, stopId, newStopId, newName, {
    realId: newStopId,
    direction: 'новий напрямок',
    type: 'normal'
  });
  if (route.query.stopId === String(stopId) && newId) {
    router.replace({ query: { ...route.query, stopId: String(newId) } });
  }
}

function getStopDirection(realId) {
  if (!realId) return '';
  const realStop = availableStops.value.find(s => String(s.id) === String(realId));
  return realStop ? realStop.direction : '';
}

function getStopType(realId) {
  if (!realId) return 'normal';
  const realStop = availableStops.value.find(s => String(s.id) === String(realId));
  return realStop ? realStop.type : 'normal';
}

function assignRealStopToNode(nodeOrId, realStopIdStr) {
  const nodeId = typeof nodeOrId === 'object' && nodeOrId !== null ? nodeOrId.id : nodeOrId;
  const graphNode = routeGraph.value.nodes[nodeId];
  if (!graphNode) return;

  takeSnapshot('Прив\'язка вузла до зупинки з реєстру', { nodeId, realStopIdStr });
  if (!realStopIdStr) {
    graphNode.realId = null;
    graphNode.terminusStop = '';
    graphNode.name = graphNode.isTerminus ? `Кінцева ${graphNode.id}` : `Контрольна ${graphNode.id}`;
    return;
  }
  const realStopId = parseInt(realStopIdStr);
  const realStop = availableStops.value.find(s => String(s.id) === String(realStopId));
  if (realStop) {
    const newId = renameNodeIdGraph(routeGraph.value, nodeId, realStop.id, realStop.name, {
      realId: realStop.id,
      terminusStop: realStop.name
    });
    if (editNode.value && String(editNode.value.id) === String(nodeId) && newId) {
      const prevBrId = editNode.value._branchId;
      const prevBrNIdx = editNode.value._branchNodeIdx;
      editNode.value = {
        ...routeGraph.value.nodes[newId],
        _branchId: prevBrId,
        _branchNodeIdx: prevBrNIdx
      };
    }
  }
}

function createNewStopForNode(nodeOrId, newName) {
  const nodeId = typeof nodeOrId === 'object' && nodeOrId !== null ? nodeOrId.id : nodeOrId;
  const graphNode = routeGraph.value.nodes[nodeId];
  if (!graphNode) return;

  takeSnapshot('Створення нової зупинки для вузла', { nodeId, newName });
  const newStopId = getNextSequentialStopId();
  stopsStore.addStop({
    stopId: newStopId,
    name: newName,
    directionComment: graphNode.isTerminus ? 'Кінцева' : 'Контрольна точка',
    type: graphNode.isTerminus ? 'end' : 'normal',
    directionCode: 1,
    latitude: 50.9077,
    longitude: 34.7981,
    platformsCount: 1
  });
  const newId = renameNodeIdGraph(routeGraph.value, nodeId, newStopId, newName, {
    realId: newStopId,
    terminusStop: newName
  });
  if (editNode.value && String(editNode.value.id) === String(nodeId) && newId) {
    const prevBrId = editNode.value._branchId;
    const prevBrNIdx = editNode.value._branchNodeIdx;
    editNode.value = {
      ...routeGraph.value.nodes[newId],
      _branchId: prevBrId,
      _branchNodeIdx: prevBrNIdx
    };
  }
}

function makeTerminus(nodeId) {
  if (!nodeId) return;
  const n = routeGraph.value.nodes[nodeId];
  if (n) {
    takeSnapshot('Зробити кінцевою точкою', { nodeId: n.id });
    n.isTerminus = true;
    if (!n.realId) {
      n.name = `Кінцева ${n.id}`;
    }
    setTimeout(() => {
      if (canvasRef.value) canvasRef.value.focusNode(n.id);
    }, 80);
  }
}

function removeTerminus(node) {
  const nodeId = typeof node === 'object' && node !== null ? node.id : node;
  const graphNode = routeGraph.value.nodes[nodeId];
  if (graphNode) {
    takeSnapshot('Зняти статус кінцевої точки', { nodeId });
    graphNode.isTerminus = false;
    graphNode.realId = null;
    graphNode.terminusStop = '';
    graphNode.name = `Контрольна ${graphNode.id}`;
  }
}

function removeStopFromSeg(seg, stopOrIdx) {
  const stop = typeof stopOrIdx === 'number' ? seg.stops[stopOrIdx] : stopOrIdx;
  if (!stop) return;
  
  takeSnapshot('Видалення зупинки', { segId: seg.id, stopId: stop.id });
  const idx = seg.stops ? seg.stops.findIndex(s => s.id === stop.id) : -1;
  if (idx !== -1) {
    removeStopGraph(routeGraph.value, seg.id, stop.id);
    return;
  }
  
  if (seg.isBranch && seg.br) {
    const targetSeg = segments.value.find(s => s.stops && s.stops.some(st => String(st.id) === String(stop.id)));
    if (targetSeg) {
      removeStopGraph(routeGraph.value, targetSeg.id, stop.id);
    }
  }
}

function closeSegmentEditor() {
  const query = { ...route.query };
  delete query.segmentId;
  router.push({ query });
}

/* ─────────── All Segments (Main + Branches) ─────────── */
const allSegmentsList = computed(() => {
  const list = [];
  const analysis = activeChainAnalysis.value;

  const pushMainSegment = (seg) => {
    const subParts = analysis?.subSegsByParentSegId?.get(String(seg.id)) || [];
    const baseName = getSegmentName(seg);
    if (subParts.length > 1) {
      subParts.forEach((sub, pIdx) => {
        const subBadge = pIdx === 0 ? 'В середині гілки' : "Після з'єднання";
        const hasAlt = isTargetSwitchable(sub.id);
        list.push({
          id: seg.id,
          toggleId: sub.id,
          keyId: sub.id,
          name: baseName,
          subBadge,
          travelTime: sub.travelTime,
          interval: seg.interval,
          intervalMax: seg.intervalMax,
          stops: sub.stops,
          isBranch: false,
          isBypassedMain: !!sub.isBypassedMain,
          hasAlternative: hasAlt,
          disabled: isTargetDisabled(sub.id),
          rawSeg: seg
        });
      });
    } else {
      const toggleId = subParts[0]?.id || String(seg.id);
      const isBypassed = !!subParts[0]?.isBypassedMain || isTargetSwitchable(toggleId) || isTargetSwitchable(seg.id);
      list.push({
        id: seg.id,
        toggleId,
        keyId: String(seg.id),
        name: baseName,
        subBadge: null,
        travelTime: seg.travelTime,
        interval: seg.interval,
        intervalMax: seg.intervalMax,
        stops: seg.stops,
        isBranch: false,
        isBypassedMain: isBypassed,
        hasAlternative: isBypassed,
        disabled: isTargetDisabled(toggleId),
        rawSeg: seg
      });
    }
  };
  
  segments.value.filter(s => s.side === 'right' || (!s.side && s.side !== 'left')).forEach(seg => {
    pushMainSegment(seg);
  });
  
  const leftSegs = segments.value.filter(s => s.side === 'left');
  for (let i = leftSegs.length - 1; i >= 0; i--) {
    pushMainSegment(leftSegs[i]);
  }
  
  branches.value.forEach((br, bIdx) => {
    const brName = br.name || `Альтернатива ${bIdx + 1}`;
    const brNodes = (br.nodes || []).filter(n => n && n.name && n.name !== 'Контрольна (альтернатива)');
    const sectionCount = Math.max((br.sections || []).length, brNodes.length + 1, 1);
    
    for (let si = 0; si < sectionCount; si++) {
      let secName = '';
      if (brNodes.length === 0) {
        secName = `${brName} → Кінець альтернативи`;
      } else if (si === 0) {
        secName = `${brName} → ${brNodes[0].name}`;
      } else if (si === brNodes.length) {
        secName = `${brNodes[si - 1].name} → Кінець альтернативи`;
      } else {
        secName = `${brNodes[si - 1]?.name || brName} → ${brNodes[si]?.name || 'Кінець альтернативи'}`;
      }
      
      const secObj = br.sections?.[si];
      if (!secObj) continue;

      list.push({
        id: secObj.id,
        toggleId: secObj.id,
        keyId: String(secObj.id),
        name: secName,
        subBadge: null,
        travelTime: secObj.travelTime || 5,
        interval: secObj.interval || '15',
        intervalMax: secObj.intervalMax || '20',
        stops: secObj.stops || [],
        isBranch: true,
        isBypassedMain: false,
        hasAlternative: true,
        disabled: isTargetDisabled(secObj.id),
        branchId: br.id,
        sectionIdx: si,
        rawSeg: null
      });
    }
  });
  
  return list;
});
</script>

<template>
  <div class="fixed inset-0 z-50 flex overflow-hidden"
       :class="isViewMode ? 'bg-white' : 'bg-[#edf0f7]'"
       style="font-family:'Inter',sans-serif;">

    <!-- ════════════════════════════════════════
         CANVAS AREA
    ════════════════════════════════════════ -->
    <div class="flex-1 relative overflow-hidden">

      <!-- Creation Wizard (when creating a new route) -->
      <RouteCreateWizard
        v-if="showCreateWizard"
        @create="handleWizardCreate"
        @cancel="handleWizardCancel"
      />

      <!-- Empty canvas backdrop while wizard is open -->
      <div v-if="showCreateWizard" class="absolute inset-0 z-40 bg-[#f8fafc] flex items-center justify-center pointer-events-none">
        <svg class="w-full h-full opacity-25" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="wizard-empty-grid" width="32" height="32" patternUnits="userSpaceOnUse">
              <path d="M 32 0 L 0 0 0 32" fill="none" stroke="rgba(0,0,0,0.12)" stroke-width="1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#wizard-empty-grid)"/>
        </svg>
      </div>

      <!-- Canvas -->
      <RouteCanvas
        ref="canvasRef"
        class="transition-all duration-300 ease-in-out"
        :class="isRotatingAnim ? 'no-structural-anim blur-[6px] scale-[0.99]' : 'blur-0 scale-100'"
        :route-data="routeData"
        :is-branch-mode="isViewMode ? false : isBranchMode"
        :is-chain-toggle-mode="isViewMode ? false : isChainToggleMode"
        :editable="isViewMode ? false : isEditable"
        @edit-segment="seg  => { if (!isViewMode) editSeg = seg }"
        @edit-node="   node => { if (!isViewMode) editNode = node }"
        @add-stop="    (sIdx, side, insertIdx, isAfterMerge) => addStop(sIdx, side, insertIdx, isAfterMerge)"
        @remove-stop=" (sIdx, stIdx) => removeStop(sIdx, stIdx)"
        @remove-node=" idx => removeNode(idx)"
        @add-branch="(sIdx) => addBranch(sIdx)"
        @add-sub-branch="(pId, pNodeId) => addBranch(null, pId, pNodeId)"
        @finish-branch="(brId) => finishBranch(brId)"
        @config-branch="(br) => configBranch(br)"
        @add-node="(side, segIdx, pos, insertIdx) => addControlNode(side, segIdx, pos, insertIdx)"
        @add-branch-node="(brId, sIdx, pos) => addBranchNode(brId, sIdx, pos)"
        @add-branch-stop="(brId, si) => addBranchStop(brId, si)"
        @extend-branch-with-stop="extendBranchWithStop"
        @edit-branch-stop="editBranchStop"
        @edit-branch-node="editBranchNode"
        @toggle-branch-mode="isBranchMode = !isBranchMode"
        @toggle-chain="handleToggleChain"
      />

      <!-- 180° Rotation Blur Overlay -->
      <transition
        enter-active-class="transition-all duration-200 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition-all duration-250 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div v-if="isRotatingAnim"
             class="absolute inset-0 z-40 flex items-center justify-center bg-white/25 backdrop-blur-md pointer-events-none select-none">
          <div class="bg-white/95 border border-gray-200/90 shadow-2xl rounded-3xl px-8 py-6 flex flex-col items-center gap-4">
            <div class="my-1.5">
              <div class="w-14 h-14 rounded-xl flex items-center justify-center text-white shadow-lg diamond-rotate-once-180"
                   :style="{ backgroundColor: routeColor }">
                <svg class="w-7 h-7 -rotate-45" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M7 16V4m0 0L3 8m4-4l4 4" />
                  <path d="M17 8v12m0 0l4-4m-4 4l-4-4" />
                </svg>
              </div>
            </div>
            <div class="text-center">
              <div class="text-sm font-bold text-gray-900">Розворот схеми на 180°</div>
              <div class="text-xs font-medium text-gray-500 mt-0.5">Зміна сторін напрямків маршруту...</div>
            </div>
          </div>
        </div>
      </transition>

      <!-- Branch Config Modal -->
      <Teleport to="body">
        <div v-if="activeBranchToConfig" class="fixed inset-0 z-[150] flex items-center justify-center bg-gray-900/40 backdrop-blur-sm" @click="activeBranchToConfig = null">
          <div class="bg-white rounded-2xl shadow-xl w-96 p-6 border border-gray-100 flex flex-col gap-4" @click.stop>
            <div class="text-center">
              <SvgIcon name="question-circle" class="w-10 h-10 text-blue-600 fill-current mx-auto mb-2 drop-shadow-sm" />
              <h3 class="text-base font-bold text-gray-900">Основна ділянка перед з'єднанням</h3>
              <p class="text-xs text-gray-500 mt-1">Оберіть, що робити з основною ділянкою усередині цього з'єднання:</p>
            </div>
            
            <div class="flex flex-col gap-2.5">
              <button @click="configNormalMerge"
                      class="flex items-start gap-3 p-3 rounded-xl border-2 border-gray-100 hover:border-blue-200 hover:bg-blue-50/30 text-left transition group">
                <div class="w-8 h-8 rounded-lg bg-gray-100 group-hover:bg-blue-100 flex items-center justify-center text-gray-600 group-hover:text-blue-600 shrink-0 mt-0.5">
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg>
                </div>
                <div>
                  <div class="text-xs font-bold text-gray-800 group-hover:text-blue-700">Нічого не робити (залишити порожньою)</div>
                  <div class="text-[11px] text-gray-500 mt-0.5">Пряма ділянка без додавання нових зупинок і пілів</div>
                </div>
              </button>

              <button @click="configAddMainLoopSegment"
                      class="flex items-start gap-3 p-3 rounded-xl border-2 border-gray-100 hover:border-blue-200 hover:bg-blue-50/30 text-left transition group">
                <div class="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 shrink-0 mt-0.5">
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
                </div>
                <div>
                  <div class="text-xs font-bold text-gray-800 group-hover:text-blue-700">Додати піли (зупинки та контрольні точки)</div>
                  <div class="text-[11px] text-gray-500 mt-0.5">Відобразити кнопку додавання зупинок і вузлів усередині цієї ділянки</div>
                </div>
              </button>

              <button @click="configMakeControlNode"
                      class="flex items-start gap-3 p-3 rounded-xl border-2 border-gray-100 hover:border-blue-200 hover:bg-blue-50/30 text-left transition group">
                <div class="w-8 h-8 rounded-lg bg-gray-100 group-hover:bg-blue-100 flex items-center justify-center text-gray-600 group-hover:text-blue-600 shrink-0 mt-0.5">
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="6"/></svg>
                </div>
                <div>
                  <div class="text-xs font-bold text-gray-800 group-hover:text-blue-700">Зробити точку з'єднання контрольною</div>
                  <div class="text-[11px] text-gray-500 mt-0.5">Створити окремий контрольний вузол у точці злиття</div>
                </div>
              </button>
            </div>

            <button @click="activeBranchToConfig = null" class="w-full py-2 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-100 transition">Закрити</button>
          </div>
        </div>
      </Teleport>

      <!-- ════════════════════════════════════════
           DEVELOPER GRAPH INSPECTOR PANEL (Only in Constructor Mode)
      ════════════════════════════════════════ -->
      <Teleport to="body" v-if="ENABLE_GRAPH_INSPECTOR">
        <button v-if="!isViewMode"
                @click="showGraphInspector = !showGraphInspector"
                class="fixed bottom-5 left-6 z-[160] flex items-center gap-2 px-3.5 py-2 bg-gray-900/90 hover:bg-gray-900 text-white rounded-full shadow-xl border border-gray-700/60 backdrop-blur-md transition-all hover:scale-105 active:scale-95 text-xs font-mono cursor-pointer select-none">
          <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span class="font-bold">🔗 Graph Inspector</span>
          <span class="bg-gray-800 text-emerald-400 font-bold text-[10px] px-2 py-0.5 rounded-full border border-gray-700 font-sans">{{ developerLinkedList.length }} елементів</span>
        </button>

        <div v-if="!isViewMode && showGraphInspector"
             class="fixed top-4 left-4 bottom-16 z-[160] w-[460px] bg-gray-950/95 text-gray-100 rounded-2xl shadow-2xl border border-gray-800 backdrop-blur-xl flex flex-col overflow-hidden font-mono select-none">
          
          <div class="p-3.5 border-b border-gray-800 flex items-center justify-between bg-gray-900/90">
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
              <span class="text-xs font-bold tracking-wider text-emerald-400 uppercase">Зв'язний список (Debug)</span>
            </div>
            <div class="flex items-center gap-1.5">
              <button @click="inspectorTab = 'chain'" :class="inspectorTab === 'chain' ? 'bg-blue-600 text-white font-bold' : 'bg-gray-800 text-gray-400 hover:text-white'" class="px-2 py-1 rounded text-[10px] transition cursor-pointer">Ланцюжок</button>
              <button @click="inspectorTab = 'branches'" :class="inspectorTab === 'branches' ? 'bg-purple-600 text-white font-bold' : 'bg-gray-800 text-gray-400 hover:text-white'" class="px-2 py-1 rounded text-[10px] transition cursor-pointer">🌿 Розгалуження</button>
              <button @click="inspectorTab = 'nodes'" :class="inspectorTab === 'nodes' ? 'bg-blue-600 text-white font-bold' : 'bg-gray-800 text-gray-400 hover:text-white'" class="px-2 py-1 rounded text-[10px] transition cursor-pointer">Вузли</button>
              <button @click="inspectorTab = 'segs'" :class="inspectorTab === 'segs' ? 'bg-blue-600 text-white font-bold' : 'bg-gray-800 text-gray-400 hover:text-white'" class="px-2 py-1 rounded text-[10px] transition cursor-pointer">Ділянки</button>
              <button @click="inspectorTab = 'stops'" :class="inspectorTab === 'stops' ? 'bg-blue-600 text-white font-bold' : 'bg-gray-800 text-gray-400 hover:text-white'" class="px-2 py-1 rounded text-[10px] transition cursor-pointer">Зупинки</button>
              <button @click="inspectorTab = 'history'" :class="inspectorTab === 'history' ? 'bg-amber-600 text-white font-bold' : 'bg-gray-800 text-gray-400 hover:text-white'" class="px-2 py-1 rounded text-[10px] transition cursor-pointer flex items-center gap-1">
                <span>📜 Логи</span>
                <span v-if="undoStack.length > 0" class="px-1 py-0.2 rounded-full bg-amber-900 text-amber-200 text-[8px]">{{ undoStack.length }}</span>
              </button>
              <button @click="showGraphInspector = false" class="text-gray-400 hover:text-white ml-2 text-sm cursor-pointer p-1">✕</button>
            </div>
          </div>

          <!-- Content Area -->
          <div class="flex-1 overflow-y-auto p-3 text-[11px] leading-relaxed space-y-2">
            
            <!-- TAB 1: CHAIN (Sequential Linked List) -->
            <div v-if="inspectorTab === 'chain'" class="space-y-2">
              <div class="text-[10px] text-gray-400 mb-1 flex items-center justify-between bg-gray-900/60 p-2 rounded-lg border border-gray-800">
                <span>Start Node ID: <b class="text-emerald-400">{{ routeGraph.startNodeId }}</b></span>
                <span>Всього в обході: <b class="text-white">{{ developerLinkedList.length }}</b></span>
              </div>

              <div v-for="(item, idx) in developerLinkedList" :key="'chain-' + idx + '-' + item.id"
                   class="p-2.5 rounded-xl border transition"
                   :class="item.type === 'node' ? 'bg-gray-900/90 border-blue-900/50 hover:border-blue-500/50' : 'bg-gray-900/40 border-gray-800 hover:border-gray-700'">
                
                <!-- NODE ITEM -->
                <div v-if="item.type === 'node'" class="flex flex-col gap-1">
                  <div class="flex items-center justify-between">
                    <span class="inline-flex items-center gap-1.5 font-bold text-blue-400">
                      <span class="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                      NODE #{{ item.id }}
                    </span>
                    <span class="text-[9px] px-1.5 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800/60 font-sans font-bold">{{ item.side }}</span>
                  </div>
                  <div class="text-gray-100 font-semibold pl-3">{{ item.name }}</div>
                  <div class="text-[10px] text-gray-400 pl-3 flex gap-3 mt-0.5">
                    <span>nextSegId: <b class="text-amber-400">{{ item.nextSegId ?? 'null' }}</b></span>
                    <span v-if="item.altSegId">altSegId: <b class="text-purple-400">{{ item.altSegId }}</b></span>
                  </div>

                  <!-- BRANCH DETAILS UNDER NODE IF ALTSEGID EXISTS -->
                  <div v-if="item.branchInfo" class="mt-2 p-2 rounded-lg bg-purple-950/60 border border-purple-800/80 space-y-1.5">
                    <div class="flex items-center justify-between text-purple-300 font-bold text-[10px]">
                      <span>🌿 Розгалуження (altSegId: #{{ item.branchInfo.altSegId }})</span>
                      <span class="text-[9px] bg-purple-900 px-1.5 py-0.5 rounded text-purple-200">targetType: {{ item.branchInfo.targetType }}</span>
                    </div>

                    <!-- Branch Sections & Stops -->
                    <div v-for="sec in item.branchInfo.sections" :key="'br-sec-' + sec.id" class="pl-2 border-l border-purple-700 space-y-1 text-[10px]">
                      <div class="text-purple-200 font-semibold">Секція розгалуження #{{ sec.id }} (nextNode: #{{ sec.nextNodeId }})</div>
                      <div class="pl-2 text-gray-300 space-y-0.5">
                        <div v-if="sec.stops.length === 0" class="text-gray-500 italic text-[9px]">Порожньо (0 зупинок)</div>
                        <div v-for="bSt in sec.stops" :key="'bst-' + bSt.id" class="text-[9px] bg-gray-900/90 p-1 rounded border border-gray-800 flex justify-between">
                          <span><b>{{ bSt.name }}</b> (ID: {{ bSt.id }})</span>
                          <span class="text-cyan-400">➔ nextStopId: {{ bSt.nextStopId ?? 'null' }}</span>
                        </div>
                      </div>
                    </div>

                    <!-- Merge Target Completion Description -->
                    <div class="text-[10px] text-amber-300 font-bold bg-amber-950/40 p-1.5 rounded border border-amber-800/50 mt-1">
                      {{ item.branchInfo.finishDescription }}
                    </div>
                  </div>
                </div>

                <!-- SEGMENT ITEM -->
                <div v-else class="flex flex-col gap-1.5 pl-2">
                  <div class="flex items-center justify-between text-emerald-400 font-bold">
                    <span class="inline-flex items-center gap-1.5">
                      <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                      SEGMENT #{{ item.id }}
                    </span>
                    <span class="text-[9px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/60 font-sans font-bold">nextNode: {{ item.nextNodeId }}</span>
                  </div>
                  
                  <div class="text-[10px] text-gray-300 pl-3 flex gap-3">
                    <span>Час: <b>{{ item.travelTime }}хв</b></span>
                    <span>Інтервал: <b>{{ item.interval }}-{{ item.intervalMax }}хв</b></span>
                    <span>firstStopId: <b class="text-cyan-400">{{ item.firstStopId ?? 'null' }}</b></span>
                  </div>

                  <!-- STOPS LINKED LIST IN SEGMENT -->
                  <div class="ml-3 pl-2 border-l-2 border-dashed border-gray-700 space-y-1 mt-1">
                    <div class="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Зупинки ({{ item.stops.length }}):</div>
                    <div v-if="item.stops.length === 0" class="text-[10px] text-gray-500 italic">Порожньо (0 зупинок)</div>
                    <div v-for="(st, stIdx) in item.stops" :key="'st-' + st.id"
                         class="text-[10px] bg-gray-950 p-1.5 rounded border border-gray-800 flex items-center justify-between">
                      <span class="text-gray-200"><b class="text-gray-500">#{{ stIdx + 1 }}</b> {{ st.name }} <span class="text-gray-500 text-[9px]">(ID: {{ st.id }})</span></span>
                      <span class="text-[9px] text-cyan-400">➔ nextStopId: {{ st.nextStopId ?? 'null' }}</span>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            <!-- TAB: BRANCHES -->
            <div v-else-if="inspectorTab === 'branches'" class="space-y-2">
              <div v-if="branches.length === 0" class="p-4 text-center text-gray-500 italic">
                Немає активних розгалужень у графі.
              </div>
              <div v-for="br in branches" :key="br.id"
                   class="p-3 rounded-xl bg-purple-950/40 border border-purple-800/60 space-y-2">
                <div class="flex items-center justify-between font-bold text-purple-300">
                  <span>{{ br.name }} ({{ br.id }})</span>
                  <div class="flex items-center gap-1.5">
                    <span class="text-[9px] bg-purple-900/80 text-purple-200 px-2 py-0.5 rounded font-sans font-bold">L{{ branchLevels[br.id] || 1 }}</span>
                    <span class="text-[9px] bg-purple-900 text-purple-200 px-2 py-0.5 rounded font-sans">targetType: {{ br.targetType }}</span>
                  </div>
                </div>
                
                <div class="text-[10px] text-gray-300 space-y-1">
                  <div>Початковий вузол (startNodeId): <b class="text-blue-400">#{{ br.startNodeId }}</b></div>
                  <div>Початковий альт-сегмент (altSegId): <b class="text-purple-400">#{{ br.altSegId }}</b></div>
                  <div v-if="br.targetStopId">Цільова зупинка злиття (targetStopId): <b class="text-cyan-400">#{{ br.targetStopId }}</b></div>
                  <div v-if="br.targetNodeId">Цільовий вузол злиття (targetNodeId): <b class="text-emerald-400">#{{ br.targetNodeId }}</b></div>
                </div>

                <!-- Sections -->
                <div class="space-y-1.5 pt-1">
                  <div class="text-[9px] uppercase tracking-wider text-purple-400 font-bold">Секції розгалуження ({{ br.sections.length }}):</div>
                  <div v-for="(sec, sIdx) in br.sections" :key="'bsec-' + sIdx"
                       class="p-2 rounded bg-gray-900 border border-gray-800 space-y-1">
                    <div class="flex justify-between text-gray-200 font-bold">
                      <span>Секція #{{ sec.id }}</span>
                      <span class="text-cyan-400 text-[9px]">firstStopId: {{ sec.firstStopId ?? 'null' }}</span>
                    </div>
                    <div class="text-[9px] text-gray-400">
                      Зупинок: {{ sec.stops?.length || 0 }}
                    </div>
                    <div v-for="st in sec.stops" :key="'bst-' + st.id" class="text-[9px] bg-gray-950 p-1 rounded flex justify-between border border-gray-800">
                      <span>{{ st.name }} (ID: {{ st.id }})</span>
                      <span class="text-cyan-400">➔ nextStopId: {{ st.nextStopId ?? 'null' }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- TAB 2: RAW NODES -->
            <div v-else-if="inspectorTab === 'nodes'" class="space-y-1.5">
              <div v-for="(node, nId) in routeGraph.nodes" :key="'raw-n-' + nId"
                   class="p-2 rounded-lg bg-gray-900 border border-gray-800 flex flex-col gap-1">
                <div class="flex justify-between items-center text-blue-400 font-bold">
                  <span>Node #{{ nId }} ({{ node.name }})</span>
                  <span class="text-[9px] text-gray-400 bg-gray-800 px-1.5 py-0.5 rounded">{{ node.side || 'terminus' }}</span>
                </div>
                <div class="text-[10px] text-gray-400 flex flex-wrap gap-x-3 gap-y-0.5">
                  <span>isTerminus: <b>{{ !!node.isTerminus }}</b></span>
                  <span>nextSegId: <b class="text-amber-400">{{ node.nextSegId ?? 'null' }}</b></span>
                  <span>altSegId: <b class="text-purple-400">{{ node.altSegId ?? 'null' }}</b></span>
                </div>
              </div>
            </div>

            <!-- TAB 3: RAW SEGMENTS -->
            <div v-else-if="inspectorTab === 'segs'" class="space-y-1.5">
              <div v-for="(seg, sId) in routeGraph.segments" :key="'raw-s-' + sId"
                   class="p-2 rounded-lg bg-gray-900 border border-gray-800 flex flex-col gap-1">
                <div class="flex justify-between items-center text-emerald-400 font-bold">
                  <span>Segment #{{ sId }}</span>
                  <span class="text-[9px] text-gray-400 bg-gray-800 px-1.5 py-0.5 rounded">side: {{ seg.side || 'main' }}</span>
                </div>
                <div class="text-[10px] text-gray-400 flex flex-wrap gap-x-3 gap-y-0.5">
                  <span>nextNodeId: <b class="text-blue-400">{{ seg.nextNodeId }}</b></span>
                  <span>firstStopId: <b class="text-cyan-400">{{ seg.firstStopId ?? 'null' }}</b></span>
                  <span>travelTime: <b>{{ seg.travelTime }}</b></span>
                </div>
              </div>
            </div>

            <!-- TAB 4: RAW STOPS -->
            <div v-else-if="inspectorTab === 'stops'" class="space-y-1.5">
              <div v-if="Object.keys(routeGraph.stops).length === 0" class="p-4 text-center text-gray-500 italic">
                Немає збережених зупинок у графі.
              </div>
              <div v-for="(stop, stId) in routeGraph.stops" :key="'raw-st-' + stId"
                   class="p-2 rounded-lg bg-gray-900 border border-gray-800 flex items-center justify-between">
                <div>
                  <span class="text-gray-200 font-bold">Stop #{{ stId }}</span>
                  <span class="text-gray-400 ml-2">{{ stop.name }}</span>
                </div>
                <span class="text-[10px] text-cyan-400">nextStopId: {{ stop.nextStopId ?? 'null' }}</span>
              </div>
            </div>

            <!-- TAB 5: HISTORY & LOGS -->
            <div v-else-if="inspectorTab === 'history'" class="space-y-2">
              <div class="flex items-center justify-between bg-gray-900/80 p-2.5 rounded-xl border border-gray-800 gap-2">
                <div class="flex items-center gap-1.5">
                  <button @click="undo" :disabled="!canUndo"
                          class="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-[10px] flex items-center gap-1 transition cursor-pointer">
                    <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                    <span>Undo (Ctrl+Z)</span>
                  </button>
                  <button @click="redo" :disabled="!canRedo"
                          class="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-[10px] flex items-center gap-1 transition cursor-pointer">
                    <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M21 10h-10a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6" /></svg>
                    <span>Redo (Ctrl+Y)</span>
                  </button>
                </div>
                <button @click="clearHistory"
                        class="text-[9px] text-gray-400 hover:text-red-400 transition cursor-pointer">
                  Очистити
                </button>
              </div>

              <div class="text-[10px] text-gray-400 flex items-center justify-between px-1">
                <span>Стек скасування: <b class="text-amber-400">{{ undoStack.length }}</b></span>
                <span>Стек повторення: <b class="text-emerald-400">{{ redoStack.length }}</b></span>
                <span>Всього логів: <b class="text-gray-200">{{ actionLogs.length }}</b></span>
              </div>

              <div v-if="actionLogs.length === 0" class="p-6 text-center text-gray-500 italic">
                Жодних дій ще не зафіксовано.<br>Виконайте будь-яку дію на схемі для появи логів.
              </div>

              <div v-for="log in actionLogs" :key="log.id"
                   class="p-2 rounded-lg border transition"
                   :class="{
                     'bg-blue-950/30 border-blue-900/60': log.type === 'action',
                     'bg-amber-950/30 border-amber-900/60': log.type === 'undo',
                     'bg-emerald-950/30 border-emerald-900/60': log.type === 'redo'
                   }">
                <div class="flex items-center justify-between mb-0.5">
                  <div class="flex items-center gap-1.5">
                    <span class="text-[8px] font-bold px-1.5 py-0.2 rounded uppercase"
                          :class="{
                            'bg-blue-900 text-blue-200': log.type === 'action',
                            'bg-amber-900 text-amber-200': log.type === 'undo',
                            'bg-emerald-900 text-emerald-200': log.type === 'redo'
                          }">
                      {{ log.type }}
                    </span>
                    <span class="text-gray-200 font-bold">{{ log.action }}</span>
                  </div>
                  <span class="text-[9px] text-gray-500">{{ log.time }}</span>
                </div>
                <div v-if="log.details" class="text-[9px] text-gray-400 font-mono mt-1 bg-black/40 p-1 rounded overflow-x-auto">
                  {{ JSON.stringify(log.details) }}
                </div>
              </div>
            </div>

          </div>
        </div>
      </Teleport>

      <!-- ════════════════════════════════════════
           TOP-LEFT HUD: VIEW MODE (Frame 4 Exact Layout + Time Period Slider)
      ════════════════════════════════════════ -->
      <div v-if="isViewMode" class="absolute top-6 left-7 z-50 flex flex-col gap-2.5 pointer-events-auto select-none">
        <div class="flex items-center gap-2.5">
          <!-- Left Column: Two Stacked Route Switcher Pills -->
          <div class="flex flex-col gap-1.5">
            <!-- Prev route pill: [color circle] ← -->
            <button v-if="prevRoute"
                    @click="switchRoute(prevRoute.id)"
                    class="h-7 px-2.5 rounded-full bg-white border border-gray-200 shadow-sm hover:bg-gray-50 transition flex items-center justify-between gap-2 cursor-pointer"
                    :title="`Попередній маршрут: ${prevRoute.number}`">
              <span class="w-3.5 h-3.5 rounded-full shrink-0" :style="{ backgroundColor: prevRoute.color }"></span>
              <SvgIcon name="arrow-right" class="w-3.5 h-3 text-gray-800" />
            </button>

            <!-- Next route pill: → [color circle] -->
            <button v-if="nextRoute"
                    @click="switchRoute(nextRoute.id)"
                    class="h-7 px-2.5 rounded-full bg-white border border-gray-200 shadow-sm hover:bg-gray-50 transition flex items-center justify-between gap-2 cursor-pointer"
                    :title="`Наступний маршрут: ${nextRoute.number}`">
              <SvgIcon name="arrow-right" class="w-3.5 h-3 text-gray-800 rotate-180" />
              <span class="w-3.5 h-3.5 rounded-full shrink-0" :style="{ backgroundColor: nextRoute.color }"></span>
            </button>
          </div>

          <!-- Center: Large Rounded-Square Route Badge -->
          <div class="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold shadow-md select-none tracking-tight"
               :class="{
                 'text-3xl': ((routeNumber || '1').toString() + (routeLetter || '')).length <= 2,
                 'text-2xl': ((routeNumber || '1').toString() + (routeLetter || '')).length >= 3
               }"
               :style="{ backgroundColor: routeColor }">
            {{ routeNumber }}{{ routeLetter }}
          </div>

          <!-- Right Column: Two Stacked Circular Action Buttons -->
          <div class="flex flex-col gap-1.5">
            <!-- Top circular button: Back arrow to routes list -->
            <button @click="router.push('/base/route')"
                    class="w-7 h-7 rounded-full bg-white border border-gray-200 shadow-sm hover:bg-gray-50 flex items-center justify-center text-gray-700 transition cursor-pointer"
                    title="Назад до списку маршрутів">
              <SvgIcon name="arrow-right" class="w-3.5 h-3 text-gray-700" />
            </button>

            <!-- Bottom circular button: Inward arrows (Fit whole route to view) -->
            <button @click="canvasRef?.resetView(true)"
                    class="w-7 h-7 rounded-full bg-white border border-gray-200 shadow-sm hover:bg-gray-50 flex items-center justify-center text-gray-700 transition cursor-pointer"
                    title="Масштаб на перегляд всього маршруту">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 14h6v6m10-10h-6V4m0 6 7-7M10 14l-7 7"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- Time Period Slider & Switcher (View Mode Top-Left) -->
        <div v-if="routePeriods.length > 0"
             class="bg-white/95 backdrop-blur-xs border border-gray-200 rounded-2xl px-3.5 py-2 shadow-sm flex flex-col gap-1.5 min-w-[210px]">
          <div class="flex items-center justify-between gap-2 text-xs font-bold text-gray-800">
            <button @click="stepPeriod(-1)"
                    class="w-5 h-5 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500 hover:text-gray-900 transition cursor-pointer"
                    title="Попередній часовий проміжок">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <span class="tabular-nums tracking-tight font-extrabold text-gray-900">
              {{ routePeriods[selectedPeriodIdx]?.period || `${fmtTime(timeStart)} - ${fmtTime(timeEnd)}` }}
            </span>
            <button @click="stepPeriod(1)"
                    class="w-5 h-5 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500 hover:text-gray-900 transition cursor-pointer"
                    title="Наступний часовий проміжок">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
          <input v-if="routePeriods.length > 1"
                 type="range"
                 :min="0"
                 :max="routePeriods.length - 1"
                 :step="1"
                 :value="selectedPeriodIdx"
                 @input="e => selectPeriodByIndex(+e.target.value)"
                 class="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                 :style="{ accentColor: routeColor }"
                 title="Перемикання часового проміжку доби" />
          <div class="flex items-center justify-between text-[10px] font-semibold text-gray-500">
            <span>Проміжок {{ selectedPeriodIdx + 1 }} з {{ routePeriods.length }}</span>
            <span class="font-bold text-gray-700">Оборот: {{ currentRouteTravelTime }} хв</span>
          </div>
        </div>
      </div>

      <!-- ════════════════════════════════════════
           TOP-LEFT MENU: CONSTRUCTOR MODE (6 buttons: 5 original + Table button next to Eye)
      ════════════════════════════════════════ -->
      <div v-else class="absolute top-5 left-6 z-50 flex flex-col gap-3 pointer-events-auto select-none">
        
        <div class="flex items-start gap-3">
          <!-- Large Route Number on Blueprint Background -->
          <div class="w-16 h-16 shrink-0 border-2 flex items-center justify-center relative overflow-hidden bg-white"
               :style="{
                 borderColor: routeColor,
                 backgroundImage: `linear-gradient(${routeColor}1A 1px, transparent 1px), linear-gradient(90deg, ${routeColor}1A 1px, transparent 1px)`,
                 backgroundSize: '8px 8px'
               }">
            <span class="font-bold leading-none select-none z-10 tracking-tighter"
                  :class="{
                    'text-[32px]': ((routeNumber || '1').toString() + (routeLetter || '')).length <= 2,
                    'text-[26px]': ((routeNumber || '1').toString() + (routeLetter || '')).length === 3,
                    'text-[20px]': ((routeNumber || '1').toString() + (routeLetter || '')).length >= 4
                  }"
                  :style="{ color: routeColor, WebkitTextStroke: '1px white' }">
              {{ routeNumber || '1' }}{{ routeLetter }}
            </span>
          </div>

          <!-- Action Buttons Grouped into Shared Pills -->
          <div class="flex flex-col gap-1.5">
            <!-- Row 1: History Pill + Tools Pill -->
            <div class="flex items-center gap-1.5">
              <!-- Pill 1: Undo / Redo -->
              <div class="inline-flex items-center bg-white border border-gray-200/90 rounded-full p-1 shadow-sm gap-1.5">
                <!-- Undo (Ctrl+Z) -->
                <button @click="undo" :disabled="!canUndo"
                        class="w-7 h-7 rounded-full bg-white border flex items-center justify-center transition-all cursor-pointer"
                        :class="canUndo ? 'border-gray-200 text-gray-700 hover:bg-gray-50 shadow-xs' : 'border-gray-200/60 text-gray-300 cursor-not-allowed'"
                        title="Скасувати дію (Ctrl+Z)">
                  <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                </button>
                <!-- Redo (Ctrl+Y / Ctrl+Shift+Z) -->
                <button @click="redo" :disabled="!canRedo"
                        class="w-7 h-7 rounded-full bg-white border flex items-center justify-center transition-all cursor-pointer"
                        :class="canRedo ? 'border-gray-200 text-gray-700 hover:bg-gray-50 shadow-xs' : 'border-gray-200/60 text-gray-300 cursor-not-allowed'"
                        title="Повторити дію (Ctrl+Y / Ctrl+Shift+Z)">
                  <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M21 10h-10a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6" /></svg>
                </button>
              </div>

              <!-- Pill 2: Rotate 180° / Table View -->
              <div class="inline-flex items-center bg-white border border-gray-200/90 rounded-full p-1 shadow-sm gap-1.5">
                <!-- Rotate 180° -->
                <button @click="handleRotate180"
                        class="w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-xs"
                        :class="isRotated180 ? 'text-white border-transparent' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'"
                        :style="isRotated180 ? { backgroundColor: routeColor } : {}"
                        title="Перевернути схему на 180°">
                  <svg class="w-3.5 h-3.5 transition-transform duration-300" :class="{ 'rotate-180': isRotated180 }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M7 16V4m0 0L3 8m4-4l4 4" />
                    <path d="M17 8v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                </button>
                <!-- Table View Button -->
                <button @click="isTableViewOpen = true"
                        class="w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer shadow-xs"
                        :class="isTableViewOpen ? 'text-white border-transparent' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'"
                        :style="isTableViewOpen ? { backgroundColor: routeColor } : {}"
                        title="Табличний вигляд">
                  <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="3" y1="9" x2="21" y2="9"></line>
                    <line x1="3" y1="15" x2="21" y2="15"></line>
                    <line x1="9" y1="3" x2="9" y2="21"></line>
                    <line x1="15" y1="3" x2="15" y2="21"></line>
                  </svg>
                </button>
              </div>
            </div>

            <!-- Row 2: Modes Pill (Branch, Chain Toggle, Edit Visibility) -->
            <div class="flex items-center">
              <div class="inline-flex items-center bg-white border border-gray-200/90 rounded-full p-1 shadow-sm gap-1.5">
                <!-- Branch Toggle -->
                <button @click="isBranchMode = !isBranchMode; if (isBranchMode) { isEditable = true; isChainToggleMode = false; }"
                        class="w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer shadow-xs"
                        :class="isBranchMode ? 'text-white border-transparent' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'"
                        :style="isBranchMode ? { backgroundColor: routeColor } : {}"
                        title="Режим альтернатив">
                  <SvgIcon name="branch" class="w-3.5 h-3.5" />
                </button>
                <!-- Chain Toggle Mode (Enable/Disable Sections on Canvas) -->
                <button @click="isChainToggleMode = !isChainToggleMode; if (isChainToggleMode) { isBranchMode = false; isEditable = true; }"
                        class="w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer shadow-xs"
                        :class="isChainToggleMode ? 'text-white border-transparent' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'"
                        :style="isChainToggleMode ? { backgroundColor: routeColor } : {}"
                        title="Режим перемикання ділянок (Увімк / Вимк)">
                  <SvgIcon name="chain-toggle" class="w-3.5 h-3.5" />
                </button>
                <!-- Toggle Edit Mode (Show/Hide Controls) -->
                <button @click="isEditable = !isEditable; if (!isEditable) { isBranchMode = false; isChainToggleMode = false; }"
                        class="w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer shadow-xs"
                        :class="!isEditable ? 'text-white border-transparent' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'"
                        :style="!isEditable ? { backgroundColor: routeColor } : {}"
                        title="Приховати/Показати елементи додавання">
                  <svg v-if="!isEditable" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                  </svg>
                  <svg v-else class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Time Period Scrubber + Slider (Constructor Mode Top-Left) -->
        <div class="bg-white border border-gray-200 rounded-2xl px-3.5 py-2 text-xs font-semibold text-gray-700 shadow-sm min-w-[200px] flex flex-col gap-1.5">
          <div class="flex items-center justify-between gap-3">
            <button @click="stepPeriod(-1)" class="text-gray-400 hover:text-blue-600 transition-colors cursor-pointer" title="Попередній часовий проміжок">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <span class="tabular-nums font-bold tracking-tight text-gray-900">{{ fmtTime(timeStart) }} - {{ fmtTime(timeEnd) }}</span>
            <button @click="stepPeriod(1)" class="text-gray-400 hover:text-blue-600 transition-colors cursor-pointer" title="Наступний часовий проміжок">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
          <input v-if="routePeriods.length > 1"
                 type="range"
                 :min="0"
                 :max="routePeriods.length - 1"
                 :step="1"
                 :value="selectedPeriodIdx"
                 @input="e => selectPeriodByIndex(+e.target.value)"
                 class="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                 :style="{ accentColor: routeColor }"
                 title="Перемикання часового проміжку доби" />
          <div class="flex items-center justify-between text-[10px] text-gray-400">
            <span>Проміжок {{ selectedPeriodIdx + 1 }}/{{ routePeriods.length }}</span>
            <span class="font-bold text-gray-700">{{ totalTime }} хв</span>
          </div>
        </div>
      </div>

      <!-- ── Top-right button to toggle sidebar (Only in Constructor Mode) ── -->
      <button v-if="!isViewMode"
              @click="isSidebarOpen = !isSidebarOpen"
              class="absolute top-5 right-5 z-50 bg-white border border-gray-200 shadow-md rounded-xl px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-all flex items-center gap-1.5 cursor-pointer pointer-events-auto">
        <svg class="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" :d="isSidebarOpen ? 'M13 5l7 7-7 7M5 5l7 7-7 7' : 'M11 19l-7-7 7-7M19 19l-7-7 7-7'" />
        </svg>
        <span>{{ isSidebarOpen ? 'Сховати меню' : 'Показати меню' }}</span>
      </button>

      <!-- ── Bottom-right Error & Validation Indicator (Only in Constructor Mode) ── -->
      <div v-if="!isViewMode" class="absolute bottom-5 right-5 z-40 flex flex-col items-end gap-2 pointer-events-auto select-none">
        
        <transition enter-active-class="transition duration-200 ease-out"
                    enter-from-class="transform scale-95 opacity-0 translate-y-2"
                    enter-to-class="transform scale-100 opacity-100 translate-y-0"
                    leave-active-class="transition duration-150 ease-in"
                    leave-from-class="transform scale-100 opacity-100 translate-y-0"
                    leave-to-class="transform scale-95 opacity-0 translate-y-2">
          <div v-if="isErrorDetailsOpen"
               class="w-80 max-h-96 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-200/90 p-3.5 flex flex-col gap-2.5 overflow-hidden text-xs">
            
            <div class="flex items-center justify-between pb-2 border-b border-gray-100">
              <div class="flex items-center gap-2 font-bold text-gray-800">
                <span>Зауваження та помилки</span>
                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                  {{ validationIssues.totalCount }}
                </span>
                <button @click="showIssuesOnCanvas = !showIssuesOnCanvas"
                        class="w-6 h-6 rounded-full border flex items-center justify-center transition-colors cursor-pointer ml-1"
                        :class="showIssuesOnCanvas ? 'bg-gray-100 text-gray-800 border-gray-300 hover:bg-gray-200' : 'bg-white text-gray-400 border-gray-200 hover:bg-gray-50'"
                        :title="showIssuesOnCanvas ? 'Сховати помилки на схемі' : 'Показати помилки на схемі'">
                  <svg v-if="showIssuesOnCanvas" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                  <svg v-else class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                  </svg>
                </button>
              </div>
              <button @click="isErrorDetailsOpen = false" class="text-gray-400 hover:text-gray-600 p-0.5 rounded cursor-pointer">✕</button>
            </div>

            <div v-if="validationIssues.totalCount > 0" class="overflow-y-auto max-h-72 flex flex-col gap-1.5 pr-1">
              <div v-for="err in validationIssues.redErrors" :key="err.id"
                   class="p-2.5 rounded-xl border bg-red-50/60 border-red-200/70 flex items-start gap-2.5">
                <span class="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0 mt-0.5"></span>
                <div class="flex-1 min-w-0">
                  <div class="font-bold text-gray-800 leading-tight text-xs">{{ err.title }}</div>
                  <div class="text-[11px] text-gray-500 mt-0.5">{{ err.description }}</div>
                </div>
              </div>

              <div v-for="warn in validationIssues.yellowWarnings" :key="warn.id"
                   class="p-2.5 rounded-xl border bg-amber-50/60 border-amber-200/70 flex items-start gap-2.5">
                <span class="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0 mt-0.5"></span>
                <div class="flex-1 min-w-0">
                  <div class="font-bold text-gray-800 leading-tight text-xs">{{ warn.title }}</div>
                  <div class="text-[11px] text-gray-500 mt-0.5">{{ warn.description }}</div>
                </div>
              </div>

              <div v-for="conf in validationIssues.conflictWarnings" :key="conf.id"
                   class="p-2.5 rounded-xl border bg-gray-100/80 border-gray-300/80 flex items-start gap-2.5">
                <span class="w-2.5 h-2.5 rounded-full bg-gray-500 shrink-0 mt-0.5"></span>
                <div class="flex-1 min-w-0">
                  <div class="font-bold text-gray-800 leading-tight text-xs">{{ conf.title }}</div>
                  <div class="text-[11px] text-gray-500 mt-0.5">{{ conf.description }}</div>
                </div>
              </div>
            </div>

            <div v-else class="py-4 px-2 text-center flex flex-col items-center gap-1.5 text-gray-500">
              <div class="w-7 h-7 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-xs">✓</div>
              <p class="font-bold text-gray-800 text-xs">Усі точки та зупинки призначено</p>
              <p class="text-[11px] text-gray-400">Маршрут має кінцеву та всі зупинки прив'язані до бази.</p>
            </div>

          </div>
        </transition>

        <button @click="isErrorDetailsOpen = !isErrorDetailsOpen"
                class="flex items-center gap-3 px-3.5 py-2 rounded-2xl shadow-lg border border-gray-200/90 backdrop-blur-md transition-all hover:scale-105 active:scale-95 cursor-pointer bg-white/95 hover:bg-white text-gray-800">
          <div v-if="validationIssues.redErrors.length > 0" class="flex items-center gap-1.5">
            <span class="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0"></span>
            <span class="text-xs font-bold text-red-600 font-mono leading-none">{{ validationIssues.redErrors.length }}</span>
          </div>
          <span v-if="validationIssues.redErrors.length > 0 && (validationIssues.yellowWarnings.length > 0 || validationIssues.conflictWarnings.length > 0)" class="w-px h-3.5 bg-gray-200"></span>
          <div v-if="validationIssues.yellowWarnings.length > 0" class="flex items-center gap-1.5">
            <span class="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0"></span>
            <span class="text-xs font-bold text-amber-600 font-mono leading-none">{{ validationIssues.yellowWarnings.length }}</span>
          </div>
          <span v-if="validationIssues.yellowWarnings.length > 0 && validationIssues.conflictWarnings.length > 0" class="w-px h-3.5 bg-gray-200"></span>
          <div v-if="validationIssues.conflictWarnings.length > 0" class="flex items-center gap-1.5">
            <span class="w-2.5 h-2.5 rounded-full bg-gray-500 shrink-0"></span>
            <span class="text-xs font-bold text-gray-600 font-mono leading-none">{{ validationIssues.conflictWarnings.length }}</span>
          </div>
          <div v-if="validationIssues.totalCount === 0" class="flex items-center gap-1.5">
            <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0"></span>
            <span class="text-xs font-bold text-emerald-600 font-mono leading-none">0</span>
          </div>
        </button>
      </div>

      <!-- ── Edit segment modal ── -->
      <Teleport to="body">
        <div v-if="editSeg"
             class="fixed inset-0 z-[200] flex items-center justify-center bg-black/20 backdrop-blur-[2px]"
             @click.self="editSeg = null">
          <div class="bg-white rounded-2xl shadow-2xl p-6 w-72 border border-gray-100">
            <h3 class="text-base font-bold text-gray-900 mb-4">Параметри ділянки</h3>
            <label class="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Час проходження (хв)</label>
            <input v-model.number="editSeg.travelTime" type="number" min="1"
              class="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold mb-3 bg-gray-50 focus:outline-none focus:border-blue-400"/>
            <div class="grid grid-cols-2 gap-2 mb-4">
              <div>
                <label class="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Інтервал від</label>
                <input v-model="editSeg.interval" type="text"
                  class="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold bg-gray-50 focus:outline-none focus:border-blue-400"/>
              </div>
              <div>
                <label class="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Інтервал до</label>
                <input v-model="editSeg.intervalMax" type="text"
                  class="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold bg-gray-50 focus:outline-none focus:border-blue-400"/>
              </div>
            </div>
            <button @click="editSeg = null"
              class="w-full py-2.5 rounded-xl font-bold text-white text-sm shadow-sm hover:opacity-90 transition-opacity"
              :style="{ backgroundColor: routeColor }">Готово</button>
          </div>
        </div>

        <!-- ── Finish Branch Selection Modal ── -->
        <div v-if="finishBranchTarget"
             class="fixed inset-0 z-[200] flex items-center justify-center bg-black/30 backdrop-blur-[2px]"
             @click.self="finishBranchTarget = null">
          <div class="bg-white rounded-2xl shadow-2xl p-6 w-96 border border-gray-100 flex flex-col gap-4">
            <div>
              <h3 class="text-base font-bold text-gray-900">
                {{ isFinishingSubBranch ? 'Завершення субальтернативи' : 'Завершення альтернативи' }}
              </h3>
              <p class="text-xs text-gray-500 mt-1">Оберіть точку, в яку має входити ділянка:</p>
            </div>

            <div class="flex flex-col gap-2.5">
              <label @click="selectedFinishType = 'current'"
                     class="flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all"
                     :class="selectedFinishType === 'current' ? 'border-blue-500 bg-blue-50/40' : 'border-gray-100 hover:border-gray-200 bg-gray-50/50'">
                <input type="radio" value="current" v-model="selectedFinishType" class="mt-0.5"/>
                <div>
                  <div class="text-xs font-bold text-gray-800">
                    {{ isFinishingSubBranch ? 'Поточна ділянка субальтернативи (перед зупинками)' : 'Поточна ділянка (перед зупинками)' }}
                  </div>
                  <div class="text-[11px] text-gray-500 mt-0.5">Вхід прямо перед зупинками цієї ділянки</div>
                </div>
              </label>

              <label @click="selectedFinishType = 'node'"
                     class="flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all"
                     :class="selectedFinishType === 'node' ? 'border-blue-500 bg-blue-50/40' : 'border-gray-100 hover:border-gray-200 bg-gray-50/50'">
                <input type="radio" value="node" v-model="selectedFinishType" class="mt-0.5"/>
                <div class="flex-1">
                  <div class="text-xs font-bold text-gray-800">
                    {{ isFinishingSubBranch ? 'До контрольної точки цієї субальтернативи' : 'До контрольної точки цієї сторони' }}
                  </div>
                  <div class="text-[11px] text-gray-500 mt-0.5">Вхід у вибрану контрольну точку</div>
                  <select v-if="selectedFinishType === 'node'"
                          v-model="selectedFinishNodeId"
                          class="w-full mt-2 text-xs font-bold bg-white border border-gray-200 rounded-lg p-2 focus:outline-none focus:border-blue-500">
                    <option :value="null">Оберіть контрольну точку...</option>
                    <option v-for="node in finishingNodeOptions" :key="node.id" :value="node.id">
                      {{ node.name }}
                    </option>
                  </select>
                </div>
              </label>

              <label @click="selectedFinishType = isFinishingSubBranch ? 'parent_end' : 'bottom_arc'"
                     class="flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all"
                     :class="(selectedFinishType === 'bottom_arc' || selectedFinishType === 'parent_end') ? 'border-blue-500 bg-blue-50/40' : 'border-gray-100 hover:border-gray-200 bg-gray-50/50'">
                <input type="radio" :value="isFinishingSubBranch ? 'parent_end' : 'bottom_arc'" v-model="selectedFinishType" class="mt-0.5"/>
                <div>
                  <div class="text-xs font-bold text-gray-800">
                    {{ isFinishingSubBranch ? 'До закінчення цієї альтернативи' : 'Нижнє оборотне коло (закруглення)' }}
                  </div>
                  <div class="text-[11px] text-gray-500 mt-0.5">
                    {{ isFinishingSubBranch ? 'Злиття із точкою закінчення батьківської альтернативи' : 'Плавне злиття із дугою в самому низу оборотного кола' }}
                  </div>
                </div>
              </label>
            </div>

            <div class="flex gap-2 mt-2">
              <button @click="finishBranchTarget = null"
                      class="flex-1 py-2.5 rounded-xl font-bold text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">
                Скасувати
              </button>
              <button @click="confirmFinishBranch"
                      class="flex-1 py-2.5 rounded-xl font-bold text-xs text-white shadow-sm hover:opacity-90 transition-opacity"
                      :style="{ backgroundColor: routeColor }">
                Підтвердити
              </button>
            </div>
          </div>
        </div>
      </Teleport>

      <!-- ── Edit control node modal ── -->
      <Teleport to="body">
        <div v-if="editNode && routeGraph.nodes[editNode.id]"
             class="fixed inset-0 z-[200] flex items-center justify-center bg-black/20 backdrop-blur-[2px]"
             @click.self="editNode = null">
          <div class="bg-white rounded-2xl shadow-2xl p-6 w-72 border border-gray-100">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-base font-bold text-gray-900">Контрольна точка</h3>
              <button v-if="!routeGraph.nodes[editNode.id]?.isTerminus"
                      @click="deleteEditedControlNode"
                      class="text-xs font-bold text-red-500 hover:text-red-700 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                      title="Видалити контрольну точку">
                Видалити
              </button>
            </div>
            
            <label class="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Назва</label>
            <input v-model="routeGraph.nodes[editNode.id].name" type="text"
              class="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold mb-4 bg-gray-50 focus:outline-none focus:border-blue-400"/>
              
            <label class="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Прив'язка до бази</label>
            <div class="mb-5">
              <StopSelector 
                :model-value="routeGraph.nodes[editNode.id]?.realId" 
                :stops="availableStops" 
                @create="name => createNewStopForNode(editNode.id, name)"
                @update:modelValue="id => assignRealStopToNode(editNode.id, id)"
              />
            </div>

            <button @click="editNode = null"
              class="w-full py-2.5 rounded-xl font-bold text-white text-sm shadow-sm hover:opacity-90 transition-opacity cursor-pointer"
              :style="{ backgroundColor: routeColor }">Готово</button>
          </div>
        </div>
      </Teleport>

      <!-- ── Table View Placeholder Modal (Opened by "Табличний вигляд" in View Mode or Table Icon in Constructor) ── -->
      <Teleport to="body">
        <div v-if="isTableViewOpen"
             class="fixed inset-0 z-[210] flex items-center justify-center bg-black/30 backdrop-blur-xs"
             @click.self="isTableViewOpen = false">
          <div class="bg-white rounded-3xl shadow-2xl p-6 w-[420px] border border-gray-100 flex flex-col gap-5">
            <div class="flex items-center justify-between border-b border-gray-100 pb-3">
              <div class="flex items-center gap-2.5">
                <div class="w-8 h-8 rounded-xl text-white font-bold text-sm flex items-center justify-center"
                     :style="{ backgroundColor: routeColor }">
                  {{ routeNumber }}{{ routeLetter }}
                </div>
                <div>
                  <h3 class="text-base font-bold text-gray-900">Табличний вигляд</h3>
                  <p class="text-xs text-gray-500">{{ terminus1DisplayName }} ⇄ {{ terminus2DisplayName }}</p>
                </div>
              </div>
              <button @click="isTableViewOpen = false" class="text-gray-400 hover:text-gray-700 text-sm p-1 cursor-pointer">✕</button>
            </div>

            <!-- Placeholder Content -->
            <div class="py-8 px-4 rounded-2xl bg-gray-50 border border-dashed border-gray-200 flex flex-col items-center justify-center text-center gap-2.5">
              <div class="w-12 h-12 rounded-2xl bg-white border border-gray-200 shadow-xs flex items-center justify-center text-gray-500">
                <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="3" y1="9" x2="21" y2="9"></line>
                  <line x1="3" y1="15" x2="21" y2="15"></line>
                  <line x1="9" y1="3" x2="9" y2="21"></line>
                  <line x1="15" y1="3" x2="15" y2="21"></line>
                </svg>
              </div>
              <div class="text-sm font-bold text-gray-800">Табличний вигляд (заглушка)</div>
              <p class="text-xs text-gray-500 max-w-[280px]">
                Табличне представлення розкладу, інтервалів та зупинок маршруту буде доступне у наступних оновленнях.
              </p>
            </div>

            <button @click="isTableViewOpen = false"
                    class="w-full py-2.5 rounded-xl font-bold text-white text-sm shadow-sm hover:opacity-90 transition cursor-pointer"
                    :style="{ backgroundColor: routeColor }">
              Закрити
            </button>
          </div>
        </div>
      </Teleport>

    </div>

    <!-- ════════════════════════════════════════
         RIGHT PANEL: VIEW MODE (Frame 4 Exact Layout)
    ════════════════════════════════════════ -->
    <div v-if="isViewMode"
         class="w-[500px] bg-white flex flex-col justify-center px-8 py-8 shrink-0 select-none z-20">
      <div class="flex flex-col gap-4 max-w-[440px]">
        
        <!-- Title & Square Route Badge -->
        <div class="flex flex-col gap-1.5">
          <div class="flex items-center gap-3">
            <h1 class="text-[26px] font-extrabold italic text-gray-900 tracking-tight leading-none">
              {{ routeTransportType === 'bus' ? 'Автобусний маршрут' : 'Тролейбусний маршрут' }}
            </h1>
            <div class="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-base shadow-sm shrink-0"
                 :style="{ backgroundColor: routeColor }">
              {{ routeNumber }}{{ routeLetter }}
            </div>
          </div>

          <!-- Subtitle: Кінцева 1 ⇄ Кінцева 2 -->
          <div class="flex items-center gap-2 text-sm font-bold text-gray-900 mt-1">
            <span>{{ terminus1DisplayName }}</span>
            <div class="inline-flex flex-col items-center justify-center -space-y-1 mx-0.5">
              <SvgIcon name="arrow-right" class="w-3 h-2.5 text-gray-800" />
              <SvgIcon name="arrow-right" class="w-3 h-2.5 text-gray-800 rotate-180" />
            </div>
            <span>{{ terminus2DisplayName }}</span>
          </div>
        </div>

        <!-- Stats Pill -->
        <div class="inline-flex items-center justify-between gap-4 px-4 py-2 rounded-full bg-white border border-gray-200 shadow-xs text-xs font-bold text-gray-900 w-full">
          <div class="flex items-center gap-3.5">
            <!-- Points / Stops (from SvgIcon 'stops') -->
            <span class="inline-flex items-center gap-1" title="Кількість зупинок та контрольних точок">
              <SvgIcon name="stops" class="w-2.5 h-4 text-gray-900" />
              <span>{{ totalPoints }}</span>
            </span>

            <!-- Branches (from SvgIcon 'branch') -->
            <span class="inline-flex items-center gap-1" title="Кількість альтернатив">
              <SvgIcon name="branch" class="w-3.5 h-3.5 text-gray-900" />
              <span>{{ branches.length }}</span>
            </span>

            <!-- Turnaround time (from SvgIcon 'route') -->
            <span class="inline-flex items-center gap-1" title="Час обороту">
              <SvgIcon name="route" class="w-3 h-4 text-gray-900" />
              <span>{{ currentRouteTravelTime }} хв</span>
            </span>
          </div>

          <!-- Work modes (from SvgIcon 'wmode') -->
          <div class="inline-flex items-center gap-1.5" title="Режими роботи">
            <SvgIcon name="wmode" class="w-4 h-3.5 text-gray-900" />
            <span class="tracking-widest">1 2 5</span>
          </div>

          <!-- Rest / Lunch / Depot counts (from SvgIcon 'bed', 'lunch', 'depot') -->
          <div class="flex items-center gap-3">
            <span class="inline-flex items-center gap-1" title="Пункти відпочинку">
              <SvgIcon name="bed" class="w-4 h-3 text-gray-900" />
              <span>{{ restCount }}</span>
            </span>
            <span class="inline-flex items-center gap-1" title="Пункти обіду">
              <SvgIcon name="lunch" class="w-2.5 h-4 text-gray-900" />
              <span>{{ lunchCount }}</span>
            </span>
            <span class="inline-flex items-center gap-1" title="Депо">
              <SvgIcon name="depot" class="w-4 h-3.5 text-gray-900" />
              <span>{{ depotCount }}</span>
            </span>
          </div>
        </div>

        <!-- Time Period Slider for Intervals & Travel Time (Per Time Period in the Day) -->
        <div v-if="routePeriods.length > 0"
             class="px-4 py-3 rounded-2xl bg-white border border-gray-200 shadow-xs flex flex-col gap-2">
          <div class="flex items-center justify-between text-xs">
            <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Проміжки доби (інтервали та час)</span>
            <span class="font-extrabold text-gray-900 tabular-nums">
              {{ routePeriods[selectedPeriodIdx]?.period }} · {{ currentRouteTravelTime }} хв
            </span>
          </div>

          <input v-if="routePeriods.length > 1"
                 type="range"
                 :min="0"
                 :max="routePeriods.length - 1"
                 :step="1"
                 :value="selectedPeriodIdx"
                 @input="e => selectPeriodByIndex(+e.target.value)"
                 class="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                 :style="{ accentColor: routeColor }" />

          <!-- Period Chips (without labels, only time ranges) -->
          <div class="flex flex-wrap gap-1.5 pt-0.5">
            <button v-for="(pt, idx) in routePeriods" :key="idx"
                    @click="selectPeriodByIndex(idx)"
                    class="px-2.5 py-1 rounded-full text-[11px] font-bold transition cursor-pointer border"
                    :class="selectedPeriodIdx === idx ? 'text-white shadow-xs' : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'"
                    :style="selectedPeriodIdx === idx ? { backgroundColor: routeColor, borderColor: routeColor } : {}">
              {{ pt.period }}
            </button>
          </div>
        </div>

        <!-- Terminal 1 Operating Hours Pill -->
        <div class="inline-flex items-center gap-4 px-4 py-2 rounded-full bg-white border border-gray-200 shadow-xs text-xs font-bold text-gray-900 w-max max-w-full">
          <span class="truncate max-w-[180px]">{{ terminus1DisplayName }}</span>
          <span class="font-semibold text-gray-800">5:50-6:00</span>
          <span class="font-semibold text-gray-800">21:30-22:00</span>
        </div>

        <!-- Terminal 2 Operating Hours Pill -->
        <div class="inline-flex items-center gap-4 px-4 py-2 rounded-full bg-white border border-gray-200 shadow-xs text-xs font-bold text-gray-900 w-max max-w-full -mt-1.5">
          <span class="truncate max-w-[180px]">{{ terminus2DisplayName }}</span>
          <span class="font-semibold text-gray-800">5:50-6:00</span>
          <span class="font-semibold text-gray-800">21:30-22:00</span>
        </div>

        <!-- Mini-Map Card -->
        <div class="w-full h-48 rounded-3xl overflow-hidden border border-gray-200 shadow-xs relative bg-gray-50">
          <div ref="miniMapContainer" class="w-full h-full"></div>
        </div>

        <!-- Bottom 3 Pill Action Buttons (Frame 4 Exact Colors) -->
        <div class="flex items-center gap-3.5 pt-1">
          <button @click="isTableViewOpen = true"
                  class="flex-1 py-2.5 px-4 rounded-full font-bold text-xs text-gray-900 bg-[#BFCBFF] hover:bg-[#aebdff] shadow-xs transition cursor-pointer border-none">
            Табличний вигляд
          </button>
          <button @click="enterEditMode"
                  class="flex-1 py-2.5 px-4 rounded-full font-bold text-xs text-gray-900 bg-[#FDE067] hover:bg-[#fcd642] shadow-xs transition cursor-pointer border-none">
            Редагувати
          </button>
          <button @click="deleteCurrentRoute"
                  class="flex-1 py-2.5 px-4 rounded-full font-bold text-xs text-gray-900 bg-[#F46A6A] hover:bg-[#ef5353] shadow-xs transition cursor-pointer border-none">
            Видалити
          </button>
        </div>

      </div>
    </div>

    <!-- ════════════════════════════════════════
         RIGHT PANEL: CONSTRUCTOR / EDIT MODE
    ════════════════════════════════════════ -->
    <div v-else
         v-show="isSidebarOpen"
         :style="{ width: sidebarWidth + 'px' }"
         class="relative border-l border-gray-200 bg-white flex flex-col shrink-0 shadow-xl transition-all"
         :class="{ 'duration-300': !isResizing }">
      
      <!-- Drag handle -->
      <div class="absolute top-0 left-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-400/30 z-[100] transition-colors"
           @mousedown="startResize"></div>
           
      <!-- Scrollable content wrapper -->
      <div class="flex-1 overflow-y-auto flex flex-col">
      
      <!-- MAIN CONSTRUCTOR PANEL -->
      <template v-if="!activeSegment">
        <div class="p-6 flex-1 flex flex-col gap-3">
          <h1 class="text-2xl font-bold italic text-gray-900">
            {{ routeTransportType === 'bus' ? 'Автобусний маршрут' : 'Тролейбусний маршрут' }}
          </h1>

          <!-- Route ID -->
          <div class="border border-gray-200 rounded-2xl p-4">
            <!-- Transport Type Toggle -->
            <div class="flex items-center gap-2 mb-3">
              <button type="button"
                      @click="routeTransportType = 'trolleybus'"
                      class="flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                      :class="routeTransportType === 'trolleybus' ? 'text-white shadow-xs' : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'"
                      :style="routeTransportType === 'trolleybus' ? { backgroundColor: routeColor } : {}">
                <span>Тролейбус</span>
              </button>
              <button type="button"
                      @click="routeTransportType = 'bus'"
                      class="flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                      :class="routeTransportType === 'bus' ? 'text-white shadow-xs' : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'"
                      :style="routeTransportType === 'bus' ? { backgroundColor: routeColor } : {}">
                <span>Автобус</span>
              </button>
            </div>

            <div class="grid grid-cols-3 gap-3">
              <div>
                <p class="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Номер маршруту</p>
                <input v-model="routeNumber" type="text" maxlength="3"
                  class="w-full text-center text-lg font-bold bg-gray-50 border border-gray-200 rounded-xl py-2 text-gray-900 focus:outline-none focus:border-blue-400"/>
              </div>
              <div>
                <p class="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Буква маршруту</p>
                <input v-model="routeLetter" type="text" maxlength="1"
                  class="w-full text-center text-lg font-bold bg-gray-50 border border-gray-200 rounded-xl py-2 text-gray-900 focus:outline-none focus:border-blue-400"/>
              </div>
              <div>
                <p class="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Колір маршруту</p>
                <label class="relative h-10 rounded-xl overflow-hidden border border-gray-200 cursor-pointer shadow-sm flex items-center justify-center"
                       title="Змінити колір маршруту">
                  <div class="absolute inset-0 rounded-xl" :style="{ backgroundColor: routeColor }"></div>
                  <SvgIcon name="pipette" width="16" height="18" class="relative z-10 text-white drop-shadow-xs" />
                  <input type="color" v-model="routeColor" class="absolute inset-0 opacity-0 w-full h-full cursor-pointer"/>
                </label>
              </div>
            </div>
          </div>

          <!-- Work modes (Clean 3-column grid, no extra eye button) -->
          <div class="border border-gray-200 rounded-2xl p-4">
            <div class="grid grid-cols-3 gap-2">
              <div v-for="mode in workModes" :key="mode.id"
                   @click="selectedWorkMode = mode.id"
                   class="flex flex-col items-center gap-1.5 cursor-pointer">
                <span class="text-xs font-semibold text-gray-600 text-center leading-tight">{{ mode.name }}</span>
                <div class="w-12 h-9 rounded-xl border-2 flex items-center justify-center font-bold text-base transition-all"
                     :class="selectedWorkMode === mode.id
                       ? 'bg-gray-100 border-gray-400 text-gray-900'
                       : 'bg-gray-50 border-gray-200 text-gray-300'">
                  {{ mode.value }}
                </div>
              </div>
            </div>
          </div>

          <!-- Terminal stops -->
          <div class="grid grid-cols-2 gap-3">
            <div v-for="node in endNodes" :key="'pe-' + node.id"
                 class="border rounded-2xl p-3 flex flex-col gap-2 transition-colors"
                 :class="validationIssues.nodeIssues?.[node.id] === 'red'
                   ? 'border-red-300 bg-red-50/20 border-b-2 border-b-red-500'
                   : 'border-gray-200'">
              <h3 class="text-sm font-bold text-gray-900 text-center mb-1 flex justify-center items-center gap-2">
                <span :class="validationIssues.nodeIssues?.[node.id] === 'red'
                  ? 'underline decoration-red-500 decoration-2 underline-offset-4 text-red-700'
                  : ''">
                  {{ node.name }}
                </span>
                <button @click="removeTerminus(node)" class="text-red-400 hover:text-red-600 focus:outline-none" title="Видалити кінцеву">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </h3>
              
              <div class="mt-1">
                <label class="text-[9px] font-bold text-gray-400 uppercase block mb-1">Прив'язка до бази</label>
                <StopSelector 
                  :model-value="routeGraph.nodes[node.id]?.realId" 
                  :stops="availableStops" 
                  @create="name => createNewStopForNode(node.id, name)"
                  @update:modelValue="id => assignRealStopToNode(node.id, id)"
                />
              </div>

              <!-- Depot / Lunch info -->
              <div class="flex items-center justify-between text-xs mt-1">
                <span v-if="getStopType(node.realId) === 'depo'" class="px-2 py-0.5 bg-yellow-100 text-yellow-700 font-bold rounded-md text-[9px] uppercase tracking-wide">ДЕПО</span>
                <span v-else-if="getStopType(node.realId) === 'end'" class="px-2 py-0.5 bg-purple-100 text-purple-700 font-bold rounded-md text-[9px] uppercase tracking-wide">КІНЦЕВА</span>
                <span v-else class="px-2 py-0.5 bg-gray-100 text-gray-500 font-bold rounded-md text-[9px] uppercase tracking-wide">ЗВИЧАЙНА</span>
                
                <label class="flex items-center gap-1 cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded transition-colors">
                  <input type="checkbox" v-model="routeGraph.nodes[node.id].canLunch" class="w-3 h-3 text-blue-500 rounded border-gray-300"/>
                  <span class="text-[9px] font-bold text-gray-600 uppercase tracking-wide mt-0.5">Обід</span>
                </label>
              </div>

              <div class="mt-1 bg-gray-50 border border-gray-100 p-2 rounded-xl">
                <label class="text-[9px] font-bold text-gray-400 uppercase block mb-1 text-center">Час відпочинку (хв)</label>
                <div class="flex items-center justify-center gap-1.5 text-xs">
                  <input v-model.number="routeGraph.nodes[node.id].waitMin" type="number" min="0"
                    class="w-10 text-center border border-gray-200 rounded-lg py-1 font-bold text-gray-800 bg-white focus:outline-none focus:border-blue-400 shadow-sm" title="Мінімум"/>
                  <span class="text-gray-400 font-bold">–</span>
                  <input v-model.number="routeGraph.nodes[node.id].waitMax" type="number" min="0"
                    class="w-10 text-center border border-gray-200 rounded-lg py-1 font-bold text-gray-800 bg-white focus:outline-none focus:border-blue-400 shadow-sm" title="Максимум"/>
                </div>
              </div>
            </div>
          </div>
          
          <div v-if="nodes.filter(n => !n.isTerminus).length > 0" class="mt-0">
            <select @change="makeTerminus($event.target.value); $event.target.value=''" class="w-full bg-gray-50 border border-gray-200 rounded-xl px-2 py-2 text-xs font-semibold text-gray-700 focus:outline-none focus:border-blue-400">
              <option value="">+ Зробити контрольну кінцевою</option>
              <option v-for="n in nodes.filter(n => !n.isTerminus)" :key="n.id" :value="n.id">
                {{ n.name }}
              </option>
            </select>
          </div>

          <!-- Time range & Period Switcher Slider -->
          <div class="border border-gray-200 rounded-2xl p-4 flex flex-col gap-2.5">
            <div class="flex items-center justify-between gap-1.5 flex-wrap">
              <p class="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Часові проміжки доби</p>
              <div class="flex items-center gap-1.5">
                <button @click="addTimePeriod"
                        class="text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-blue-200 text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                        title="Додати новий проміжок у кінець">
                  + Додати проміжок
                </button>
              </div>
            </div>

            <!-- Slider across time periods of the day -->
            <div v-if="routePeriods.length > 1" class="flex flex-col gap-1">
              <input type="range"
                     :min="0"
                     :max="routePeriods.length - 1"
                     :step="1"
                     :value="selectedPeriodIdx"
                     @input="e => selectPeriodByIndex(+e.target.value)"
                     class="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                     :style="{ accentColor: routeColor }" />
              <div class="flex justify-between text-[10px] text-gray-400 font-semibold">
                <span>Проміжок {{ selectedPeriodIdx + 1 }} з {{ routePeriods.length }}</span>
                <span class="text-gray-700 font-bold">Оборот: {{ totalTime }} хв</span>
              </div>
            </div>

            <!-- Period pills -->
            <div class="flex flex-wrap gap-1.5">
              <div v-for="(pt, idx) in routePeriods" :key="idx"
                   class="inline-flex items-center rounded-full border text-[11px] font-bold transition overflow-hidden"
                   :class="[
                     selectedPeriodIdx === idx ? 'text-white shadow-xs' : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100',
                     validationIssues.redErrors.some(e => e.periodIdx === idx) ? 'ring-2 ring-red-500 ring-offset-1' : ''
                   ]"
                   :style="selectedPeriodIdx === idx ? { backgroundColor: routeColor, borderColor: routeColor } : {}">
                <button @click="selectPeriodByIndex(idx)" class="px-2.5 py-1 cursor-pointer flex items-center gap-1">
                  <span v-if="validationIssues.redErrors.some(e => e.periodIdx === idx)" class="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0"></span>
                  <span>{{ pt.period }}</span>
                </button>
                <button v-if="routePeriods.length > 1"
                        @click.stop="removeTimePeriod(idx)"
                        class="pr-2 pl-0.5 py-1 opacity-70 hover:opacity-100 cursor-pointer"
                        title="Видалити проміжок">
                  ✕
                </button>
              </div>
            </div>

            <div class="flex items-center gap-2 mt-1">
              <div class="flex-1">
                <label class="text-[10px] text-gray-400 mb-0.5 block">Від</label>
                <input type="time"
                  :value="fmtTime(timeStart)"
                  @change="e => onTimeStartChange(e.target.value, e.target)"
                  @blur="e => onTimeStartChange(e.target.value, e.target)"
                  class="w-full border border-gray-200 rounded-xl px-2 py-1.5 text-sm font-bold text-gray-800 bg-gray-50 focus:outline-none focus:border-blue-400"/>
              </div>
              <span class="text-gray-300 mt-4">—</span>
              <div class="flex-1">
                <label class="text-[10px] text-gray-400 mb-0.5 block">До</label>
                <input type="time"
                  :value="fmtTime(timeEnd)"
                  @change="e => onTimeEndChange(e.target.value, e.target)"
                  @blur="e => onTimeEndChange(e.target.value, e.target)"
                  class="w-full border border-gray-200 rounded-xl px-2 py-1.5 text-sm font-bold text-gray-800 bg-gray-50 focus:outline-none focus:border-blue-400"/>
              </div>
            </div>
            <div class="flex items-center justify-between gap-1 flex-wrap">
              <div class="flex gap-1 flex-wrap">
                <button v-for="d in [-60,-15,15,60]" :key="d"
                  @click="shiftTime(d)"
                  class="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-gray-200 text-gray-500 hover:bg-gray-100 transition-colors cursor-pointer"
                  :title="`${d > 0 ? 'Додати' : 'Відняти'} ${Math.abs(d)} хв до кінця проміжку`">
                  {{ d > 0 ? '+' : '' }}{{ d }}хв
                </button>
              </div>
              <button @click="openSplitTimePrompt"
                class="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
                title="Поділити проміжок">
                <SvgIcon name="split" class="w-3.5 h-3" />
                <span>Поділити проміжок</span>
              </button>
            </div>

            <!-- Inline prompt asking for exact split time -->
            <div v-if="isSplitPeriodOpen" class="mt-1 p-3 rounded-xl bg-gray-50 border border-gray-200 flex flex-col gap-2">
              <div class="flex items-center justify-between">
                <span class="text-[10px] font-bold text-gray-600 uppercase tracking-wider">Оберіть час поділу ({{ fmtTime(timeStart) }} – {{ fmtTime(timeEnd) }})</span>
                <button @click="isSplitPeriodOpen = false" class="text-gray-400 hover:text-gray-600 text-xs cursor-pointer">✕</button>
              </div>
              <div class="flex items-center gap-2">
                <input type="time"
                       :value="fmtTime(splitTimeMinutes)"
                       @change="e => { const parsed = parseTimeStrToMinutes(e.target.value, splitTimeMinutes); splitTimeMinutes = Math.max(timeStart + 1, Math.min(timeEnd - 1, parsed)); e.target.value = fmtTime(splitTimeMinutes); }"
                       @blur="e => { const parsed = parseTimeStrToMinutes(e.target.value, splitTimeMinutes); splitTimeMinutes = Math.max(timeStart + 1, Math.min(timeEnd - 1, parsed)); e.target.value = fmtTime(splitTimeMinutes); }"
                       class="flex-1 border border-gray-200 rounded-xl px-2.5 py-1.5 text-sm font-bold text-gray-800 bg-white focus:outline-none focus:border-blue-400" />
                <button @click="splitTimePeriod"
                        :disabled="splitTimeMinutes <= timeStart || splitTimeMinutes >= timeEnd"
                        class="px-3 py-1.5 rounded-xl text-xs font-bold text-white transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        :style="{ backgroundColor: routeColor }">
                  Поділити
                </button>
              </div>
              <div class="text-[10px] text-gray-500 font-medium flex items-center justify-between">
                <span>1: <b class="text-gray-800">{{ fmtTime(timeStart) }} - {{ fmtTime(splitTimeMinutes) }}</b></span>
                <span>2: <b class="text-gray-800">{{ fmtTime(splitTimeMinutes) }} - {{ fmtTime(timeEnd) }}</b></span>
              </div>
            </div>
          </div>

          <!-- Segments -->
          <div class="border border-gray-200 rounded-2xl p-4">
            <div class="flex items-center justify-between mb-3">
              <p class="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Ділянки маршруту</p>
              <span v-if="hasFinishedBranches" class="text-[9px] font-bold text-gray-400">
                Проміжок: <b class="text-gray-700">{{ routePeriods[selectedPeriodIdx]?.period }}</b>
              </span>
            </div>
            <div v-for="segItem in allSegmentsList" :key="'ps-' + segItem.keyId"
                 class="mb-2.5 pb-2.5 border-b last:border-0 last:mb-0 last:pb-0 transition-colors"
                 :class="[
                   segItem.disabled ? 'opacity-60 bg-gray-50/80 rounded-xl px-2.5 py-2 border-gray-200' : '',
                   validationIssues.segmentIssues?.[segItem.toggleId] === 'red' || validationIssues.segmentIssues?.[segItem.id] === 'red'
                     ? 'border-red-400 bg-red-50/30 rounded-xl px-2.5 py-2 border-b-2'
                     : (validationIssues.segmentIssues?.[segItem.toggleId] === 'yellow' || validationIssues.segmentIssues?.[segItem.id] === 'yellow'
                         ? 'border-amber-400 bg-amber-50/30 rounded-xl px-2.5 py-2 border-b-2'
                         : 'border-gray-100')
                 ]">
              <div class="flex items-center justify-between mb-1.5 gap-1.5">
                <span class="text-xs font-bold truncate flex items-center gap-1.5 min-w-0"
                      :class="[
                        segItem.disabled ? 'text-gray-400 line-through' : (segItem.isBranch ? 'text-purple-700' : 'text-gray-700'),
                        validationIssues.segmentIssues?.[segItem.toggleId] === 'red' || validationIssues.segmentIssues?.[segItem.id] === 'red' ? 'underline decoration-red-500 decoration-2 underline-offset-4 text-red-700' : '',
                        validationIssues.segmentIssues?.[segItem.toggleId] === 'yellow' || validationIssues.segmentIssues?.[segItem.id] === 'yellow' ? 'underline decoration-amber-400 decoration-2 underline-offset-4 text-amber-800' : ''
                      ]">
                  <span v-if="segItem.isConnecting" class="px-1.5 py-0.5 text-[8px] font-bold uppercase rounded bg-indigo-100 text-indigo-700 shrink-0">З'єднувальна ділянка</span>
                  <span v-else-if="segItem.isBranch" class="px-1.5 py-0.5 text-[8px] font-bold uppercase rounded bg-purple-100 text-purple-700 shrink-0">Гілка</span>
                  <span v-else-if="segItem.subBadge" class="px-1.5 py-0.5 text-[8px] font-bold uppercase rounded bg-amber-100 text-amber-800 shrink-0">{{ segItem.subBadge }}</span>
                  <span class="truncate">{{ segItem.name }}</span>
                </span>
                <div class="flex items-center gap-1 shrink-0">
                  <button v-if="hasFinishedBranches && segItem.hasAlternative"
                          @click.stop="handleToggleChain(segItem.toggleId)"
                          class="text-[10px] font-bold px-2 py-0.5 rounded-full border transition-colors cursor-pointer"
                          :class="segItem.disabled
                            ? 'bg-gray-200 text-gray-600 border-gray-300 hover:bg-gray-300'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'"
                          :title="segItem.disabled ? 'Увімкнути ділянку (від з\'єднання до з\'єднання)' : 'Вимкнути ділянку (від з\'єднання до з\'єднання)'">
                    {{ segItem.disabled ? 'Вимк' : 'Увімк' }}
                  </button>
                  <button @click="router.push({ query: { ...route.query, segmentId: segItem.id } })"
                    class="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-blue-200 text-blue-500 hover:bg-blue-50 transition-colors cursor-pointer">
                    Налаштувати
                  </button>
                </div>
              </div>
              <div class="grid grid-cols-3 gap-1.5">
                <div class="bg-gray-50 rounded-xl p-2 text-center border border-gray-100">
                  <div class="text-gray-400 text-[9px] mb-0.5 uppercase tracking-wider">Час хв</div>
                  <div class="font-bold text-sm text-gray-800">{{ segItem.travelTime }}</div>
                </div>
                <div class="bg-gray-50 rounded-xl p-2 text-center border border-gray-100">
                  <div class="text-gray-400 text-[9px] mb-0.5 uppercase tracking-wider">Інт. від</div>
                  <div class="font-bold text-sm text-gray-800">{{ segItem.interval }}</div>
                </div>
                <div class="bg-gray-50 rounded-xl p-2 text-center border border-gray-100">
                  <div class="text-gray-400 text-[9px] mb-0.5 uppercase tracking-wider">Інт. до</div>
                  <div class="font-bold text-sm text-gray-800">{{ segItem.intervalMax }}</div>
                </div>
              </div>
              <p class="text-[10px] text-gray-400 mt-1.5">
                Зупинок: <b class="text-gray-600">{{ segItem.stops ? segItem.stops.length : 0 }}</b>
              </p>
            </div>
          </div>

          <!-- Branches -->
          <div v-if="branches.length" class="border border-gray-200 rounded-2xl p-4">
            <p class="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Альтернативи</p>
            <div v-for="(br, bIdx) in branches" :key="'pbr-' + br.id"
                 class="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0 text-sm gap-2">
              <span class="font-semibold truncate"
                    :class="br.sections?.[0] && isTargetDisabled(br.sections[0].id) ? 'text-gray-400 line-through' : 'text-gray-700'">
                {{ br.name }}
              </span>
              <div class="flex items-center gap-1.5 shrink-0">
                <button v-if="br.finished && br.sections?.[0]"
                        @click.stop="handleToggleChain(br.sections[0].id)"
                        class="text-[10px] font-bold px-2 py-0.5 rounded-full border transition-colors cursor-pointer"
                        :class="isTargetDisabled(br.sections[0].id)
                          ? 'bg-gray-200 text-gray-600 border-gray-300 hover:bg-gray-300'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'"
                        :title="isTargetDisabled(br.sections[0].id) ? 'Увімкнути альтернативу на поточний проміжок' : 'Вимкнути альтернативу на поточний проміжок'">
                  {{ isTargetDisabled(br.sections[0].id) ? 'Вимк' : 'Увімк' }}
                </button>
                <button @click="branches.splice(bIdx, 1)"
                  class="text-red-300 hover:text-red-500 transition-colors text-xs cursor-pointer">✕</button>
              </div>
            </div>
          </div>

          <!-- Summary -->
          <div class="border border-gray-200 rounded-2xl p-3">
            <p class="text-[10px] font-semibold text-gray-400 uppercase tracking-wider text-center mb-2">Оборот</p>
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-1 text-xs text-gray-700 font-medium flex-wrap">
                <span>{{ topNode?.name }}</span>
                <svg class="w-3 h-3 text-gray-400 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clip-rule="evenodd"/>
                </svg>
                <span>{{ bottomNode?.name }}</span>
                <svg class="w-3 h-3 text-gray-400 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clip-rule="evenodd"/>
                </svg>
                <span>{{ topNode?.name }}</span>
              </div>
              <div class="flex items-center gap-2 text-xs font-bold text-gray-700 shrink-0">
                <span class="flex items-center gap-0.5">
                  <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0"/>
                  </svg>
                  {{ totalStops }}
                </span>
                <span class="flex items-center gap-0.5">
                  <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                  </svg>
                  {{ totalTime }} хв
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="border-t border-gray-200 p-5 flex gap-3 bg-white shrink-0">
          <button @click="router.push('/base/route')"
            class="flex-1 py-3 rounded-xl font-bold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 transition-colors text-sm cursor-pointer">
            Скасувати
          </button>
          <button @click="saveCurrentRoute"
            class="flex-1 py-3 rounded-xl font-bold text-white hover:opacity-90 transition-opacity text-sm shadow-md cursor-pointer border-none"
            :style="{ backgroundColor: routeColor }">
            Зберегти маршрут
          </button>
        </div>
      </template>

      <!-- SEGMENT EDITOR PANEL -->
      <template v-else>
        <div class="p-6 flex-1 flex flex-col gap-5 bg-gray-50">
          
          <button @click="closeSegmentEditor"
            class="self-start text-xs font-bold text-gray-500 hover:text-gray-900 flex items-center gap-1 transition-colors cursor-pointer">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
            Назад до маршруту
          </button>

          <div class="flex items-center justify-between gap-2">
            <h2 class="text-xl font-bold text-gray-900 truncate">{{ getSegmentName(activeSegment) }}</h2>
            <button v-if="hasFinishedBranches && isTargetSwitchable(activeSegment.id)"
                    @click.stop="handleToggleChain(activeSegment.id)"
                    class="shrink-0 text-xs font-bold px-3 py-1 rounded-full border transition-colors cursor-pointer"
                    :class="isTargetDisabled(activeSegment.id)
                      ? 'bg-gray-200 text-gray-700 border-gray-300 hover:bg-gray-300'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'"
                    title="Увімкнути/вимкнути ділянку від з'єднання до з'єднання на обраний часовий проміжок">
              {{ isTargetDisabled(activeSegment.id) ? 'Вимкнено на проміжок' : 'Увімкнено на проміжок' }}
            </button>
          </div>

          <!-- Time & Intervals -->
          <div class="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
            <h3 class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Параметри ділянки</h3>
            
            <div class="grid grid-cols-3 gap-3 mb-3">
              <div>
                <label class="text-[10px] font-semibold text-gray-500 block mb-1">Час в дорозі</label>
                <div class="relative">
                  <input v-model.number="routeGraph.segments[activeSegment.id].travelTime" type="number" min="1"
                    class="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-bold text-gray-800 focus:outline-none focus:border-blue-400 pr-6"/>
                  <span class="absolute right-2 top-1.5 text-xs font-bold text-gray-400">хв</span>
                </div>
              </div>
              <div>
                <label class="text-[10px] font-semibold text-gray-500 block mb-1">Інтервал від</label>
                <input v-model="routeGraph.segments[activeSegment.id].interval" type="text"
                  class="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-bold text-gray-800 focus:outline-none focus:border-blue-400"/>
              </div>
              <div>
                <label class="text-[10px] font-semibold text-gray-500 block mb-1">Інтервал до</label>
                <input v-model="routeGraph.segments[activeSegment.id].intervalMax" type="text"
                  class="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-bold text-gray-800 focus:outline-none focus:border-blue-400"/>
              </div>
            </div>

            <!-- Control nodes forming this segment -->
            <div v-if="activeSegmentNodes.length > 0" class="mt-4 pt-4 border-t border-gray-100">
               <h4 class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Контрольні точки ділянки</h4>
               <div v-for="node in activeSegmentNodes" :key="'cn-' + node.id"
                    class="mt-2 flex items-center gap-1 pb-1.5 border-b-2 transition-colors"
                    :class="validationIssues.nodeIssues?.[node.id] === 'red'
                      ? 'border-red-500'
                      : 'border-transparent'">
                 <span class="text-xs font-medium w-1/3 truncate"
                       :class="validationIssues.nodeIssues?.[node.id] === 'red'
                         ? 'text-red-600 font-bold underline decoration-red-500 decoration-2 underline-offset-2'
                         : ''"
                       :title="node.name">{{ node.name }}</span>
                 <StopSelector 
                   :model-value="routeGraph.nodes[node.id]?.realId" 
                   :stops="availableStops" 
                   @create="name => createNewStopForNode(node.id, name)"
                   @update:modelValue="id => assignRealStopToNode(node.id, id)"
                 />
               </div>
            </div>
          </div>

          <!-- Stops List -->
          <div class="flex-1 flex flex-col min-h-0 bg-white border border-gray-200 rounded-2xl shadow-sm">
            <div class="p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Зупинки на ділянці</h3>
              <span class="text-xs font-bold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{{ (activeSegment.unifiedStops || activeSegment.stops).length }}</span>
            </div>
            
            <div class="p-2 overflow-y-auto flex-1">
              <div v-if="(activeSegment.unifiedStops || activeSegment.stops).length === 0" class="p-4 text-center text-gray-400 text-sm font-medium">
                Немає зупинок. Додайте їх на схемі.
              </div>
              <template v-for="(stop, sIdx) in (activeSegment.unifiedStops || activeSegment.stops)" :key="stop.id">
                <div v-if="activeSegment.unifiedStops && sIdx === activeSegment.stops.length" 
                     class="flex justify-center my-3 relative">
                  <div class="absolute inset-0 flex items-center" aria-hidden="true">
                    <div class="w-full border-t border-blue-200/60 border-dashed"></div>
                  </div>
                  <div class="relative bg-white border border-blue-200 rounded-md shadow-sm px-2 py-1 flex items-center gap-1.5 justify-center text-blue-600" title="Місце злиття">
                    <SvgIcon name="finish-branch" class="w-3 h-3 text-blue-600" />
                    <span class="text-[10px] font-bold uppercase tracking-wider">Злиття</span>
                  </div>
                </div>
                <div class="mb-2 p-3 rounded-xl group relative border transition-colors"
                     :class="validationIssues.stopIssues?.[stop.id] === 'red'
                       ? 'bg-red-50/40 border-red-200 border-b-2 border-b-red-500'
                       : (validationIssues.stopIssues?.[stop.id] === 'yellow'
                           ? 'bg-amber-50/40 border-amber-200 border-b-2 border-b-amber-400'
                           : 'bg-gray-50 border-gray-100')">
                
                <div class="flex items-center justify-between mb-2">
                  <div class="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                    <span class="w-4 h-4 rounded-full flex items-center justify-center text-[9px]"
                          :class="validationIssues.stopIssues?.[stop.id] === 'red'
                            ? 'bg-red-100 text-red-600'
                            : (validationIssues.stopIssues?.[stop.id] === 'yellow'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-blue-100 text-blue-600')">{{ sIdx + 1 }}</span>
                    <span :class="validationIssues.stopIssues?.[stop.id] === 'red'
                            ? 'underline decoration-red-500 decoration-2 underline-offset-4 text-red-700'
                            : (validationIssues.stopIssues?.[stop.id] === 'yellow'
                                ? 'underline decoration-amber-400 decoration-2 underline-offset-4 text-amber-800'
                                : '')">
                      {{ stop.name }}
                    </span>
                  </div>
                  <button @click="removeStopFromSeg(activeSegment, stop)"
                          class="text-gray-400 hover:text-red-500 transition-colors p-1" title="Видалити зупинку">
                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                  </button>
                </div>

                <div class="mt-2">
                  <label class="text-[9px] font-bold text-gray-400 uppercase block mb-1">Прив'язка до бази</label>
                  <StopSelector 
                    :model-value="routeGraph.stops[stop.id]?.realId" 
                    :stops="availableStops" 
                    @create="name => createNewStopForSegStop(stop.id, name)"
                    @update:modelValue="id => assignRealStopToSegStop(stop.id, id)"
                  />
                  <div v-if="stop.realId && getStopDirection(stop.realId)" class="mt-1.5 flex items-start gap-1">
                    <svg class="w-3 h-3 text-gray-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
                    <span class="text-[9px] text-gray-500 font-semibold uppercase leading-tight">{{ getStopDirection(stop.realId) }}</span>
                  </div>
                </div>
              </div>
              </template>
            </div>
          </div>

        </div>
      </template>
      </div>
    </div>

  </div>
</template>

<style scoped>
::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 9px; }

@keyframes diamondRotateOnce180 {
  0%, 38% {
    transform: rotate(45deg) scale(1);
  }
  82% {
    transform: rotate(225deg) scale(1.06);
  }
  100% {
    transform: rotate(225deg) scale(1);
  }
}

.diamond-rotate-once-180 {
  transform: rotate(45deg);
  animation: diamondRotateOnce180 1.4s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}
</style>
