const fs = require('fs');

let fileContent = fs.readFileSync('src/modules/route-constructor/components/RouteCanvas.vue', 'utf8');

fileContent = fileContent.replace(/fill="#1C1C1E"/g, 'fill="#4b5563"');

fs.writeFileSync('src/modules/route-constructor/components/RouteCanvas.vue', fileContent);
console.log('Successfully updated arrow colors to #4b5563');
