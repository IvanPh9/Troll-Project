<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useStopsStore } from '@/stores/stops';
import RouteCanvas from './components/RouteCanvas.vue';
import StopSelector from './components/StopSelector.vue';
import SvgIcon from '@/components/ui/SvgIcon.vue';

const router = useRouter();
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
const nodes = ref([
  { id: 1, type: 'control', isTerminus: true, name: 'Кінцева 1', terminusStop: 'Центральна площа', waitMin: 5, waitMax: 9 },
  { id: 2, type: 'control', name: 'Контрольна 1', side: 'right' },
  { id: 3, type: 'control', name: 'Контрольна 2', side: 'right' },
  { id: 4, type: 'control', name: 'Контрольна 1 (Зворотня)', side: 'left' },
  { id: 5, type: 'control', name: 'Контрольна 2 (Зворотня)', side: 'left' },
  { id: 6, type: 'control', isTerminus: true, name: 'Кінцева 2', terminusStop: 'Вокзал', waitMin: 5, waitMax: 9 },
]);

const segments = ref([
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
]);

const branches = ref([]);

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

/* ─────────── Branch Mode ─────────── */
const isBranchMode = ref(false);
const isEditable = ref(true);

/* ─────────── routeData object for canvas ─────────── */
const routeData = computed(() => ({
  routeNumber: routeNumber.value,
  nodes: nodes.value.map(n => ({
    ...n,
    isDepot: getStopType(n.realId) === 'depo'
  })),
  segments: segments.value,
  branches: branches.value,
  color: routeColor.value
}));

// Control nodes for segment settings (allows assigning DB stop)
const controlNodes = computed(() => nodes.value.filter(n => n.type === 'control'));

// Control nodes forming the currently edited segment
const activeSegmentNodes = computed(() => {
  if (!activeSegment.value) return [];
  const seg = activeSegment.value;
  if (seg.isBranch) {
    return [seg.startNode, seg.endNode].filter(Boolean);
  }
  const side = seg.side || 'right';
  const sideNodes = nodes.value.filter(n => n.type === 'end' || n.side === side || !n.side);
  const sideSegs = segments.value.filter(s => s.side === side || !s.side);
  const idx = sideSegs.findIndex(s => s.id === seg.id);
  if (idx === -1 || !sideNodes[idx] || !sideNodes[idx+1]) return [];
  if (side === 'left') {
    return [sideNodes[idx+1], sideNodes[idx]];
  }
  return [sideNodes[idx], sideNodes[idx+1]];
});

/* ─────────── Mutations ─────────── */
function addStop(sIdx, side, insertIdx = -1) {
  const newStop = { id: Date.now(), name: 'Нова зупинка', side };
  if (insertIdx !== -1 && insertIdx !== undefined) {
    segments.value[sIdx].stops.splice(insertIdx, 0, newStop);
  } else {
    segments.value[sIdx].stops.push(newStop);
  }
}
function removeStop(sIdx, stIdx) {
  segments.value[sIdx].stops.splice(stIdx, 1);
}

function addControlNode(side = 'right', explicitSegIdx = -1, posMode = 'before') {
  const newId = Date.now();
  const ctrlCount = nodes.value.filter(n => n.type === 'control').length;

  let targetSegIdx = explicitSegIdx;

  if (posMode === 'after' && targetSegIdx !== -1) {
    let nextSegIdx = -1;
    for (let i = targetSegIdx + 1; i < segments.value.length; i++) {
      if (segments.value[i].side === side || !segments.value[i].side) {
        nextSegIdx = i;
        break;
      }
    }
    if (nextSegIdx !== -1) {
      targetSegIdx = nextSegIdx;
    } else {
      targetSegIdx = -1;
    }
  }
  
  if (targetSegIdx === -1) {
    if (side === 'left') {
      for (let i = 0; i < segments.value.length; i++) {
        if (segments.value[i].side === side || !segments.value[i].side) {
          targetSegIdx = i;
          break;
        }
      }
    } else {
      for (let i = segments.value.length - 1; i >= 0; i--) {
        if (segments.value[i].side === side || !segments.value[i].side) {
          targetSegIdx = i;
          break;
        }
      }
    }
  }

  let segsOfSideBefore = 0;
  for (let i = 0; i < targetSegIdx; i++) {
    if (segments.value[i].side === side || !segments.value[i].side) {
      segsOfSideBefore++;
    }
  }

  let nodesOfSideSeen = 0;
  let insertNodeIdx = nodes.value.length - 1;
  for (let i = 0; i < nodes.value.length; i++) {
    const n = nodes.value[i];
    if (n.side === side || n.isTerminus) {
      nodesOfSideSeen++;
      if (nodesOfSideSeen === segsOfSideBefore + 1) {
        insertNodeIdx = i + 1;
        break;
      }
    }
  }

  nodes.value.splice(insertNodeIdx, 0, {
    id: newId, type: 'control',
    name: 'Контрольна ' + (ctrlCount + 1),
    side: side
  });

  if (targetSegIdx !== -1) {
    const old = segments.value[targetSegIdx];
    const half = Math.floor(old.travelTime / 2);
    const oldSide = old.side || side;
    
    if (side === 'left') {
      segments.value.splice(targetSegIdx, 1,
        { id: newId + 1, travelTime: half,                  interval: old.interval, intervalMax: old.intervalMax, stops: [], side: oldSide },
        { id: newId + 2, travelTime: old.travelTime - half, interval: old.interval, intervalMax: old.intervalMax, stops: [...old.stops], side: oldSide }
      );
    } else {
      const firstStops = posMode === 'after' ? [] : [...old.stops];
      const secondStops = posMode === 'after' ? [...old.stops] : [];
      segments.value.splice(targetSegIdx, 1,
        { id: newId + 1, travelTime: half,                  interval: old.interval, intervalMax: old.intervalMax, stops: firstStops, side: oldSide },
        { id: newId + 2, travelTime: old.travelTime - half, interval: old.interval, intervalMax: old.intervalMax, stops: secondStops, side: oldSide }
      );
    }

    // Update branches
    if (branches.value) {
      branches.value.forEach(br => {
        if (br.segIdx > targetSegIdx) {
          br.segIdx++;
        } else if (br.segIdx === targetSegIdx) {
          // If on left rail, the "old" control node (start of travel) is at the bottom, which corresponds to the second new segment (index + 1)
          if (side === 'left') {
            br.segIdx++;
          }
          // On right rail, the "old" control node is at the top, which corresponds to the first new segment (index remains the same)
        }
      });
    }
  }

  setTimeout(() => {
    if (canvasRef.value) canvasRef.value.focusNode(newId);
  }, 80);
}

function removeNode(idx) {
  if (nodes.value[idx].type === 'end') return;
  const nodeSide = nodes.value[idx].side || 'right';
  nodes.value.splice(idx, 1);
  
  // Find segments of this side to merge
  let segIdx1 = -1, segIdx2 = -1;
  for (let i = 0; i < segments.value.length; i++) {
    if (segments.value[i].side === nodeSide || !segments.value[i].side) {
      if (segIdx1 === -1) segIdx1 = i;
      else { segIdx2 = i; break; }
    }
  }
  
  if (segIdx1 !== -1 && segIdx2 !== -1) {
    const L = segments.value[segIdx1];
    const R = segments.value[segIdx2];
    segments.value.splice(segIdx1, 2, {
      id: Date.now(),
      travelTime: L.travelTime + R.travelTime,
      interval: L.interval, intervalMax: L.intervalMax,
      stops: [...L.stops, ...R.stops],
      side: nodeSide
    });

    // Update branches
    if (branches.value) {
      branches.value.forEach(br => {
        if (br.segIdx === segIdx2) {
          br.segIdx = segIdx1;
        } else if (br.segIdx > segIdx2) {
          br.segIdx--;
        }
      });
    }
  }
}

function addBranch(sIdx, parentBranchId = null, parentNodeId = null) {
  let segIdx = sIdx;
  if (parentBranchId) {
    const parentBr = branches.value.find(b => b.id === parentBranchId);
    if (parentBr) segIdx = parentBr.segIdx;
  }
  branches.value.push({
    id: Date.now(),
    segIdx: segIdx ?? 0,
    parentBranchId: parentBranchId,
    parentNodeId: parentNodeId || 'endpoint',
    name: parentBranchId 
      ? 'Підрозгалудження ' + (branches.value.length + 1)
      : 'Розгалудження ' + (branches.value.length + 1),
    finished: false,
    nodes: []
  });
}

const activeBranchToConfig = ref(null);

function configBranch(br) {
  activeBranchToConfig.value = br;
}

function configNormalMerge() {
  if (activeBranchToConfig.value) {
    activeBranchToConfig.value.targetType = 'current';
    activeBranchToConfig.value.targetNodeId = null;
    activeBranchToConfig.value.mergeConfigured = 'solid';
  }
  activeBranchToConfig.value = null;
}

function configAddMainLoopSegment() {
  if (activeBranchToConfig.value) {
    activeBranchToConfig.value.targetType = 'current';
    activeBranchToConfig.value.targetNodeId = null;
    activeBranchToConfig.value.mergeConfigured = 'add_inside';
    activeBranchToConfig.value.finished = true;
  }
  activeBranchToConfig.value = null;
}

function configMakeControlNode() {
  if (activeBranchToConfig.value) {
    finishBranch(activeBranchToConfig.value.id);
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
    // Control nodes AND terminus nodes of the same rail side
    const brSegIdx = currentFinishingBranch.value?.segIdx ?? 0;
    const seg = segments.value[brSegIdx] || segments.value[0];
    const side = seg?.side || 'right';
    // Include all nodes of this side (control + terminus), but not top/bottom end nodes without a side
    return nodes.value.filter(n => n.side === side || n.isTerminus);
  }
});

function finishBranch(brId) {
  finishBranchTarget.value = brId;
  selectedFinishType.value = 'current';
  selectedFinishNodeId.value = null;
}

function confirmFinishBranch() {
  if (!finishBranchTarget.value) return;
  const br = branches.value.find(b => b.id === finishBranchTarget.value);
  if (br) {
    br.targetType = selectedFinishType.value;
    br.targetNodeId = selectedFinishNodeId.value;
    br.finished = true;
  }
  finishBranchTarget.value = null;
}

function addBranchNode(brId) {
  const br = branches.value.find(b => b.id === brId);
  if (br) {
    if (!br.nodes) br.nodes = [];
    br.nodes.push({
      id: 'br_node_' + Date.now(),
      name: 'Контрольна ' + (br.nodes.length + 1)
    });
    if (!br.sections) br.sections = [{ stops: [] }];
    while (br.sections.length <= br.nodes.length) {
      br.sections.push({ stops: [] });
    }
  }
}

function extendBranchWithStop(brId) {
  const br = branches.value.find(b => b.id === brId);
  if (br) {
    if (!br.nodes) br.nodes = [];
    if (!br.sections) br.sections = [{ stops: [] }];
    
    br.nodes.push({
      id: 'br_node_' + Date.now(),
      name: 'Контрольна ' + (br.nodes.length + 1)
    });
    
    br.sections.push({ stops: [] });
    
    const lastSec = br.sections[br.sections.length - 1];
    lastSec.stops.push({
      id: 'br_stop_' + Date.now(),
      name: 'Зупинка ' + (lastSec.stops.length + 1)
    });
  }
}

function addBranchStop(brId, sectionIdx = 0) {
  const br = branches.value.find(b => b.id === brId);
  if (br) {
    if (!br.sections) br.sections = [{ stops: [] }];
    while (br.sections.length <= sectionIdx) {
      br.sections.push({ stops: [] });
    }
    br.sections[sectionIdx].stops.push({
      id: 'br_stop_' + Date.now(),
      name: 'Зупинка ' + (br.sections[sectionIdx].stops.length + 1)
    });
  }
}

function editBranchStop(brId, sectionIdx, stopIdx) {
  const br = branches.value.find(b => b.id === brId);
  if (br && br.sections && br.sections[sectionIdx] && br.sections[sectionIdx].stops[stopIdx]) {
    const currentStop = br.sections[sectionIdx].stops[stopIdx];
    const newName = prompt('Назва зупинки на розгалудженні (залиште порожнім для видалення):', currentStop.name);
    if (newName !== null) {
      if (newName.trim() === '') {
        br.sections[sectionIdx].stops.splice(stopIdx, 1);
      } else {
        currentStop.name = newName.trim();
      }
    }
  }
}

function editBranchNode(brId, bNIdx) {
  const br = branches.value.find(b => b.id === brId);
  if (br && br.nodes && br.nodes[bNIdx]) {
    const currentNode = br.nodes[bNIdx];
    const newName = prompt('Назва контрольної точки на розгалудженні (залиште порожнім для видалення):', currentNode.name);
    if (newName !== null) {
      if (newName.trim() === '') {
        removeBranchNode(brId, bNIdx);
      } else {
        currentNode.name = newName.trim();
      }
    }
  }
}

function removeBranchNode(brId, bNIdx) {
  const br = branches.value.find(b => b.id === brId);
  if (br && br.nodes && br.nodes[bNIdx]) {
    br.nodes.splice(bNIdx, 1);
    if (br.sections && br.sections[bNIdx + 1]) {
      const movedStops = br.sections[bNIdx + 1].stops || [];
      if (br.sections[bNIdx]) {
        br.sections[bNIdx].stops.push(...movedStops);
      }
      br.sections.splice(bNIdx + 1, 1);
    }
  }
}
/* ─────────── Edit overlays ─────────── */
/* ─────────── Edit overlays ─────────── */
const editSeg  = ref(null);
const editNode = ref(null);

/* ─────────── Totals ─────────── */
const totalStops = computed(() => segments.value.reduce((a, s) => a + s.stops.length, 0));
const firstTerminus = computed(() => {
  const top = nodes.value.find(n => !n.side);
  if (top && top.isTerminus) return top;
  
  const right = nodes.value.find(n => n.side === 'right' && n.isTerminus);
  if (right) return right;
  
  const bot = nodes.value.filter(n => !n.side)[1];
  if (bot && bot.isTerminus) return bot;
  
  const lefts = nodes.value.filter(n => n.side === 'left');
  for (let i = lefts.length - 1; i >= 0; i--) {
    if (lefts[i].isTerminus) return lefts[i];
  }
  
  return endNodes.value[0];
});

const totalTime  = computed(() => {
  const travel = segments.value.reduce((a, s) => a + Number(s.travelTime || 0), 0);
  let wait = endNodes.value.reduce((a, n) => a + Number(n.waitMin || 0), 0);
  if (firstTerminus.value) {
    wait -= Number(firstTerminus.value.waitMin || 0);
  }
  return travel + wait;
});
const endNodes   = computed(() => nodes.value.filter(n => n.isTerminus));
const topNode    = computed(() => nodes.value.find(n => !n.side) || endNodes.value[0]);
const bottomNode = computed(() => nodes.value.filter(n => !n.side)[1] || nodes.value.find(n => !n.side) || endNodes.value[1]);

const getSegmentName = (seg) => {
  if (seg.isBranch && seg.startNode && seg.endNode) {
    return `${seg.startNode.name} → ${seg.endNode.name}`;
  }
  const side = seg.side || 'right';
  const sideNodes = nodes.value.filter(n => n.type === 'end' || n.side === side || !n.side);
  const sideSegs = segments.value.filter(s => s.side === side || !s.side);
  const idx = sideSegs.findIndex(s => s.id === seg.id);
  if (idx === -1 || !sideNodes[idx] || !sideNodes[idx+1]) return 'Ділянка';
  if (side === 'left') {
    return `${sideNodes[idx+1].name} → ${sideNodes[idx].name}`;
  }
  return `${sideNodes[idx].name} → ${sideNodes[idx+1].name}`;
};

/* ─────────── Sidebar Segment Editor ─────────── */
const activeSegmentId = computed(() => route.query.segmentId);
const activeSegment = computed(() => {
  if (!activeSegmentId.value) return null;
  const rawId = activeSegmentId.value;
  if (String(rawId).startsWith('br_sec_')) {
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
                const s = mainSeg.side || 'right';
                const sNodes = nodes.value.filter(n => n.type === 'end' || n.side === s || !n.side);
                const sSegs = segments.value.filter(sg => sg.side === s || !sg.side);
                const i = sSegs.findIndex(sg => sg.id === mainSeg.id);
                if (i !== -1 && sNodes[i] && sNodes[i+1]) {
                   realStartNode = s === 'left' ? sNodes[i+1] : sNodes[i];
                }
              }
            } else {
              if (!br.nodes) br.nodes = [];
              if (br.nodes[secIdx - 1]) realStartNode = br.nodes[secIdx - 1];
              else {
                br.nodes[secIdx - 1] = { id: 'br_node_' + br.id + '_' + (secIdx - 1), name: 'Контрольна', type: 'control' };
                realStartNode = br.nodes[secIdx - 1];
              }
            }
            sec.startNode = realStartNode || { id: 'br_sn_' + sec.id, name: "З'єднання", realId: null };

            // Resolve real end node
            let realEndNode = null;
            const brNodesLen = br.nodes ? br.nodes.length : 0;
            if (secIdx < brNodesLen) {
               realEndNode = br.nodes[secIdx];
            } else {
               if (br.finished) {
                 if (!br.targetType || br.targetType === 'current') {
                    const mainSeg = segments.value[br.segIdx];
                    if (mainSeg) {
                      const s = mainSeg.side || 'right';
                      const sNodes = nodes.value.filter(n => n.type === 'end' || n.side === s || !n.side);
                      const sSegs = segments.value.filter(sg => sg.side === s || !sg.side);
                      const i = sSegs.findIndex(sg => sg.id === mainSeg.id);
                      if (i !== -1 && sNodes[i] && sNodes[i+1]) {
                         realEndNode = s === 'left' ? sNodes[i] : sNodes[i+1];
                      }
                    }
                 }
                 if (!realEndNode) {
                   if (!br.mergeNode) br.mergeNode = { id: 'br_merge_' + br.id, name: "Злиття", realId: null };
                   realEndNode = br.mergeNode;
                 }
               } else {
                 if (!br.terminusNode) br.terminusNode = { id: 'br_term_' + br.id, name: 'Кінцева розгалудження', isTerminus: true, realId: null };
                 realEndNode = br.terminusNode;
               }
            }
            sec.endNode = realEndNode || { id: 'br_en_' + sec.id, name: "Кінець гілки", realId: null };
            
            sec.isBranch = true;
            sec.br = br;

            Object.defineProperty(sec, 'unifiedStops', {
              get() {
                const branchStops = sec.stops || [];
                const mainSeg = segments.value[br.segIdx];
                const secIdx = br.sections.indexOf(sec);
                const isLastSection = secIdx === br.sections.length - 1;
                
                if (br.finished && (!br.targetType || br.targetType === 'current') && mainSeg && isLastSection) {
                   const mainStops = mainSeg.stops || [];
                   return [...branchStops, ...mainStops];
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

function assignRealStop(stopInSeg, realStopIdStr) {
  const realStopId = parseInt(realStopIdStr);
  const realStop = availableStops.value.find(s => s.id === realStopId);
  if (realStop) {
    stopInSeg.realId = realStop.id;
    stopInSeg.name = realStop.name;
  }
}

function getStopDirection(realId) {
  if (!realId) return '';
  const realStop = availableStops.value.find(s => s.id === realId);
  return realStop ? realStop.direction : '';
}

function createNewStopForSeg(stopInSeg, newName) {
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
  stopInSeg.realId = newStopId;
  stopInSeg.name = newName;
}

function getStopType(realId) {
  if (!realId) return 'normal';
  const realStop = availableStops.value.find(s => s.id === realId);
  return realStop ? realStop.type : 'normal';
}

function assignRealStopToNode(node, realStopIdStr) {
  if (!realStopIdStr) {
    node.realId = null;
    node.terminusStop = '';
    node.name = node.isTerminus ? `Кінцева ${node.id}` : `Контрольна ${node.id}`;
    return;
  }
  const realStopId = parseInt(realStopIdStr);
  const realStop = availableStops.value.find(s => s.id === realStopId);
  if (realStop) {
    node.realId = realStop.id;
    node.terminusStop = realStop.name;
    node.name = realStop.name;
  }
}

function createNewStopForNode(node, newName) {
  const newStopId = Date.now();
  stopsStore.addStop({
    stopId: newStopId,
    name: newName,
    directionComment: 'Кінцева',
    type: 'end',
    directionCode: 1,
    latitude: 0,
    longitude: 0,
    platformsCount: 1
  });
  node.realId = newStopId;
  node.terminusStop = newName;
  node.name = newName;
}

function makeTerminus(nodeId) {
  if (!nodeId) return;
  const n = nodes.value.find(x => String(x.id) === String(nodeId));
  if (n) {
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
  node.isTerminus = false;
  node.realId = null;
  node.terminusStop = '';
  node.name = `Контрольна ${node.id}`;
}

function removeStopFromSeg(seg, stopOrIdx) {
  if (typeof stopOrIdx === 'number') {
    seg.stops.splice(stopOrIdx, 1);
    return;
  }
  const stop = stopOrIdx;
  let idx = seg.stops.findIndex(s => s.id === stop.id);
  if (idx !== -1) {
    seg.stops.splice(idx, 1);
    return;
  }
  if (seg.isBranch && seg.br && (!seg.br.targetType || seg.br.targetType === 'current')) {
    const mainSeg = segments.value[seg.br.segIdx];
    if (mainSeg && mainSeg.stops) {
      idx = mainSeg.stops.findIndex(s => s.id === stop.id);
      if (idx !== -1) {
        mainSeg.stops.splice(idx, 1);
      }
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
  segments.value.filter(s => s.side === 'right' || !s.side).forEach(seg => {
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
    const brName = br.name || `Розгалудження ${bIdx + 1}`;
    const brNodes = br.nodes || [];
    const sectionCount = Math.max(brNodes.length + 1, 1);
    
    for (let si = 0; si < sectionCount; si++) {
      let secName = '';
      if (brNodes.length === 0) {
        secName = `${brName} → Кінець розгалудження`;
      } else if (si === 0) {
        secName = `${brName} → ${brNodes[0].name}`;
      } else if (si === brNodes.length) {
        secName = `${brNodes[si - 1].name} → Кінець розгалудження`;
      } else {
        secName = `${brNodes[si - 1].name} → ${brNodes[si].name}`;
      }
      
      const secStops = (br.sections && br.sections[si] && br.sections[si].stops) ? br.sections[si].stops : [];
      
      if (!br.sections) br.sections = [];
      if (!br.sections[si]) {
        br.sections[si] = { id: 'br_sec_' + br.id + '_' + si, stops: [], travelTime: 5, interval: '20', intervalMax: '25' };
      }
      const secObj = br.sections[si];
      if (!secObj.id) secObj.id = 'br_sec_' + br.id + '_' + si;

      list.push({
        id: secObj.id,
        name: secName,
        travelTime: 5,
        interval: '15',
        intervalMax: '20',
        stops: secStops,
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

      <!-- Canvas -->
      <RouteCanvas
        ref="canvasRef"
        :route-data="routeData"
        :is-branch-mode="isBranchMode"
        :editable="isEditable"
        @edit-segment="seg  => editSeg  = seg"
        @edit-node="   node => editNode = node"
        @add-stop="    (sIdx, side, insertIdx) => addStop(sIdx, side, insertIdx)"
        @remove-stop=" (sIdx, stIdx) => removeStop(sIdx, stIdx)"
        @remove-node=" idx => removeNode(idx)"
        @add-branch="(sIdx) => addBranch(sIdx)"
        @add-sub-branch="(pId, pNodeId) => addBranch(null, pId, pNodeId)"
        @finish-branch="(brId) => finishBranch(brId)"
        @config-branch="(br) => configBranch(br)"
        @add-node="(side, segIdx, pos) => addControlNode(side, segIdx, pos)"
        @add-branch-node="addBranchNode"
        @add-branch-stop="(brId, si) => addBranchStop(brId, si)"
        @extend-branch-with-stop="extendBranchWithStop"
        @edit-branch-stop="editBranchStop"
        @edit-branch-node="editBranchNode"
        @toggle-branch-mode="isBranchMode = !isBranchMode"
      />

      <!-- Branch Config Modal -->
      <Teleport to="body">
        <div v-if="activeBranchToConfig" class="fixed inset-0 z-[150] flex items-center justify-center bg-gray-900/40 backdrop-blur-sm" @click="activeBranchToConfig = null">
          <div class="bg-white rounded-2xl shadow-xl w-80 p-5" @click.stop>
            <h3 class="text-lg font-bold text-gray-900 mb-4 text-center">Налаштування з'єднання</h3>
            <div class="flex flex-col gap-2">
              <button @click="configAddMainLoopSegment" class="text-left px-4 py-3 rounded-xl hover:bg-gray-100 text-sm font-semibold text-gray-700 transition leading-tight">Додати ділянку/зупинки на основному колі</button>
              <button @click="configNormalMerge" class="text-left px-4 py-3 rounded-xl hover:bg-gray-100 text-sm font-semibold text-gray-700 transition leading-tight">Приєднати без зупинок (стандартне злиття)</button>
              <button @click="configMakeControlNode" class="text-left px-4 py-3 rounded-xl hover:bg-blue-50 hover:text-blue-700 text-sm font-semibold text-blue-600 transition border-2 border-transparent hover:border-blue-200 leading-tight">Зробити точку з'єднання контрольною</button>
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

          <!-- 4 Buttons in 2 Rows -->
          <div class="grid grid-cols-2 gap-2">
            <!-- Cloud / Save -->
            <button class="w-8 h-8 rounded-full border border-gray-300 bg-white shadow-sm flex items-center justify-center text-gray-700 hover:bg-gray-50 cursor-pointer">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /></svg>
            </button>
            <!-- Undo -->
            <button class="w-8 h-8 rounded-full border border-gray-300 bg-white shadow-sm flex items-center justify-center text-gray-700 hover:bg-gray-50 cursor-pointer">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
            </button>
            <!-- Branch Toggle (Branch SVG Icon) -->
            <button @click="isBranchMode = !isBranchMode; if (isBranchMode) isEditable = true"
                    class="w-8 h-8 rounded-full border shadow-sm flex items-center justify-center transition-colors cursor-pointer"
                    :class="isBranchMode ? 'text-white' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'"
                    :style="isBranchMode ? { backgroundColor: routeColor, borderColor: routeColor } : {}"
                    title="Режим розгалудження">
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
                {{ isFinishingSubBranch ? 'Завершення підрозгалудження' : 'Завершення розгалудження' }}
              </h3>
              <p class="text-xs text-gray-500 mt-1">Оберіть точку, в яку має входити колія:</p>
            </div>

            <div class="flex flex-col gap-2.5">
              <!-- Option 1: Current segment -->
              <label @click="selectedFinishType = 'current'"
                     class="flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all"
                     :class="selectedFinishType === 'current' ? 'border-blue-500 bg-blue-50/40' : 'border-gray-100 hover:border-gray-200 bg-gray-50/50'">
                <input type="radio" value="current" v-model="selectedFinishType" class="mt-0.5"/>
                <div>
                  <div class="text-xs font-bold text-gray-800">
                    {{ isFinishingSubBranch ? 'Поточна ділянка підрозгалудження (перед зупинками)' : 'Поточна ділянка (перед зупинками)' }}
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
                    {{ isFinishingSubBranch ? 'До контрольної точки цього розгалудження' : 'До контрольної точки цієї сторони' }}
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
                    {{ isFinishingSubBranch ? 'До закінчення цього розгалудження' : 'Нижнє оборотне коло (закруглення)' }}
                  </div>
                  <div class="text-[11px] text-gray-500 mt-0.5">
                    {{ isFinishingSubBranch ? 'Злиття із точкою закінчення батьківського розгалудження' : 'Плавне злиття із дугою в самому низу оборотного кола' }}
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
            <input v-model="editNode.name" type="text"
              class="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold mb-4 bg-gray-50 focus:outline-none focus:border-blue-400"/>
              
            <label class="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Прив'язка до бази</label>
            <div class="mb-5">
              <StopSelector 
                v-model="editNode.realId" 
                :stops="availableStops" 
                @create="name => createNewStopForNode(editNode, name)"
                @update:modelValue="id => assignRealStopToNode(editNode, id)"
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
                  v-model="node.realId" 
                  :stops="availableStops" 
                  @create="name => createNewStopForNode(node, name)"
                  @update:modelValue="id => assignRealStopToNode(node, id)"
                />
              </div>

              <!-- Depot / Lunch info -->
              <div class="flex items-center justify-between text-xs mt-1">
                <span v-if="getStopType(node.realId) === 'depo'" class="px-2 py-0.5 bg-yellow-100 text-yellow-700 font-bold rounded-md text-[9px] uppercase tracking-wide">ДЕПО</span>
                <span v-else-if="getStopType(node.realId) === 'end'" class="px-2 py-0.5 bg-purple-100 text-purple-700 font-bold rounded-md text-[9px] uppercase tracking-wide">КІНЦЕВА</span>
                <span v-else class="px-2 py-0.5 bg-gray-100 text-gray-500 font-bold rounded-md text-[9px] uppercase tracking-wide">ЗВИЧАЙНА</span>
                
                <label class="flex items-center gap-1 cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded transition-colors">
                  <input type="checkbox" v-model="node.canLunch" class="w-3 h-3 text-blue-500 rounded border-gray-300"/>
                  <span class="text-[9px] font-bold text-gray-600 uppercase tracking-wide mt-0.5">Обід</span>
                </label>
              </div>

              <div class="mt-1 bg-gray-50 border border-gray-100 p-2 rounded-xl">
                <label class="text-[9px] font-bold text-gray-400 uppercase block mb-1 text-center">Час відпочинку (хв)</label>
                <div class="flex items-center justify-center gap-1.5 text-xs">
                  <input v-model.number="node.waitMin" type="number" min="0"
                    class="w-10 text-center border border-gray-200 rounded-lg py-1 font-bold text-gray-800 bg-white focus:outline-none focus:border-blue-400 shadow-sm" title="Мінімум"/>
                  <span class="text-gray-400 font-bold">–</span>
                  <input v-model.number="node.waitMax" type="number" min="0"
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
            <p class="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Розгалуження</p>
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
                  <input v-model.number="activeSegment.travelTime" type="number" min="1"
                    class="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-bold text-gray-800 focus:outline-none focus:border-blue-400 pr-6"/>
                  <span class="absolute right-2 top-1.5 text-xs font-bold text-gray-400">хв</span>
                </div>
              </div>
              <div>
                <label class="text-[10px] font-semibold text-gray-500 block mb-1">Інтервал від</label>
                <input v-model="activeSegment.interval" type="text"
                  class="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-bold text-gray-800 focus:outline-none focus:border-blue-400"/>
              </div>
              <div>
                <label class="text-[10px] font-semibold text-gray-500 block mb-1">Інтервал до</label>
                <input v-model="activeSegment.intervalMax" type="text"
                  class="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-bold text-gray-800 focus:outline-none focus:border-blue-400"/>
              </div>
            </div>

            <!-- Control nodes forming this segment -->
            <div v-if="activeSegmentNodes.length > 0" class="mt-4 pt-4 border-t border-gray-100">
               <h4 class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Контрольні точки ділянки</h4>
               <div v-for="node in activeSegmentNodes" :key="'cn-' + node.id" class="mt-2 flex items-center gap-1">
                 <span class="text-xs font-medium w-1/3 truncate" :title="node.name">{{ node.name }}</span>
                 <StopSelector 
                   v-model="node.realId" 
                   :stops="availableStops" 
                   @create="name => createNewStopForNode(node, name)"
                   @update:modelValue="id => assignRealStopToNode(node, id)"
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
                    v-model="stop.realId" 
                    :stops="availableStops" 
                    @create="name => createNewStopForNode(stop, name)"
                    @update:modelValue="id => assignRealStopToNode(stop, id)"
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
</style>
