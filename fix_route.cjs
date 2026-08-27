const fs = require('fs');
let content = fs.readFileSync('src/modules/route-constructor/RouteConstructor.vue', 'utf8');

// First, fix activeSegment definition if not already fixed
if (!content.includes("const rawId = activeSegmentId.value;")) {
  content = content.replace(
    "const id = parseInt(activeSegmentId.value);",
    "const rawId = activeSegmentId.value;\n  if (String(rawId).startsWith('br_sec_')) {\n    for (const br of branches.value) {\n      if (br.sections) {\n        for (const sec of br.sections) {\n          if (String(sec.id) === String(rawId)) {\n            sec.isBranch = true;\n            return sec;\n          }\n        }\n      }\n    }\n  }\n  const id = parseInt(rawId);"
  );
}

// Second, restore deleted code if missing
if (!content.includes('const getSegmentName')) {
  content = content.replace(
    '/* ─────────── Sidebar Segment Editor ─────────── */',
    `/* ─────────── Edit overlays ─────────── */
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
  const side = seg.side || 'right';
  const sideNodes = nodes.value.filter(n => n.type === 'end' || n.side === side || !n.side);
  const sideSegs = segments.value.filter(s => s.side === side || !s.side);
  const idx = sideSegs.findIndex(s => s.id === seg.id);
  if (idx === -1 || !sideNodes[idx] || !sideNodes[idx+1]) return 'Ділянка';
  if (side === 'left') {
    return \`\${sideNodes[idx+1].name} → \${sideNodes[idx].name}\`;
  }
  return \`\${sideNodes[idx].name} → \${sideNodes[idx+1].name}\`;
};

/* ─────────── Sidebar Segment Editor ─────────── */`
  );
}

fs.writeFileSync('src/modules/route-constructor/RouteConstructor.vue', content);
console.log('Restored RouteConstructor.vue');
