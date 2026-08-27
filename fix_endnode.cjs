const fs = require('fs');
let content = fs.readFileSync('src/modules/route-constructor/RouteConstructor.vue', 'utf8');

const search = `               if (br.finished) {
                 if (!br.mergeNode) br.mergeNode = { id: 'br_merge_' + br.id, name: "Злиття", realId: null };
                 realEndNode = br.mergeNode;
               } else {`;

const replace = `               if (br.finished) {
                 if (br.mergeConfigured === 'add_inside') {
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
               } else {`;

if (content.includes(search)) {
  content = content.replace(search, replace);
  console.log("Updated endNode logic");
} else {
  console.log("Search string not found!");
}

fs.writeFileSync('src/modules/route-constructor/RouteConstructor.vue', content);
