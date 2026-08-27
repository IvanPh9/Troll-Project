const fs = require('fs');
let content = fs.readFileSync('src/modules/route-constructor/RouteConstructor.vue', 'utf8');

const search = `                const mainSeg = segments.value[br.segIdx];
                if (br.finished && (!br.targetType || br.targetType === 'current') && mainSeg) {
                   const mainStops = mainSeg.stops || [];
                   return [...branchStops, ...mainStops];
                }`;

const replace = `                const mainSeg = segments.value[br.segIdx];
                const secIdx = br.sections.indexOf(sec);
                const isLastSection = secIdx === br.sections.length - 1;
                
                if (br.finished && (!br.targetType || br.targetType === 'current') && mainSeg && isLastSection) {
                   const mainStops = mainSeg.stops || [];
                   return [...branchStops, ...mainStops];
                }`;

if (content.includes(search)) {
  content = content.replace(search, replace);
  console.log("Updated activeSegment to only append mainStops if it is the LAST section of the branch.");
} else {
  console.log("Could not find the search string!");
}

fs.writeFileSync('src/modules/route-constructor/RouteConstructor.vue', content);
