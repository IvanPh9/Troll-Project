const fs = require('fs');
let content = fs.readFileSync('src/modules/route-constructor/RouteConstructor.vue', 'utf8');

const oldStr = `const activeSegmentNodes = computed(() => {
  if (!activeSegment.value) return [];
  const seg = activeSegment.value;
  const side = seg.side || 'right';`;

const oldRegex = /const activeSegmentNodes = computed\(\(\) => \{\s*if \(\!activeSegment\.value\) return \[\];\s*const seg = activeSegment\.value;\s*const side = seg\.side \|\| 'right';/;

const newStr = `const activeSegmentNodes = computed(() => {
  if (!activeSegment.value) return [];
  const seg = activeSegment.value;
  if (seg.isBranch) {
    return [seg.startNode, seg.endNode].filter(Boolean);
  }
  const side = seg.side || 'right';`;

content = content.replace(oldRegex, newStr);

fs.writeFileSync('src/modules/route-constructor/RouteConstructor.vue', content);
console.log("Fixed activeSegmentNodes!");
