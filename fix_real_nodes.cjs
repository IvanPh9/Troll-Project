const fs = require('fs');
let content = fs.readFileSync('src/modules/route-constructor/RouteConstructor.vue', 'utf8');

const search = `          if (String(sec.id) === String(rawId)) {
            sec.isBranch = true;
            if (!sec.startNode) sec.startNode = { id: 'br_sn_' + sec.id, name: "З'єднання / Початок", realId: null };
            if (!sec.endNode) sec.endNode = { id: 'br_en_' + sec.id, name: "Кінцева розгалудження", realId: null };
            return sec;
          }`;

const replace = `          if (String(sec.id) === String(rawId)) {
            sec.isBranch = true;
            const secIdx = br.sections.indexOf(sec);
            
            let realStartNode = null;
            if (secIdx === 0) {
              const mainLineSeg = segments.value[br.segIdx];
              if (mainLineSeg) {
                const side = mainLineSeg.side || 'right';
                const sideNodes = nodes.value.filter(n => n.type === 'end' || n.side === side || !n.side);
                const sideSegs = segments.value.filter(s => s.side === side || !s.side);
                const idx = sideSegs.findIndex(s => s.id === mainLineSeg.id);
                if (idx !== -1 && sideNodes[idx] && sideNodes[idx+1]) {
                   realStartNode = side === 'left' ? sideNodes[idx+1] : sideNodes[idx];
                }
              }
            } else {
              if (!br.nodes) br.nodes = [];
              if (br.nodes[secIdx - 1]) {
                realStartNode = br.nodes[secIdx - 1];
              } else {
                br.nodes[secIdx - 1] = { id: 'br_node_' + br.id + '_' + (secIdx - 1), name: 'Контрольна', type: 'control', realId: null };
                realStartNode = br.nodes[secIdx - 1];
              }
            }
            sec.startNode = realStartNode || { id: 'br_sn_' + sec.id, name: "З'єднання", realId: null };

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

content = content.replace(search, replace);
fs.writeFileSync('src/modules/route-constructor/RouteConstructor.vue', content);
console.log("Applied real node references for branches!");
