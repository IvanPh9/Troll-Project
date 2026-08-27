const fs = require('fs');
let content = fs.readFileSync('src/modules/route-constructor/RouteConstructor.vue', 'utf8');

const searchRegex = /<div v-for="\s*\(stop,\s*sIdx\)\s*in\s*\(activeSegment\.unifiedStops\s*\|\|\s*activeSegment\.stops\)"\s*:key="stop\.id"\s*class="mb-2 p-3 bg-gray-50 border border-gray-100 rounded-xl group relative">/g;

const replace = `<template v-for="(stop, sIdx) in (activeSegment.unifiedStops || activeSegment.stops)" :key="stop.id">
                
                <div v-if="activeSegment.unifiedStops && sIdx === activeSegment.stops.length" 
                     class="flex justify-center my-3 relative">
                  <div class="absolute inset-0 flex items-center" aria-hidden="true">
                    <div class="w-full border-t border-blue-200/60 border-dashed"></div>
                  </div>
                  <div class="relative bg-white border border-blue-200 rounded-md shadow-sm px-2 py-1 flex items-center gap-1.5 justify-center text-blue-600" title="Місце злиття">
                    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="18" r="3"></circle><circle cx="6" cy="6" r="3"></circle><path d="M6 21V9a9 9 0 0 0 9 9"></path></svg>
                    <span class="text-[10px] font-bold uppercase tracking-wider">Злиття</span>
                  </div>
                </div>

                <div class="mb-2 p-3 bg-gray-50 border border-gray-100 rounded-xl group relative">`;

let updated = false;
content = content.replace(searchRegex, (match) => {
  updated = true;
  return replace;
});

if (updated) {
  // Replace the closing div of the loop
  // The loop ends just before `</div>\n          </div>\n\n        </div>\n      </template>`
  // Let's find: `</StopSelector>` -> `</div>` -> `</div>` -> `</div>`
  
  const endSearch = `                  </div>
                </div>
              </div>
            </div>`;
  const endReplace = `                  </div>
                </div>
              </div>
              </template>
            </div>`;
            
  content = content.replace(endSearch, endReplace);
  console.log("Updated loop with template");
} else {
  console.log("Could not find start of loop");
}

fs.writeFileSync('src/modules/route-constructor/RouteConstructor.vue', content);
