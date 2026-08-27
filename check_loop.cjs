const fs = require('fs');
const lines = fs.readFileSync('src/modules/route-constructor/RouteConstructor.vue', 'utf8').split('\n');

let start = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('v-for="(stop, sIdx) in (activeSegment.unifiedStops || activeSegment.stops)"')) {
    start = i;
    break;
  }
}

if (start !== -1) {
  for (let i = start; i < start + 30; i++) {
    console.log(lines[i]);
  }
} else {
  console.log("Not found");
}
