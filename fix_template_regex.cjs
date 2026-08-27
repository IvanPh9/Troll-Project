const fs = require('fs');
let c = fs.readFileSync('src/modules/route-constructor/RouteConstructor.vue', 'utf8');
c = c.replace(/@add-branch-stop="[^"]+"/, '$&\n        @extend-branch-with-stop="extendBranchWithStop"');
fs.writeFileSync('src/modules/route-constructor/RouteConstructor.vue', c);
console.log('Fixed');
