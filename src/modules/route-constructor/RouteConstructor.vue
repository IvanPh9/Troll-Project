<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useStopsStore } from '@/stores/stops';
import RouteCanvas from './components/RouteCanvas.vue';
import StopSelector from './components/StopSelector.vue';
import SvgIcon from '@/components/ui/SvgIcon.vue';

const router = useRouter();
import { migrateToGraph, traverseGraph, addControlNodeGraph, addStopGraph, removeStopGraph, removeNodeGraph, addBranchGraph, addBranchNodeGraph, removeBranchNodeGraph, setBranchConfigGraph, renameStopIdGraph, rotateGraph180 } from './utils/graphModel.js';
import { useGraphHistory } from './utils/graphHistory.js';
import { calculateBranchLevels } from './utils/branchLevelModel.js';

const route = useRoute();
const stopsStore = useStopsStore();

/* ─────────── Route meta ─────────── */
const routeNumber      = ref('1');
const routeLetter      = ref('А');
const routeColor       = ref('#1D43EF');
const selectedWorkMode = ref(1);
const workModes = [
  { id: 1, name: 'Змінний',          value: '1' },
  { id: 2, name: 'Одинарний "Пік"',  value: '2' },
  { id: 3, name: '10 Годинний',      value: '5' },
];

/* ─────────── Time scrubber ─────────── */
const timeStart = ref(360);   // 06:00
const timeEnd   = ref(640);   // 10:40
function fmtTime(min) {
  return `${String(Math.floor(min / 60)).padStart(2,'0')}:${String(min % 60).padStart(2,'0')}`;
}
function shiftTime(delta) {
  timeStart.value = Math.max(0,    Math.min(1380, timeStart.value + delta));
  timeEnd.value   = Math.max(60,   Math.min(1440, timeEnd.value   + delta));
}

/* ─────────── Data model ─────────── */
const initialNodes = [
  { id: 1, type: 'control', isTerminus: true, name: 'Кінцева 1', terminusStop: '', waitMin: 5, waitMax: 9, side: 'top' },
  { id: 2, type: 'control', name: 'Контрольна 1', side: 'right' },
  { id: 3, type: 'control', name: 'Контрольна 2', side: 'right' },
  { id: 4, type: 'control', name: 'Контрольна 1 (Зворотня)', side: 'left' },
  { id: 5, type: 'control', name: 'Контрольна 2 (Зворотня)', side: 'left' },
  { id: 6, type: 'control', isTerminus: true, name: 'Кінцева 2', terminusStop: '', waitMin: 5, waitMax: 9, side: 'bottom' },
];

const initialSegments = [
  { id: 1, side: 'right', travelTime: 6,  interval: '20', intervalMax: '25', stops: [
    { id: 101, name: 'Зупинка 1', side: 'right' },
    { id: 102, name: 'Зупинка 2', side: 'right' },
  ]},
  { id: 2, side: 'right', travelTime: 6,  interval: '20', intervalMax: '25', stops: [
    { id: 201, name: 'Зупинка 3', side: 'right' },
  ]},
  { id: 3, side: 'right', travelTime: 6,  interval: '20', intervalMax: '25', stops: [] },
  { id: 4, side: 'left', travelTime: 6,  interval: '20', intervalMax: '25', stops: [
    { id: 301, name: 'Зупинка 4', side: 'left' },
  ]},
  { id: 5, side: 'left', travelTime: 6,  interval: '20', intervalMax: '25', stops: [
    { id: 401, name: 'Зупинка 5', side: 'left' },
    { id: 402, name: 'Зупинка 6', side: 'left' },
  ]},
  { id: 6, side: 'left', travelTime: 6,  interval: '20', intervalMax: '25', stops: [] },
];

const routeGraph = ref(migrateToGraph(initialNodes, initialSegments, []));
const { undoStack, redoStack, actionLogs, takeSnapshot, undo, redo, clearHistory, canUndo, canRedo } = useGraphHistory(routeGraph);

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
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown, true);
});

const traversedData = computed(() => traverseGraph(routeGraph.value));
const nodes = computed(() => traversedData.value.nodes);
const segments = computed(() => traversedData.value.segments);
const branches = computed(() => traversedData.value.branches);
const branchLevels = computed(() => calculateBranchLevels(branches.value, segments.value, nodes.value));

/* ─────────── Developer Graph Inspector ─────────── */
const showGraphInspector = ref(true);
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

      // Compute target nextStopId for display on the last stop of branch
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

const startResize = (e) => {
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
const isEditable = ref(true);
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
const routeData = computed(() => ({
  routeNumber: routeNumber.value,
  originNodeId: routeGraph.value?.originNodeId || routeGraph.value?.startNodeId,
  nodes: nodes.value.map(n => ({
    ...n,
    isDepot: getStopType(n.realId) === 'depo'
  })),
  segments: segments.value,
  branches: branches.value,
  color: routeColor.value
}));

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

  // If this pill was clicked AFTER a merge at the end of the segment (isAfterMerge === true),
  // OR if adding at the end of the segment without explicit insertIdx (insertIdx === -1),
  // bind any branch reconnecting into this segment/node to merge before this new stop!
  if ((isAfterMerge || insertIdx === -1) && newStopId) {
    const mergingBranches = (branches.value || []).filter(b => {
      if (!b.finished || b.targetType === 'bottom_arc') return false;
      const targetSegIdx = getBranchTargetSegIdx(b);
      const isThisSeg = (targetSegIdx === sIdx);
      const hasValidTargetStop = b.targetStopId && seg.stops && seg.stops.some(st => String(st.id) === String(b.targetStopId));
      return isThisSeg && (!b.targetStopId || !hasValidTargetStop || b.targetType === 'node');
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
    // Control nodes of the parent branch only
    return parentBranchForFinishing.value?.nodes || [];
  } else {
    // Control nodes AND terminus nodes of the same rail side after the branch start node
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
  selectedFinishNodeId.value = br?.targetNodeId || null;
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
  } else if (config.targetType === 'node') {
    config.bypassedMainState = 'add_pills';
    config.targetStopId = null;
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
    // The new segment is the one pointing to the new node
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

function editBranchStop(brId, sectionIdx, stopIdx) {
  // Native prompt removed: stop/section editing is handled in the sidebar
}

function editBranchNode(brId, bNIdx) {
  const br = branches.value.find(b => b.id === brId);
  if (br && br.nodes && br.nodes[bNIdx]) {
    const currentNode = br.nodes[bNIdx];
    const newName = prompt('Назва контрольної точки на альтернативі (залиште порожнім для видалення):', currentNode.name);
    if (newName !== null) {
      takeSnapshot('Редагування точки на розгалуженні', { brId, newName });
      if (newName.trim() === '') {
        removeBranchNodeGraph(routeGraph.value, brId.replace('br_', ''), bNIdx);
      } else {
        const graphNode = routeGraph.value.nodes[currentNode.id];
        if (graphNode) graphNode.name = newName.trim();
      }
    }
  }
}

function removeBranchNode(brId, bNIdx) {
  takeSnapshot('Видалення точки на розгалуженні', { brId, bNIdx });
  removeBranchNodeGraph(routeGraph.value, brId.replace('br_', ''), bNIdx);
}
/* ─────────── Edit overlays ─────────── */
/* ─────────── Edit overlays ─────────── */
const editSeg  = ref(null);
const editNode = ref(null);

/* ─────────── Totals ─────────── */
const totalStops = computed(() => segments.value.reduce((a, s) => a + s.stops.length, 0));
const firstTerminus = computed(() => {
  const originId = routeGraph.value?.originNodeId;
  if (originId) {
    const found = endNodes.value.find(n => String(n.id) === String(originId));
    if (found) return found;
  }
  return endNodes.value[0] || null;
});

const totalTime  = computed(() => {
  const travel = segments.value.reduce((a, s) => a + Number(s.travelTime || 0), 0);
  let wait = endNodes.value.reduce((a, n) => a + Number(n.waitMin || 0), 0);
  if (firstTerminus.value && endNodes.value.length > 1) {
    wait -= Number(firstTerminus.value.waitMin || 0);
  }
  return travel + wait;
});
const endNodes   = computed(() => nodes.value.filter(n => n.isTerminus));
const topNode    = computed(() => nodes.value.find(n => !n.side || n.side === 'top') || nodes.value[0] || null);
const bottomNode = computed(() => nodes.value.find(n => n.side === 'bottom') || nodes.value.filter(n => !n.side)[1] || null);

/* ─────────── Validation & Errors ─────────── */
const isErrorDetailsOpen = ref(false);

const validationIssues = computed(() => {
  const redErrors = [];
  const yellowWarnings = [];

  // 1. Red: Check if route has at least one terminus
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

  // 2. Red: Check unassigned terminus stops and control nodes
  nodes.value.forEach(node => {
    if (node.type === 'virtual') return;

    if (node.isTerminus) {
      if (!node.realId && !node.terminusStop) {
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
      // Regular control node
      if (!node.realId) {
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

  // 3. Yellow: Check each unassigned regular stop along segments and branches
  segments.value.forEach(seg => {
    if (seg.stops && seg.stops.length > 0) {
      const segName = getSegmentName(seg);
      seg.stops.forEach(st => {
        if (!st.realId) {
          yellowWarnings.push({
            id: `unassigned-stop-${st.id}`,
            stopId: st.id,
            category: 'stop',
            severity: 'yellow',
            title: `Не призначена зупинка: ${st.name || 'Зупинка'}`,
            description: `${segName}`
          });
        }
      });
    }
  });

  // Also check branch section stops
  branches.value.forEach(br => {
    (br.sections || []).forEach(sec => {
      (sec.stops || []).forEach(st => {
        if (!st.realId) {
          yellowWarnings.push({
            id: `unassigned-br-stop-${st.id}`,
            stopId: st.id,
            category: 'stop',
            severity: 'yellow',
            title: `Не призначена зупинка: ${st.name || 'Зупинка'}`,
            description: `Альтернатива: ${br.name || 'Розгалуження'}`
          });
        }
      });
    });
  });

  return {
    redErrors,
    yellowWarnings,
    totalErrors: redErrors.length,
    totalWarnings: yellowWarnings.length,
    totalCount: redErrors.length + yellowWarnings.length
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
            
            // Resolve real start node
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

            // Resolve real end node
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
  // Also search branches if needed
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
  const newStopId = Date.now();
  stopsStore.addStop({
    stopId: newStopId,
    name: newName,
    directionComment: 'новий напрямок',
    type: 'normal',
    directionCode: 1,
    latitude: 0,
    longitude: 0,
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
    graphNode.realId = realStop.id;
    graphNode.terminusStop = realStop.name;
    graphNode.name = realStop.name;
  }
}

function createNewStopForNode(nodeOrId, newName) {
  const nodeId = typeof nodeOrId === 'object' && nodeOrId !== null ? nodeOrId.id : nodeOrId;
  const graphNode = routeGraph.value.nodes[nodeId];
  if (!graphNode) return;

  takeSnapshot('Створення нової зупинки для вузла', { nodeId, newName });
  const newStopId = Date.now();
  stopsStore.addStop({
    stopId: newStopId,
    name: newName,
    directionComment: graphNode.isTerminus ? 'Кінцева' : 'Контрольна точка',
    type: graphNode.isTerminus ? 'end' : 'normal',
    directionCode: 1,
    latitude: 0,
    longitude: 0,
    platformsCount: 1
  });
  graphNode.realId = newStopId;
  graphNode.terminusStop = newName;
  graphNode.name = newName;
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
    // Focus the camera on the new terminus
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
  
  // Right segments (normal order)
  segments.value.filter(s => s.side === 'right' || (!s.side && s.side !== 'left')).forEach(seg => {
    list.push({
      id: seg.id,
      name: getSegmentName(seg),
      travelTime: seg.travelTime,
      interval: seg.interval,
      intervalMax: seg.intervalMax,
      stops: seg.stops,
      isBranch: false,
      rawSeg: seg
    });
  });
  
  // Left segments (reversed order)
  const leftSegs = segments.value.filter(s => s.side === 'left');
  for (let i = leftSegs.length - 1; i >= 0; i--) {
    const seg = leftSegs[i];
    list.push({
      id: seg.id,
      name: getSegmentName(seg),
      travelTime: seg.travelTime,
      interval: seg.interval,
      intervalMax: seg.intervalMax,
      stops: seg.stops,
      isBranch: false,
      rawSeg: seg
    });
  }
  
  // Branch segments
  branches.value.forEach((br, bIdx) => {
    const brName = br.name || `Альтернатива ${bIdx + 1}`;
    const brNodes = br.nodes || [];
    const sectionCount = Math.max(brNodes.length + 1, 1);
    
    for (let si = 0; si < sectionCount; si++) {
      let secName = '';
      if (brNodes.length === 0) {
        secName = `${brName} → Кінець альтернативи`;
      } else if (si === 0) {
        secName = `${brName} → ${brNodes[0].name}`;
      } else if (si === brNodes.length) {
        secName = `${brNodes[si - 1].name} → Кінець альтернативи`;
      } else {
        secName = `${brNodes[si - 1].name} → ${brNodes[si].name}`;
      }
      
      const secObj = br.sections[si];
      if (!secObj) continue;

      list.push({
        id: secObj.id,
        name: secName,
        travelTime: secObj.travelTime || 5,
        interval: secObj.interval || '15',
        intervalMax: secObj.intervalMax || '20',
        stops: secObj.stops || [],
        isBranch: true,
        branchId: br.id,
        sectionIdx: si,
        rawSeg: null
      });
    }
  });
  
  return list;
});

/* ─────────── Canvas ref (for zoom controls in toolbar) ─────────── */
const canvasRef = ref(null);
</script>

<template>
  <div class="fixed inset-0 z-50 flex overflow-hidden bg-[#edf0f7]"
       style="font-family:'Inter',sans-serif;">

    <!-- ════════════════════════════════════════
         CANVAS AREA
    ════════════════════════════════════════ -->
    <div class="flex-1 relative overflow-hidden">

      <!-- Canvas (kept visible, blurred smoothly during 180° rotation) -->
      <RouteCanvas
        ref="canvasRef"
        class="transition-all duration-300 ease-in-out"
        :class="isRotatingAnim ? 'no-structural-anim blur-[6px] scale-[0.99]' : 'blur-0 scale-100'"
        :route-data="routeData"
        :is-branch-mode="isBranchMode"
        :editable="isEditable"
        @edit-segment="seg  => editSeg  = seg"
        @edit-node="   node => editNode = node"
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
      />

      <!-- 180° Rotation Blur Overlay & Single-Turn Indicator -->
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
           DEVELOPER GRAPH INSPECTOR PANEL
      ════════════════════════════════════════ -->
      <Teleport to="body">
        <!-- Floating Toggle Button -->
        <button @click="showGraphInspector = !showGraphInspector"
                class="fixed bottom-5 left-6 z-[160] flex items-center gap-2 px-3.5 py-2 bg-gray-900/90 hover:bg-gray-900 text-white rounded-full shadow-xl border border-gray-700/60 backdrop-blur-md transition-all hover:scale-105 active:scale-95 text-xs font-mono cursor-pointer select-none">
          <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span class="font-bold">🔗 Graph Inspector</span>
          <span class="bg-gray-800 text-emerald-400 font-bold text-[10px] px-2 py-0.5 rounded-full border border-gray-700 font-sans">{{ developerLinkedList.length }} елементів</span>
        </button>

        <!-- Inspector Drawer / Panel -->
        <div v-if="showGraphInspector"
             class="fixed top-4 left-4 bottom-16 z-[160] w-[460px] bg-gray-950/95 text-gray-100 rounded-2xl shadow-2xl border border-gray-800 backdrop-blur-xl flex flex-col overflow-hidden font-mono select-none">
          
          <!-- Header -->
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
                    <div v-for="(sec, secIdx) in item.branchInfo.sections" :key="'br-sec-' + sec.id" class="pl-2 border-l border-purple-700 space-y-1 text-[10px]">
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

      <!-- ── Top-left Menu (Figma Style) ── -->
      <div class="absolute top-5 left-6 z-50 flex flex-col gap-3 pointer-events-auto select-none">
        
        <div class="flex items-start gap-3">
          <!-- Large Route Number on Blueprint Background -->
          <div class="w-16 h-16 border-2 flex items-center justify-center relative overflow-hidden bg-white"
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

          <!-- Action Buttons Grid -->
          <div class="grid grid-cols-3 gap-2">
            <!-- Undo (Ctrl+Z) -->
            <button @click="undo" :disabled="!canUndo"
                    class="w-8 h-8 rounded-full border shadow-sm flex items-center justify-center transition-all cursor-pointer"
                    :class="canUndo ? 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50' : 'bg-gray-100 text-gray-300 border-gray-200 cursor-not-allowed'"
                    title="Скасувати дію (Ctrl+Z)">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
            </button>
            <!-- Redo (Ctrl+Y / Ctrl+Shift+Z) -->
            <button @click="redo" :disabled="!canRedo"
                    class="w-8 h-8 rounded-full border shadow-sm flex items-center justify-center transition-all cursor-pointer"
                    :class="canRedo ? 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50' : 'bg-gray-100 text-gray-300 border-gray-200 cursor-not-allowed'"
                    title="Повторити дію (Ctrl+Y / Ctrl+Shift+Z)">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M21 10h-10a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6" /></svg>
            </button>
            <!-- Rotate 180° -->
            <button @click="handleRotate180"
                    class="w-8 h-8 rounded-full border shadow-sm flex items-center justify-center transition-all cursor-pointer"
                    :class="isRotated180 ? 'text-white' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'"
                    :style="isRotated180 ? { backgroundColor: routeColor, borderColor: routeColor } : {}"
                    title="Перевернути схему на 180°">
              <svg class="w-4 h-4 transition-transform duration-300" :class="{ 'rotate-180': isRotated180 }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M7 16V4m0 0L3 8m4-4l4 4" />
                <path d="M17 8v12m0 0l4-4m-4 4l-4-4" />
              </svg>
            </button>
            <!-- Branch Toggle (Branch SVG Icon) -->
            <button @click="isBranchMode = !isBranchMode; if (isBranchMode) isEditable = true"
                    class="w-8 h-8 rounded-full border shadow-sm flex items-center justify-center transition-colors cursor-pointer"
                    :class="isBranchMode ? 'text-white' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'"
                    :style="isBranchMode ? { backgroundColor: routeColor, borderColor: routeColor } : {}"
                    title="Режим альтернатив">
              <SvgIcon name="branch" class="w-4 h-4" />
            </button>
            <!-- Toggle Edit Mode (Show/Hide Controls) -->
            <button @click="isEditable = !isEditable; if (!isEditable) isBranchMode = false"
                    class="w-8 h-8 rounded-full border shadow-sm flex items-center justify-center transition-colors cursor-pointer"
                    :class="!isEditable ? 'text-white' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'"
                    :style="!isEditable ? { backgroundColor: routeColor, borderColor: routeColor } : {}"
                    title="Приховати/Показати елементи додавання">
              <svg v-if="!isEditable" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                <line x1="1" y1="1" x2="23" y2="23"></line>
              </svg>
              <svg v-else class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            </button>
          </div>
        </div>

        <!-- Time Scrubber -->
        <div class="flex items-center justify-between bg-white border border-gray-200 rounded-full px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm w-max gap-4">
          <button @click="shiftTime(-15)" class="text-gray-400 hover:text-blue-600 transition-colors cursor-pointer">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" /></svg>
          </button>
          <span class="tabular-nums font-bold tracking-tight">{{ fmtTime(timeStart) }}-{{ fmtTime(timeEnd) }}</span>
          <button @click="shiftTime(15)"  class="text-gray-400 hover:text-blue-600 transition-colors cursor-pointer">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>

      <!-- ── Top-right button to toggle sidebar ── -->
      <button @click="isSidebarOpen = !isSidebarOpen"
              class="absolute top-5 right-5 z-50 bg-white border border-gray-200 shadow-md rounded-xl px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-all flex items-center gap-1.5 cursor-pointer pointer-events-auto">
        <svg class="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" :d="isSidebarOpen ? 'M13 5l7 7-7 7M5 5l7 7-7 7' : 'M11 19l-7-7 7-7M19 19l-7-7 7-7'" />
        </svg>
        <span>{{ isSidebarOpen ? 'Сховати меню' : 'Показати меню' }}</span>
      </button>

      <!-- ── Bottom-right Error & Validation Indicator ── -->
      <div class="absolute bottom-5 right-5 z-40 flex flex-col items-end gap-2 pointer-events-auto select-none">
        
        <!-- Expanded Error Details Popover -->
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
              </div>
              <button @click="isErrorDetailsOpen = false" class="text-gray-400 hover:text-gray-600 p-0.5 rounded cursor-pointer">✕</button>
            </div>

            <!-- List of issues -->
            <div v-if="validationIssues.totalCount > 0" class="overflow-y-auto max-h-72 flex flex-col gap-1.5 pr-1">
              
              <!-- Red Errors -->
              <div v-for="err in validationIssues.redErrors" :key="err.id"
                   class="p-2.5 rounded-xl border bg-red-50/60 border-red-200/70 flex items-start gap-2.5">
                <span class="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0 mt-0.5"></span>
                <div class="flex-1 min-w-0">
                  <div class="font-bold text-gray-800 leading-tight text-xs">{{ err.title }}</div>
                  <div class="text-[11px] text-gray-500 mt-0.5">{{ err.description }}</div>
                </div>
              </div>

              <!-- Yellow Warnings (Unassigned stops) -->
              <div v-for="warn in validationIssues.yellowWarnings" :key="warn.id"
                   class="p-2.5 rounded-xl border bg-amber-50/60 border-amber-200/70 flex items-start gap-2.5">
                <span class="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0 mt-0.5"></span>
                <div class="flex-1 min-w-0">
                  <div class="font-bold text-gray-800 leading-tight text-xs">{{ warn.title }}</div>
                  <div class="text-[11px] text-gray-500 mt-0.5">{{ warn.description }}</div>
                </div>
              </div>

            </div>

            <!-- All good state in details -->
            <div v-else class="py-4 px-2 text-center flex flex-col items-center gap-1.5 text-gray-500">
              <div class="w-7 h-7 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-xs">✓</div>
              <p class="font-bold text-gray-800 text-xs">Усі точки та зупинки призначено</p>
              <p class="text-[11px] text-gray-400">Маршрут має кінцеву та всі зупинки прив'язані до бази.</p>
            </div>

          </div>
        </transition>

        <!-- Indicator Button: slightly bigger, showing red dot with count and yellow dot with count -->
        <button @click="isErrorDetailsOpen = !isErrorDetailsOpen"
                class="flex items-center gap-3 px-3.5 py-2 rounded-2xl shadow-lg border border-gray-200/90 backdrop-blur-md transition-all hover:scale-105 active:scale-95 cursor-pointer bg-white/95 hover:bg-white text-gray-800">
          
          <!-- Red error indicator (if red errors > 0) -->
          <div v-if="validationIssues.redErrors.length > 0" class="flex items-center gap-1.5">
            <span class="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0"></span>
            <span class="text-xs font-bold text-red-600 font-mono leading-none">{{ validationIssues.redErrors.length }}</span>
          </div>

          <!-- Divider if both red and yellow exist -->
          <span v-if="validationIssues.redErrors.length > 0 && validationIssues.yellowWarnings.length > 0" class="w-px h-3.5 bg-gray-200"></span>

          <!-- Yellow stop warning indicator (if yellow warnings > 0) -->
          <div v-if="validationIssues.yellowWarnings.length > 0" class="flex items-center gap-1.5">
            <span class="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0"></span>
            <span class="text-xs font-bold text-amber-600 font-mono leading-none">{{ validationIssues.yellowWarnings.length }}</span>
          </div>

          <!-- All clean state (0 errors and 0 warnings) -->
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
              <!-- Option 1: Current segment -->
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

              <!-- Option 2: Control node -->
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

              <!-- Option 3: Bottom turnaround arc OR parent branch end -->
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
        <div v-if="editNode"
             class="fixed inset-0 z-[200] flex items-center justify-center bg-black/20 backdrop-blur-[2px]"
             @click.self="editNode = null">
          <div class="bg-white rounded-2xl shadow-2xl p-6 w-72 border border-gray-100">
            <h3 class="text-base font-bold text-gray-900 mb-4">Контрольна точка</h3>
            
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
              class="w-full py-2.5 rounded-xl font-bold text-white text-sm shadow-sm hover:opacity-90 transition-opacity"
              :style="{ backgroundColor: routeColor }">Готово</button>
          </div>
        </div>
      </Teleport>

    </div>

    <!-- ════════════════════════════════════════
         RIGHT PANEL
    ════════════════════════════════════════ -->
    <div v-show="isSidebarOpen"
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
          <h1 class="text-2xl font-bold italic text-gray-900">Тролейбусний маршрут</h1>

          <!-- Route ID -->
          <div class="border border-gray-200 rounded-2xl p-4">
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
                <label class="block relative h-10 rounded-xl overflow-hidden border border-gray-200 cursor-pointer shadow-sm">
                  <div class="absolute inset-0 rounded-xl" :style="{ backgroundColor: routeColor }"></div>
                  <input type="color" v-model="routeColor" class="absolute inset-0 opacity-0 w-full h-full cursor-pointer"/>
                </label>
              </div>
            </div>
          </div>

          <!-- Work modes -->
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
                 class="border border-gray-200 rounded-2xl p-3 flex flex-col gap-2">
              <h3 class="text-sm font-bold text-gray-900 text-center mb-1 flex justify-center items-center gap-2">
                {{ node.name }}
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

          <!-- Time range -->
          <div class="border border-gray-200 rounded-2xl p-4">
            <p class="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2.5">Часовий діапазон</p>
            <div class="flex items-center gap-2 mb-2">
              <div class="flex-1">
                <label class="text-[10px] text-gray-400 mb-0.5 block">Від</label>
                <input type="time" :value="fmtTime(timeStart)"
                  @change="e => { const [h,m]=e.target.value.split(':'); timeStart = +h*60 + +m; }"
                  class="w-full border border-gray-200 rounded-xl px-2 py-1.5 text-sm font-bold text-gray-800 bg-gray-50 focus:outline-none focus:border-blue-400"/>
              </div>
              <span class="text-gray-300 mt-4">—</span>
              <div class="flex-1">
                <label class="text-[10px] text-gray-400 mb-0.5 block">До</label>
                <input type="time" :value="fmtTime(timeEnd)"
                  @change="e => { const [h,m]=e.target.value.split(':'); timeEnd = +h*60 + +m; }"
                  class="w-full border border-gray-200 rounded-xl px-2 py-1.5 text-sm font-bold text-gray-800 bg-gray-50 focus:outline-none focus:border-blue-400"/>
              </div>
            </div>
            <div class="flex gap-1 flex-wrap">
              <button v-for="d in [-60,-15,15,60]" :key="d"
                @click="shiftTime(d)"
                class="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-gray-200 text-gray-500 hover:bg-gray-100 transition-colors">
                {{ d > 0 ? '+' : '' }}{{ d }}хв
              </button>
            </div>
          </div>

          <!-- Segments -->
          <div class="border border-gray-200 rounded-2xl p-4">
            <p class="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Ділянки маршруту</p>
            <div v-for="segItem in allSegmentsList" :key="'ps-' + segItem.id"
                 class="mb-2.5 pb-2.5 border-b border-gray-100 last:border-0 last:mb-0 last:pb-0">
              <div class="flex items-center justify-between mb-1.5">
                <span class="text-xs font-bold truncate mr-2 flex items-center gap-1.5"
                      :class="segItem.isBranch ? 'text-purple-700' : 'text-gray-700'">
                  <span v-if="segItem.isConnecting" class="px-1.5 py-0.5 text-[8px] font-bold uppercase rounded bg-indigo-100 text-indigo-700 shrink-0">З'єднувальна ділянка</span>
                  <span v-else-if="segItem.isBranch" class="px-1.5 py-0.5 text-[8px] font-bold uppercase rounded bg-purple-100 text-purple-700 shrink-0">Гілка</span>
                  {{ segItem.name }}
                </span>
                <button @click="router.push({ query: { ...route.query, segmentId: segItem.id } })"
                  class="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-blue-200 text-blue-500 hover:bg-blue-50 transition-colors">
                  Налаштувати
                </button>
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
                 class="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0 text-sm">
              <span class="font-semibold text-gray-700">{{ br.name }}</span>
              <button @click="branches.splice(bIdx, 1)"
                class="text-red-300 hover:text-red-500 transition-colors text-xs">✕</button>
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
            class="flex-1 py-3 rounded-xl font-bold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 transition-colors text-sm">
            Скасувати
          </button>
          <button class="flex-1 py-3 rounded-xl font-bold text-white hover:opacity-90 transition-opacity text-sm shadow-md"
            :style="{ backgroundColor: routeColor }">
            Зберегти маршрут
          </button>
        </div>
      </template>

      <!-- SEGMENT EDITOR PANEL -->
      <template v-else>
        <div class="p-6 flex-1 flex flex-col gap-5 bg-gray-50">
          
          <button @click="closeSegmentEditor"
            class="self-start text-xs font-bold text-gray-500 hover:text-gray-900 flex items-center gap-1 transition-colors">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
            Назад до маршруту
          </button>

          <h2 class="text-xl font-bold text-gray-900">{{ getSegmentName(activeSegment) }}</h2>

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
               <div v-for="node in activeSegmentNodes" :key="'cn-' + node.id" class="mt-2 flex items-center gap-1">
                 <span class="text-xs font-medium w-1/3 truncate" :title="node.name">{{ node.name }}</span>
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
                <div class="mb-2 p-3 bg-gray-50 border border-gray-100 rounded-xl group relative">
                
                <div class="flex items-center justify-between mb-2">
                  <div class="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                    <span class="w-4 h-4 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[9px]">{{ sIdx + 1 }}</span>
                    {{ stop.name }}
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
