const fs = require('fs');
let content = fs.readFileSync('src/modules/route-constructor/RouteConstructor.vue', 'utf8');

const search = `                   let contentOffset = 0;
                   const nodesLen = br.nodes ? br.nodes.length : 0;
                   for (let si = 0; si <= nodesLen; si++) {
                     const sc = (br.sections[si]?.stops || []).length;
                     contentOffset += (sc * 32);
                     contentOffset += 32;
                   }
                   contentOffset += nodesLen * 32;
                   
                   const bypassedStopsCount = Math.floor(contentOffset / 32);
                   const mainStops = mainSeg.stops || [];
                   return [...branchStops, ...mainStops.slice(bypassedStopsCount)];`;

const replace = `                   const mainStops = mainSeg.stops || [];
                   return [...branchStops, ...mainStops];`;

if (content.includes(search)) {
  content = content.replace(search, replace);
  console.log("Updated unifiedStops to include all mainStops (since layout shifts them down)");
} else {
  console.log("Could not find the search string!");
}

fs.writeFileSync('src/modules/route-constructor/RouteConstructor.vue', content);
