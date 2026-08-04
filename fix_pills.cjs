const fs = require('fs');
let code = fs.readFileSync('src/modules/route-constructor/components/RouteCanvas.vue', 'utf8');

code = code.replace(/transform: 'translate\(\' \+ \(layout\.rightX \+ getBranchDx\(br\) \+ 32\) \+ \'px,/g, "transform: 'translate(' + (layout.rightX + getBranchDx(br) + 16) + 'px,");
code = code.replace(/transform: 'translate\(\' \+ \(layout\.leftX - getBranchDx\(br\) - 32\) \+ \'px,/g, "transform: 'translate(' + (layout.leftX - getBranchDx(br) - 48) + 'px,");

fs.writeFileSync('src/modules/route-constructor/components/RouteCanvas.vue', code);
console.log('Shifted branch pills half a cell (16px) left.');
