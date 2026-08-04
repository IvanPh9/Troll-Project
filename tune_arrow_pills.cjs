const fs = require('fs');

let fileContent = fs.readFileSync('src/modules/route-constructor/components/RouteCanvas.vue', 'utf8');

// Remove Vertical Divider 2 (the line between the two arrow buttons)
fileContent = fileContent.replace(/<!-- Vertical Divider 2 -->\s*<line[^>]*\/>/g, '');

// Scale down SVG 1 and SVG 2
fileContent = fileContent.replace(/<path transform="scale\(0\.7\)"/g, '<path transform="scale(0.55)"');
fileContent = fileContent.replace(/<path transform="scale\(0\.65\)"/g, '<path transform="scale(0.5)"');

fs.writeFileSync('src/modules/route-constructor/components/RouteCanvas.vue', fileContent);
console.log('Successfully removed divider 2 and scaled down arrow icons.');
