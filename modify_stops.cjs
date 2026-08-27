const fs = require('fs');
let content = fs.readFileSync('src/modules/route-constructor/RouteConstructor.vue', 'utf8');

// 1. Update removeStopFromSeg
const removeSearch = `function removeStopFromSeg(seg, stopIdx) {
  seg.stops.splice(stopIdx, 1);
}`;

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

if (content.includes(removeSearch)) {
  content = content.replace(removeSearch, removeReplace);
  console.log("Updated removeStopFromSeg");
} else {
  console.log("Could not find removeStopFromSeg");
}

// 2. Update activeSegment logic
const activeSegSearch = `            sec.endNode = realEndNode || { id: 'br_en_' + sec.id, name: "Кінець гілки", realId: null };
            
            return sec;`;

const activeSegReplace = `            sec.endNode = realEndNode || { id: 'br_en_' + sec.id, name: "Кінець гілки", realId: null };
            
            sec.isBranch = true;
            sec.br = br;

            Object.defineProperty(sec, 'unifiedStops', {
              get() {
                const branchStops = sec.stops || [];
                const mainSeg = segments.value[br.segIdx];
                if (br.finished && br.mergeConfigured === 'add_inside' && mainSeg) {
                   let contentOffset = 0;
                   const nodesLen = br.nodes ? br.nodes.length : 0;
                   for (let si = 0; si <= nodesLen; si++) {
                     const sc = (br.sections[si]?.stops || []).length;
                     contentOffset += (sc * 32);
                     contentOffset += 32;
                   }
                   contentOffset += nodesLen * 32;
                   
                   const bypassedStopsCount = Math.floor(contentOffset / 32);
                   const mainStops = mainSeg.stops || [];
                   return [...branchStops, ...mainStops.slice(bypassedStopsCount)];
                }
                return branchStops;
              },
              configurable: true,
              enumerable: true
            });
            
            return sec;`;

if (content.includes(activeSegSearch)) {
  content = content.replace(activeSegSearch, activeSegReplace);
  console.log("Updated activeSegment unifiedStops logic");
} else {
  console.log("Could not find activeSegment return sec");
}

// 3. Update template loop
// <div v-for="(stop, sIdx) in activeSegment.stops" :key="stop.id"
const loopSearch = `<div v-for="(stop, sIdx) in activeSegment.stops" :key="stop.id"`;
const loopReplace = `<div v-for="(stop, sIdx) in (activeSegment.unifiedStops || activeSegment.stops)" :key="stop.id"`;

if (content.includes(loopSearch)) {
  content = content.replace(loopSearch, loopReplace);
  console.log("Updated template v-for loop");
} else {
  console.log("Could not find template loop");
}

// 4. Update removeStopFromSeg call in template
// <button @click="removeStopFromSeg(activeSegment, sIdx)"
const callSearch = `<button @click="removeStopFromSeg(activeSegment, sIdx)"`;
const callReplace = `<button @click="removeStopFromSeg(activeSegment, stop)"`;

if (content.includes(callSearch)) {
  content = content.replace(callSearch, callReplace);
  console.log("Updated removeStopFromSeg call in template");
} else {
  console.log("Could not find removeStopFromSeg call in template");
}

// 5. Update stops length display
// <span class="text-xs font-bold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{{ activeSegment.stops.length }}</span>
const lengthSearch = `{{ activeSegment.stops.length }}`;
const lengthReplace = `{{ (activeSegment.unifiedStops || activeSegment.stops).length }}`;
if (content.includes(lengthSearch)) {
  content = content.replace(lengthSearch, lengthReplace);
  console.log("Updated stops length display");
}

// 6. Update empty state check
// <div v-if="activeSegment.stops.length === 0" class="p-4 text-center text-gray-400 text-sm font-medium">
const emptySearch = `v-if="activeSegment.stops.length === 0"`;
const emptyReplace = `v-if="(activeSegment.unifiedStops || activeSegment.stops).length === 0"`;
if (content.includes(emptySearch)) {
  content = content.replace(emptySearch, emptyReplace);
  console.log("Updated empty stops check");
}

fs.writeFileSync('src/modules/route-constructor/RouteConstructor.vue', content);
