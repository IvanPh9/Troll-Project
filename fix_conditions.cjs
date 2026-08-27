const fs = require('fs');
let content = fs.readFileSync('src/modules/route-constructor/RouteConstructor.vue', 'utf8');

const searchCondition1 = `if (br.finished && br.mergeConfigured === 'add_inside' && mainSeg) {`;
const replaceCondition1 = `if (br.finished && (!br.targetType || br.targetType === 'current') && mainSeg) {`;

if (content.includes(searchCondition1)) {
  content = content.replace(searchCondition1, replaceCondition1);
  console.log("Updated unifiedStops condition in activeSegment");
}

const searchCondition2 = `if (br.mergeConfigured === 'add_inside') {`;
const replaceCondition2 = `if (!br.targetType || br.targetType === 'current') {`;

if (content.includes(searchCondition2)) {
  content = content.replace(searchCondition2, replaceCondition2);
  console.log("Updated endNode condition in activeSegment");
}

// And also fix removeStopFromSeg where it checks seg.br
const searchCondition3 = `if (seg.isBranch && seg.br) {`;
const replaceCondition3 = `if (seg.isBranch && seg.br && (!seg.br.targetType || seg.br.targetType === 'current')) {`;

if (content.includes(searchCondition3)) {
  content = content.replace(searchCondition3, replaceCondition3);
  console.log("Updated removeStopFromSeg condition");
}

fs.writeFileSync('src/modules/route-constructor/RouteConstructor.vue', content);
