const fs = require('fs');
let content = fs.readFileSync('src/modules/route-constructor/RouteConstructor.vue', 'utf8');

// Update activeSegment
const activeSegmentSearch = `          if (String(sec.id) === String(rawId)) {
            sec.isBranch = true;
            if (!sec.startNode) sec.startNode = { id: 'br_sn_' + sec.id, name: "З'єднання / Початок", realId: null };
            if (!sec.endNode) sec.endNode = { id: 'br_en_' + sec.id, name: "Кінцева розгалудження", realId: null };
            return sec;
          }`;

const activeSegmentReplace = `          if (String(sec.id) === String(rawId)) {
            sec.isBranch = true;
            const secIdx = br.sections.indexOf(sec);
            if (secIdx === 0) sec.isConnecting = true;
            
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
                br.nodes[secIdx - 1] = { id: 'br_node_' + br.id + '_' + (secIdx - 1), name: 'Контрольна', type: 'control', realId: null };
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
                 if (!br.mergeNode) br.mergeNode = { id: 'br_merge_' + br.id, name: "Злиття", realId: null };
                 realEndNode = br.mergeNode;
               } else {
                 if (!br.terminusNode) br.terminusNode = { id: 'br_term_' + br.id, name: 'Кінцева розгалудження', isTerminus: true, realId: null };
                 realEndNode = br.terminusNode;
               }
            }
            sec.endNode = realEndNode || { id: 'br_en_' + sec.id, name: "Кінець гілки", realId: null };
            
            return sec;
          }`;

content = content.replace(activeSegmentSearch, activeSegmentReplace);

// Update template for "З'єднувальна ділянка"
const templateSearch = `<span v-if="segItem.isBranch" class="px-1.5 py-0.5 text-[8px] font-bold uppercase rounded bg-purple-100 text-purple-700 shrink-0">Гілка</span>`;
const templateReplace = `<span v-if="segItem.isConnecting" class="px-1.5 py-0.5 text-[8px] font-bold uppercase rounded bg-indigo-100 text-indigo-700 shrink-0">З'єднувальна ділянка</span>
                  <span v-else-if="segItem.isBranch" class="px-1.5 py-0.5 text-[8px] font-bold uppercase rounded bg-purple-100 text-purple-700 shrink-0">Гілка</span>`;

content = content.replace(templateSearch, templateReplace);

fs.writeFileSync('src/modules/route-constructor/RouteConstructor.vue', content);
console.log("Updated RouteConstructor.vue successfully!");
