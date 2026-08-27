const fs = require('fs');

let content = fs.readFileSync('src/modules/route-constructor/components/RouteCanvas.vue', 'utf8');

// Fix duplicate </template> near line 1000
content = content.replace(/<\/template>\s*<\/template>\s*<!-- Direction Arrow/g, '</template>\n\n          <!-- Direction Arrow');

fs.writeFileSync('src/modules/route-constructor/components/RouteCanvas.vue', content);
console.log('Cleaned up duplicate template tag.');
