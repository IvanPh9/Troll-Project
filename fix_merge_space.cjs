const fs = require('fs');
let content = fs.readFileSync('src/modules/route-constructor/components/RouteCanvas.vue', 'utf8');

let replaced = false;

// Right Branch
const rightSearch = `  const endpointY = startY + 64;
  const turnY = endpointY + contentOffset;
  const mergeY = turnY + 32;`;

const rightReplace = `  const endpointY = startY + 64;
  const turnY = endpointY + contentOffset;
  const mergeY = turnY;`;

if (content.includes(rightSearch)) {
  content = content.replace(rightSearch, rightReplace);
  console.log("Updated Right mergeY");
  replaced = true;
} else {
  console.log("Right search string not found!");
}

// Left Branch
const leftSearch = `  const endpointY = startY - 64;
  const turnY = endpointY - contentOffset;
  const mergeY = turnY - 32;`;

const leftReplace = `  const endpointY = startY - 64;
  const turnY = endpointY - contentOffset;
  const mergeY = turnY;`;

if (content.includes(leftSearch)) {
  content = content.replace(leftSearch, leftReplace);
  console.log("Updated Left mergeY");
  replaced = true;
} else {
  console.log("Left search string not found!");
}

if (replaced) {
  fs.writeFileSync('src/modules/route-constructor/components/RouteCanvas.vue', content);
}
