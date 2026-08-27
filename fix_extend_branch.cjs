const fs = require('fs');
let canvas = fs.readFileSync('src/modules/route-constructor/components/RouteCanvas.vue', 'utf8');
let constructor = fs.readFileSync('src/modules/route-constructor/RouteConstructor.vue', 'utf8');

// 1. Update RouteCanvas.vue
const emitSearch = `const emit = defineEmits([
  'add-stop', 'remove-stop',
  'add-node', 'remove-node',
  'add-branch', 'add-sub-branch', 'finish-branch',
  'add-branch-node', 'add-branch-stop',`;

const emitReplace = `const emit = defineEmits([
  'add-stop', 'remove-stop',
  'add-node', 'remove-node',
  'add-branch', 'add-sub-branch', 'finish-branch',
  'add-branch-node', 'add-branch-stop', 'extend-branch-with-stop',`;

if (canvas.includes(emitSearch)) {
  canvas = canvas.replace(emitSearch, emitReplace);
  console.log("Updated defineEmits in RouteCanvas.vue");
} else {
  console.log("ERROR: emitSearch not found!");
}

const rightPillSearch = `<g style="cursor:pointer;" title="Додати зупинку" @click.stop="$emit('add-branch-stop', br.id, getBranchNodesLength(br))">
                <rect x="0" y="-14" width="32" height="28" fill="transparent" rx="14"/>`;

const rightPillReplace = `<g style="cursor:pointer;" title="Додати зупинку" @click.stop="$emit('extend-branch-with-stop', br.id)">
                <rect x="0" y="-14" width="32" height="28" fill="transparent" rx="14"/>`;

if (canvas.includes(rightPillSearch)) {
  canvas = canvas.replace(rightPillSearch, rightPillReplace);
  console.log("Updated right pill event");
} else {
  console.log("ERROR: rightPillSearch not found!");
}

const leftPillSearch = `<g style="cursor:pointer;" title="Додати зупинку" @click.stop="$emit('add-branch-stop', br.id, getBranchNodesLength(br))">
                <rect x="-32" y="-14" width="32" height="28" fill="transparent" rx="14"/>`;

const leftPillReplace = `<g style="cursor:pointer;" title="Додати зупинку" @click.stop="$emit('extend-branch-with-stop', br.id)">
                <rect x="-32" y="-14" width="32" height="28" fill="transparent" rx="14"/>`;

if (canvas.includes(leftPillSearch)) {
  canvas = canvas.replace(leftPillSearch, leftPillReplace);
  console.log("Updated left pill event");
} else {
  console.log("ERROR: leftPillSearch not found!");
}

fs.writeFileSync('src/modules/route-constructor/components/RouteCanvas.vue', canvas);


// 2. Update RouteConstructor.vue
const templateSearch = `        @add-branch-node="addBranchNode"
        @add-branch-stop="(brId, si) => addBranchStop(brId, si)"`;

const templateReplace = `        @add-branch-node="addBranchNode"
        @add-branch-stop="(brId, si) => addBranchStop(brId, si)"
        @extend-branch-with-stop="extendBranchWithStop"`;

if (constructor.includes(templateSearch)) {
  constructor = constructor.replace(templateSearch, templateReplace);
  console.log("Updated RouteConstructor template");
} else {
  console.log("ERROR: templateSearch not found!");
}

const funcSearch = `function addBranchStop(brId, sectionIdx = 0) {`;
const funcReplace = `function extendBranchWithStop(brId) {
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

function addBranchStop(brId, sectionIdx = 0) {`;

if (constructor.includes(funcSearch)) {
  constructor = constructor.replace(funcSearch, funcReplace);
  console.log("Added extendBranchWithStop");
} else {
  console.log("ERROR: funcSearch not found!");
}

fs.writeFileSync('src/modules/route-constructor/RouteConstructor.vue', constructor);
console.log("Done.");
