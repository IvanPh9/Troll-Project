const fs = require('fs');
let content = fs.readFileSync('src/modules/route-constructor/RouteConstructor.vue', 'utf8');

const getSegmentNameSearch = `const getSegmentName = (seg) => {
  const side = seg.side || 'right';`;
const getSegmentNameReplace = `const getSegmentName = (seg) => {
  if (seg.isBranch && seg.startNode && seg.endNode) {
    return \`\${seg.startNode.name} → \${seg.endNode.name}\`;
  }
  const side = seg.side || 'right';`;
  
content = content.replace(getSegmentNameSearch, getSegmentNameReplace);
fs.writeFileSync('src/modules/route-constructor/RouteConstructor.vue', content);
console.log("Applied getSegmentName fix");
