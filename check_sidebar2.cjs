const fs = require('fs');
const lines = fs.readFileSync('src/modules/route-constructor/RouteConstructor.vue', 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('activeSegment.stops')) {
    console.log(i + ': ' + lines[i]);
  }
}
