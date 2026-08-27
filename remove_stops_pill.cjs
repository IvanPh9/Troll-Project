const fs = require('fs');
let content = fs.readFileSync('src/modules/route-constructor/components/RouteCanvas.vue', 'utf8');

const lines = content.split('\n');
const newLines = [];
let skip = false;
let gCount = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  if (line.includes('<!-- New Pill AFTER Branch Terminus (Stops Only) -->')) {
    skip = true;
    gCount = 0;
  }
  
  if (skip) {
    if (line.includes('<g ')) gCount++;
    if (line.includes('<g>')) gCount++;
    if (line.includes('</g>')) {
      gCount--;
      if (gCount === 0) {
        skip = false;
        continue;
      }
    }
    continue;
  }
  
  newLines.push(line);
}

fs.writeFileSync('src/modules/route-constructor/components/RouteCanvas.vue', newLines.join('\n'));
console.log('Removed stops-only pills');
