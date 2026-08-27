const fs = require('fs');
let content = fs.readFileSync('src/modules/route-constructor/RouteConstructor.vue', 'utf8');

const removeReplace = `function removeStopFromSeg(seg, stopOrIdx) {
  if (typeof stopOrIdx === 'number') {
    seg.stops.splice(stopOrIdx, 1);
    return;
  }
  const stop = stopOrIdx;
  let idx = seg.stops.findIndex(s => s.id === stop.id);
  if (idx !== -1) {
    seg.stops.splice(idx, 1);
    return;
  }
  if (seg.isBranch && seg.br) {
    const mainSeg = segments.value[seg.br.segIdx];
    if (mainSeg && mainSeg.stops) {
      idx = mainSeg.stops.findIndex(s => s.id === stop.id);
      if (idx !== -1) {
        mainSeg.stops.splice(idx, 1);
      }
    }
  }
}`;

content = content.replace(/function removeStopFromSeg\(seg, stopIdx\) {\s*seg\.stops\.splice\(stopIdx, 1\);\s*}/, removeReplace);

fs.writeFileSync('src/modules/route-constructor/RouteConstructor.vue', content);
console.log("Updated removeStopFromSeg with regex");
