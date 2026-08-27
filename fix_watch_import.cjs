const fs = require('fs');

let content = fs.readFileSync('src/modules/route-constructor/RouteConstructor.vue', 'utf8');

content = content.replace("import { ref, computed, onMounted } from 'vue';", "import { ref, computed, watch, onMounted } from 'vue';");

fs.writeFileSync('src/modules/route-constructor/RouteConstructor.vue', content);
console.log('Successfully added watch to vue imports in RouteConstructor.vue');
