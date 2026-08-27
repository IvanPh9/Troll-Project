const fs = require('fs');
let content = fs.readFileSync('src/modules/route-constructor/RouteConstructor.vue', 'utf8');

const search = `<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="18" r="3"></circle><circle cx="6" cy="6" r="3"></circle><path d="M6 21V9a9 9 0 0 0 9 9"></path></svg>`;
const replace = `<SvgIcon name="finish-branch" class="w-3 h-3 text-blue-600" />`;

if (content.includes(search)) {
  content = content.replace(search, replace);
  console.log("Updated SVG to finish-branch icon");
} else {
  console.log("Could not find the SVG string");
}

fs.writeFileSync('src/modules/route-constructor/RouteConstructor.vue', content);
