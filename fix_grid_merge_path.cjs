const fs = require('fs');

// Update RouteCanvas.vue
let canvasContent = fs.readFileSync('src/modules/route-constructor/components/RouteCanvas.vue', 'utf8');

const rightPathRegex = /function getRightBranchFinishedPath\(br, i\)[\s\S]*?return \{[\s\S]*?\};\n\}/;
const rightPathReplacement = `function getRightBranchFinishedPath(br, i) {
  if (!layout.value) return { d: '', arrowY: 0, turnY: 0, mergeY: 0 };
  const l = layout.value;
  const startY = l.rightNodeY[i];
  
  const isType1 = br.mergeConfigured === 'add_inside';
  const isType2 = br.targetType && br.targetType !== 'current';
  const dx = getBranchDx(br);
  
  let contentOffset = 0;
  const sections = br.sections || [];
  const nodesLen = getBranchNodesLength(br);
  for (let si = 0; si <= nodesLen; si++) {
    const stopsCount = (sections[si]?.stops || []).length;
    contentOffset += (stopsCount * 32);
    if (props.editable !== false) contentOffset += 32;
  }
  contentOffset += nodesLen * 32;

  const endpointY = startY + 64;
  const turnY = endpointY + contentOffset;
  const mergeY = turnY + 32;
  const r = 16;
  const absDx = Math.abs(dx);
  
  return {
    d: \`M \${l.rightX} \${startY}
        L \${l.rightX + 27.32} \${startY + 27.32}
        A \${r} \${r} 0 0 0 \${l.rightX + 38.62} \${startY + 32}
        L \${l.rightX + absDx - r} \${startY + 32}
        A \${r} \${r} 0 0 1 \${l.rightX + absDx} \${startY + 48}
        L \${l.rightX + absDx} \${mergeY - r}
        A \${r} \${r} 0 0 1 \${l.rightX + absDx - r} \${mergeY}
        L \${l.rightX + r} \${mergeY}
        A \${r} \${r} 0 0 0 \${l.rightX} \${mergeY + r}\`,
    arrowY: mergeY + 15,
    turnY: turnY,
    mergeY: mergeY
  };
}`;

const leftPathRegex = /function getLeftBranchFinishedPath\(br, i\)[\s\S]*?return \{[\s\S]*?\};\n\}/;
const leftPathReplacement = `function getLeftBranchFinishedPath(br, i) {
  if (!layout.value) return { d: '', arrowY: 0, turnY: 0, mergeY: 0 };
  const l = layout.value;
  const startY = l.leftNodeY[i+1];
  
  const isType2 = br.targetType && br.targetType !== 'current';
  const dx = getBranchDx(br);
  
  let contentOffset = 0;
  const sections = br.sections || [];
  const nodesLen = getBranchNodesLength(br);
  for (let si = 0; si <= nodesLen; si++) {
    const stopsCount = (sections[si]?.stops || []).length;
    contentOffset += (stopsCount * 32);
    if (props.editable !== false) contentOffset += 32;
  }
  contentOffset += nodesLen * 32;

  const endpointY = startY - 64;
  const turnY = endpointY - contentOffset;
  const mergeY = turnY - 32;
  const r = 16;
  const absDx = Math.abs(dx);
  
  return {
    d: \`M \${l.leftX} \${startY}
        L \${l.leftX - 27.32} \${startY - 27.32}
        A \${r} \${r} 0 0 0 \${l.leftX - 38.62} \${startY - 32}
        L \${l.leftX - absDx + r} \${startY - 32}
        A \${r} \${r} 0 0 1 \${l.leftX - absDx} \${startY - 48}
        L \${l.leftX - absDx} \${mergeY + r}
        A \${r} \${r} 0 0 1 \${l.leftX - absDx + r} \${mergeY}
        L \${l.leftX - r} \${mergeY}
        A \${r} \${r} 0 0 0 \${l.leftX} \${mergeY - r}\`,
    arrowY: mergeY - 15,
    turnY: turnY,
    mergeY: mergeY
  };
}`;

canvasContent = canvasContent.replace(rightPathRegex, rightPathReplacement);
canvasContent = canvasContent.replace(leftPathRegex, leftPathReplacement);

fs.writeFileSync('src/modules/route-constructor/components/RouteCanvas.vue', canvasContent);

// Update routeGeometry.js
let geomContent = fs.readFileSync('src/modules/route-constructor/utils/routeGeometry.js', 'utf8');
geomContent = geomContent.replace(/branchHeight = Math\.max\(128, branchHeight \+ 32\);/g, 'branchHeight = Math.max(160, branchHeight + 64);');
geomContent = geomContent.replace(/if \(b\.finished\) brH = Math\.max\(128, brH \+ 32\);/g, 'if (b.finished) brH = Math.max(160, brH + 64);');

fs.writeFileSync('src/modules/route-constructor/utils/routeGeometry.js', geomContent);

console.log('Successfully updated branch merge path to follow grid line!');
