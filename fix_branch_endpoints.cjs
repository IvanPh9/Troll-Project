const fs = require('fs');
let content = fs.readFileSync('src/modules/route-constructor/RouteConstructor.vue', 'utf8');

// 1. Update activeSegment
const activeSegmentSearch = `          if (String(sec.id) === String(rawId)) {
            sec.isBranch = true;
            return sec;
          }`;
const activeSegmentReplace = `          if (String(sec.id) === String(rawId)) {
            sec.isBranch = true;
            if (!sec.startNode) sec.startNode = { id: 'br_sn_' + sec.id, name: "З'єднання / Початок", realId: null };
            if (!sec.endNode) sec.endNode = { id: 'br_en_' + sec.id, name: "Кінцева розгалудження", realId: null };
            return sec;
          }`;
content = content.replace(activeSegmentSearch, activeSegmentReplace);

// 2. Update activeSegmentNodes
const activeSegmentNodesSearch = `const activeSegmentNodes = computed(() => {
  if (!activeSegment.value) return [];
  const seg = activeSegment.value;
  const side = seg.side || 'right';`;
const activeSegmentNodesReplace = `const activeSegmentNodes = computed(() => {
  if (!activeSegment.value) return [];
  const seg = activeSegment.value;
  if (seg.isBranch) {
    return [seg.startNode, seg.endNode].filter(Boolean);
  }
  const side = seg.side || 'right';`;
content = content.replace(activeSegmentNodesSearch, activeSegmentNodesReplace);

fs.writeFileSync('src/modules/route-constructor/RouteConstructor.vue', content);
console.log("Applied branch endpoints fix");
