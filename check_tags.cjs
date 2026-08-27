const fs = require('fs');
const lines = fs.readFileSync('src/modules/route-constructor/RouteConstructor.vue', 'utf8').split('\n');

// Find the template v-for
let start = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('<template v-for="(stop, sIdx)')) {
    start = i;
    break;
  }
}

if (start !== -1) {
  // Let's remove the incorrect </template> if it exists
  for (let i = start; i < lines.length; i++) {
    if (lines[i].includes('</template>')) {
      // Is this the one we added? Let's check the context.
      if (lines[i-1] && lines[i-1].includes('</div>') && lines[i+1] && lines[i+1].includes('</div>')) {
         // It might be.
      }
    }
  }
}

// Safer approach: I will just overwrite the file from git and re-apply cleanly.
