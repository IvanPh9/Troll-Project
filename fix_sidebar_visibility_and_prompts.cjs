const fs = require('fs');

let content = fs.readFileSync('src/modules/route-constructor/RouteConstructor.vue', 'utf8');

// 1. Remove prompt from editBranchStop and editBranchNode
const oldEditStopAndNode = `function editBranchStop(brId, sectionIdx, stopIdx) {
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
}`;

const newEditStopAndNode = `function editBranchStop(brId, sectionIdx, stopIdx) {
  const br = branches.value.find(b => b.id === brId);
  if (br && br.sections) {
    if (!br.sections[sectionIdx]) {
      br.sections[sectionIdx] = { stops: [] };
    }
    const sec = br.sections[sectionIdx];
    if (!sec.id) {
      sec.id = 'br_sec_' + br.id + '_' + sectionIdx + '_' + Date.now();
    }
    isSidebarOpen.value = true;
    router.push({ query: { ...route.query, segmentId: String(sec.id) } });
  }
}

function editBranchNode(brId, bNIdx) {
  const br = branches.value.find(b => b.id === brId);
  if (br && br.nodes && br.nodes[bNIdx]) {
    editNode.value = br.nodes[bNIdx];
  }
}`;

content = content.replace(oldEditStopAndNode, newEditStopAndNode);

// Also replace if editBranchStop was already updated in a previous step
const oldEditStopOnly = `function editBranchStop(brId, sectionIdx, stopIdx) {
  const br = branches.value.find(b => b.id === brId);
  if (br && br.sections) {
    if (!br.sections[sectionIdx]) {
      br.sections[sectionIdx] = { stops: [] };
    }
    const sec = br.sections[sectionIdx];
    if (!sec.id) {
      sec.id = 'br_sec_' + br.id + '_' + sectionIdx + '_' + Date.now();
    }
    router.push({ query: { ...route.query, segmentId: String(sec.id) } });
  }
}`;

if (content.includes(oldEditStopOnly)) {
  content = content.replace(oldEditStopOnly, `function editBranchStop(brId, sectionIdx, stopIdx) {
  const br = branches.value.find(b => b.id === brId);
  if (br && br.sections) {
    if (!br.sections[sectionIdx]) {
      br.sections[sectionIdx] = { stops: [] };
    }
    const sec = br.sections[sectionIdx];
    if (!sec.id) {
      sec.id = 'br_sec_' + br.id + '_' + sectionIdx + '_' + Date.now();
    }
    isSidebarOpen.value = true;
    router.push({ query: { ...route.query, segmentId: String(sec.id) } });
  }
}`);
  
  const oldEditBranchNodeOnly = `function editBranchNode(brId, bNIdx) {
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
}`;
  content = content.replace(oldEditBranchNodeOnly, `function editBranchNode(brId, bNIdx) {
  const br = branches.value.find(b => b.id === brId);
  if (br && br.nodes && br.nodes[bNIdx]) {
    editNode.value = br.nodes[bNIdx];
  }
}`);
}

// 2. Add watcher on activeSegment so sidebar automatically opens when a segment/branch section is selected
const watcherStr = `
watch(activeSegment, (newVal) => {
  if (newVal) {
    isSidebarOpen.value = true;
  }
}, { immediate: true });
`;

if (!content.includes('watch(activeSegment')) {
  content = content.replace('/* ─────────── Sidebar Segment Editor ─────────── */', watcherStr + '\n/* ─────────── Sidebar Segment Editor ─────────── */');
}

fs.writeFileSync('src/modules/route-constructor/RouteConstructor.vue', content);
console.log('Successfully removed prompts and added automatic sidebar opening!');
