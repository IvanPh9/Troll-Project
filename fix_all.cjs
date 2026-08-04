const fs = require('fs');
let file = fs.readFileSync('c:/Users/2025/Desktop/Depo/web_v.01/src/modules/route-constructor/components/RouteCanvas.vue', 'utf8');

// Replace the entire getRightBranchFinishedPath function
file = file.replace(/function getRightBranchFinishedPath[\s\S]*?function getLeftBranchFinishedPath/,
`function getRightBranchFinishedPath(br, i) {
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
  const mergeY = endpointY + 96 + contentOffset;
  const turnY = mergeY - 32;
  const r = 16;
  const absDx = Math.abs(dx);
  
  return {
    d: \`M \${l.rightX} \${startY}
        L \${l.rightX + 27.32} \${startY + 27.32}
        A \${r} \${r} 0 0 0 \${l.rightX + 38.62} \${startY + 32}
        L \${l.rightX + absDx - r} \${startY + 32}
        A \${r} \${r} 0 0 1 \${l.rightX + absDx} \${startY + 48}
        L \${l.rightX + absDx} \${turnY}
        A \${r} \${r} 0 0 1 \${l.rightX + absDx - r} \${turnY + r}
        L \${l.rightX + r} \${mergeY - r}
        A \${r} \${r} 0 0 0 \${l.rightX} \${mergeY}\`,
    arrowY: mergeY - 15,
    turnY: turnY,
    mergeY: mergeY
  };
}

function getLeftBranchFinishedPath`);

// Replace the entire getLeftBranchFinishedPath function
file = file.replace(/function getLeftBranchFinishedPath[\s\S]*?const layout = computed/,
`function getLeftBranchFinishedPath(br, i) {
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
  const mergeY = endpointY - 96 - contentOffset;
  const turnY = mergeY + 32;
  const r = 16;
  const absDx = Math.abs(dx);
  
  return {
    d: \`M \${l.leftX} \${startY}
        L \${l.leftX - 27.32} \${startY - 27.32}
        A \${r} \${r} 0 0 0 \${l.leftX - 38.62} \${startY - 32}
        L \${l.leftX - absDx + r} \${startY - 32}
        A \${r} \${r} 0 0 1 \${l.leftX - absDx} \${startY - 48}
        L \${l.leftX - absDx} \${turnY}
        A \${r} \${r} 0 0 1 \${l.leftX - absDx + r} \${turnY - r}
        L \${l.leftX - r} \${mergeY + r}
        A \${r} \${r} 0 0 0 \${l.leftX} \${mergeY}\`,
    arrowY: mergeY + 15,
    turnY: turnY,
    mergeY: mergeY
  };
}

const layout = computed`);

fs.writeFileSync('c:/Users/2025/Desktop/Depo/web_v.01/src/modules/route-constructor/components/RouteCanvas.vue', file);
console.log('done');
