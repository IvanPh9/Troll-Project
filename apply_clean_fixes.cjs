const fs = require('fs');

// ==========================================
// 1. Update RouteConstructor.vue
// ==========================================
let constructorContent = fs.readFileSync('src/modules/route-constructor/RouteConstructor.vue', 'utf8');

// Fix activeSegment ID parsing (use String instead of parseInt)
const oldActiveSegment = `const activeSegment = computed(() => {
  if (!activeSegmentId.value) return null;
  const id = parseInt(activeSegmentId.value);
  let found = segments.value.find(s => s.id === id);
  if (found) return found;
  // Also search branches if needed
  for (const br of branches.value) {
    if (br.sections) {
      for (const sec of br.sections) {
        if (sec.id === id) return sec;
      }
    }
  }
  return null;
});`;

const newActiveSegment = `const activeSegment = computed(() => {
  if (!activeSegmentId.value) return null;
  const idStr = String(activeSegmentId.value);
  let found = segments.value.find(s => String(s.id) === idStr);
  if (found) return found;
  // Also search branches
  for (const br of branches.value) {
    if (br.sections) {
      for (const sec of br.sections) {
        if (String(sec.id) === idStr) return sec;
      }
    }
  }
  return null;
});`;

constructorContent = constructorContent.replace(oldActiveSegment, newActiveSegment);

// Update activeSegmentNodes to support branch sections
const oldActiveSegmentNodes = `const activeSegmentNodes = computed(() => {
  if (!activeSegment.value) return [];
  const seg = activeSegment.value;
  const side = seg.side || 'right';
  const sideNodes = nodes.value.filter(n => n.type === 'end' || n.side === side || !n.side);
  const sideSegs = segments.value.filter(s => s.side === side || !s.side);
  const idx = sideSegs.findIndex(s => s.id === seg.id);
  if (idx === -1 || !sideNodes[idx] || !sideNodes[idx+1]) return [];
  if (side === 'left') {
    return [sideNodes[idx+1], sideNodes[idx]];
  }
  return [sideNodes[idx], sideNodes[idx+1]];
});`;

const newActiveSegmentNodes = `const activeSegmentNodes = computed(() => {
  if (!activeSegment.value) return [];
  const seg = activeSegment.value;

  // Check if activeSegment is inside a branch
  for (const br of branches.value) {
    if (br.sections) {
      const secIdx = br.sections.findIndex(s => String(s.id) === String(seg.id));
      if (secIdx !== -1) {
        const nodesLen = (br.nodes || []).length;
        const startNode = secIdx === 0
          ? { id: 'br_start_' + br.id, name: br.name + ' (Початок)' }
          : br.nodes[secIdx - 1];
        const endNode = secIdx < nodesLen
          ? br.nodes[secIdx]
          : { id: 'br_end_' + br.id, name: 'Контрольна точка' };
        return [startNode, endNode].filter(Boolean);
      }
    }
  }

  const side = seg.side || 'right';
  const sideNodes = nodes.value.filter(n => n.type === 'end' || n.side === side || !n.side);
  const sideSegs = segments.value.filter(s => s.side === side || !s.side);
  const idx = sideSegs.findIndex(s => s.id === seg.id);
  if (idx === -1 || !sideNodes[idx] || !sideNodes[idx+1]) return [];
  if (side === 'left') {
    return [sideNodes[idx+1], sideNodes[idx]];
  }
  return [sideNodes[idx], sideNodes[idx+1]];
});`;

constructorContent = constructorContent.replace(oldActiveSegmentNodes, newActiveSegmentNodes);

// Update getSegmentName to support branch sections
const oldGetSegmentName = `const getSegmentName = (seg) => {
  const side = seg.side || 'right';
  const sideNodes = nodes.value.filter(n => n.type === 'end' || n.side === side || !n.side);
  const sideSegs = segments.value.filter(s => s.side === side || !s.side);
  const idx = sideSegs.findIndex(s => s.id === seg.id);
  if (idx === -1 || !sideNodes[idx] || !sideNodes[idx+1]) return 'Ділянка';
  if (side === 'left') {
    return \`\${sideNodes[idx+1].name} → \${sideNodes[idx].name}\`;
  }
  return \`\${sideNodes[idx].name} → \${sideNodes[idx+1].name}\`;
};`;

const newGetSegmentName = `const getSegmentName = (seg) => {
  if (!seg) return 'Ділянка';
  for (const br of branches.value) {
    if (br.sections) {
      const secIdx = br.sections.findIndex(s => String(s.id) === String(seg.id));
      if (secIdx !== -1) {
        const segNodes = activeSegmentNodes.value;
        if (segNodes.length === 2) {
          return \`\${segNodes[0].name} → \${segNodes[1].name}\`;
        }
        return \`\${br.name} (Ділянка \${secIdx + 1})\`;
      }
    }
  }
  const side = seg.side || 'right';
  const sideNodes = nodes.value.filter(n => n.type === 'end' || n.side === side || !n.side);
  const sideSegs = segments.value.filter(s => s.side === side || !s.side);
  const idx = sideSegs.findIndex(s => s.id === seg.id);
  if (idx === -1 || !sideNodes[idx] || !sideNodes[idx+1]) return 'Ділянка';
  if (side === 'left') {
    return \`\${sideNodes[idx+1].name} → \${sideNodes[idx].name}\`;
  }
  return \`\${sideNodes[idx].name} → \${sideNodes[idx+1].name}\`;
};`;

constructorContent = constructorContent.replace(oldGetSegmentName, newGetSegmentName);
fs.writeFileSync('src/modules/route-constructor/RouteConstructor.vue', constructorContent);

// ==========================================
// 2. Update routeGeometry.js
// ==========================================
let geomContent = fs.readFileSync('src/modules/route-constructor/utils/routeGeometry.js', 'utf8');
geomContent = geomContent.replace(/branchHeight = Math\.max\(128, branchHeight \+ 32\);/g, 'branchHeight = Math.max(160, branchHeight + 64);');
geomContent = geomContent.replace(/if \(b\.finished\) brH = Math\.max\(128, brH \+ 32\);/g, 'if (b.finished) brH = Math.max(160, brH + 64);');
fs.writeFileSync('src/modules/route-constructor/utils/routeGeometry.js', geomContent);

// ==========================================
// 3. Update RouteCanvas.vue
// ==========================================
let canvasContent = fs.readFileSync('src/modules/route-constructor/components/RouteCanvas.vue', 'utf8');

// Update getRightBranchFinishedPath & getLeftBranchFinishedPath
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

// Add selectBranchSection with camera zoom
const insertBeforeStr = "function getBranchAddStopY";
const newBranchSectionFuncs = `function selectBranchSection(br, secIdx = 0, segIndex = 0, isRight = true) {
  if (!br.sections) br.sections = [];
  while (br.sections.length <= secIdx) {
    br.sections.push({ stops: [] });
  }
  const sec = br.sections[secIdx];
  if (!sec.id) {
    sec.id = 'br_sec_' + br.id + '_' + secIdx + '_' + Date.now();
  }
  if (!sec.stops) sec.stops = [];
  if (sec.travelTime === undefined) sec.travelTime = 5;
  if (sec.interval === undefined) sec.interval = '20';
  if (sec.intervalMax === undefined) sec.intervalMax = '25';

  if (router && route) {
    router.push({ query: { ...route.query, segmentId: String(sec.id) } });
  }

  // Camera zoom to branch section
  if (!layout.value) return;
  const l = layout.value;
  const cx = isRight ? (l.rightX + getBranchDx(br)) : (l.leftX - getBranchDx(br));
  const sY = getBranchSectionStartY(br, secIdx + 1, segIndex, isRight);
  const eY = getBranchSectionEndY(br, secIdx + 1, segIndex, isRight);
  const cy = (sY + eY) / 2;
  const segH = Math.abs(eY - sY);

  let targetH = segH + 160;
  let targetW = targetH * (800 / 1200);
  if (targetW < 350) {
    targetW = 350;
    targetH = targetW * (1200 / 800);
  }
  if (targetW > 800) {
    targetW = 800;
    targetH = 1200;
  }

  const targetX = cx - targetW / 2;
  const targetY = cy - targetH / 2;
  const startX = vbX.value;
  const startY = vbY.value;
  const startW = vbW.value;
  const startH = vbH.value;
  const duration = 500;
  const startTime = performance.now();

  if (zoomAnimFrame) cancelAnimationFrame(zoomAnimFrame);
  function step(time) {
    let progress = (time - startTime) / duration;
    if (progress > 1) progress = 1;
    const ease = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
    vbX.value = startX + (targetX - startX) * ease;
    vbY.value = startY + (targetY - startY) * ease;
    vbW.value = startW + (targetW - startW) * ease;
    vbH.value = startH + (targetH - startH) * ease;
    if (progress < 1) {
      zoomAnimFrame = requestAnimationFrame(step);
    }
  }
  zoomAnimFrame = requestAnimationFrame(step);
}

function getBranchSectionStartY(br, secIdx, i, isRight) {
  if (!layout.value) return 0;
  const l = layout.value;
  const baseStartY = isRight ? (l.rightNodeY[i] + 64) : (l.leftNodeY[i+1] - 64);
  if (secIdx <= 1) return baseStartY;
  return getBranchNodeY(br, secIdx - 2, i, isRight);
}

function getBranchSectionEndY(br, secIdx, i, isRight) {
  if (!layout.value) return 0;
  const nodesLen = getBranchNodesLength(br);
  if (secIdx <= nodesLen) {
    return getBranchNodeY(br, secIdx - 1, i, isRight);
  }
  if (br.finished) {
    return isRight ? getRightBranchFinishedPath(br, i).turnY : getLeftBranchFinishedPath(br, i).turnY;
  }
  return getBranchEndpointY(br, i, isRight);
}

`;

canvasContent = canvasContent.replace(insertBeforeStr, newBranchSectionFuncs + insertBeforeStr);

// Make right branch paths clickable
canvasContent = canvasContent.replace(
  `:d="getRightBranchFinishedPath(br, i).d"\n                  fill="none"`,
  `:d="getRightBranchFinishedPath(br, i).d"\n                  fill="none" style="cursor:pointer;" @click.stop="selectBranchSection(br, 0, i, true)"`
);
canvasContent = canvasContent.replace(
  `:d="getBranchOutPath(layout.rightX, layout.rightNodeY[i], getBranchDx(br), 1, 1, getBranchEndpointY(br, i, true))"\n                  fill="none"`,
  `:d="getBranchOutPath(layout.rightX, layout.rightNodeY[i], getBranchDx(br), 1, 1, getBranchEndpointY(br, i, true))"\n                  fill="none" style="cursor:pointer;" @click.stop="selectBranchSection(br, 0, i, true)"`
);

// Make left branch paths clickable
canvasContent = canvasContent.replace(
  `:d="getLeftBranchFinishedPath(br, i).d"\n                  fill="none"`,
  `:d="getLeftBranchFinishedPath(br, i).d"\n                  fill="none" style="cursor:pointer;" @click.stop="selectBranchSection(br, 0, i, false)"`
);
canvasContent = canvasContent.replace(
  `:d="getBranchOutPath(layout.leftX, layout.leftNodeY[i+1], getBranchDx(br), -1, -1, getBranchEndpointY(br, i, false))"\n                  fill="none"`,
  `:d="getBranchOutPath(layout.leftX, layout.leftNodeY[i+1], getBranchDx(br), -1, -1, getBranchEndpointY(br, i, false))"\n                  fill="none" style="cursor:pointer;" @click.stop="selectBranchSection(br, 0, i, false)"`
);

// Add clickable section overlay rect for Right Branch sections
const rightSectionOverlay = `<!-- Clickable Branch Section Overlay (Right) -->
              <rect :x="layout.rightX + getBranchDx(br) - 12"
                    :y="Math.min(getBranchSectionStartY(br, secIdx, i, true), getBranchSectionEndY(br, secIdx, i, true))"
                    width="24"
                    :height="Math.max(24, Math.abs(getBranchSectionEndY(br, secIdx, i, true) - getBranchSectionStartY(br, secIdx, i, true)))"
                    fill="transparent"
                    style="cursor: pointer;"
                    title="Налаштувати ділянку розгалудження"
                    @click.stop="selectBranchSection(br, secIdx - 1, i, true)" />

              <g v-for="(bStop, bStIdx) in getBranchSectionStops(br, secIdx)"`;

canvasContent = canvasContent.replace('<g v-for="(bStop, bStIdx) in getBranchSectionStops(br, secIdx)"', rightSectionOverlay);

// Add clickable section overlay rect for Left Branch sections
const leftSectionOverlay = `<template v-for="(si, secIdx) in (getBranchNodesLength(br) + 1)" :key="'lbrsec-' + secIdx">
              <!-- Clickable Branch Section Overlay (Left) -->
              <rect :x="layout.leftX - getBranchDx(br) - 12"
                    :y="Math.min(getBranchSectionStartY(br, secIdx, i, false), getBranchSectionEndY(br, secIdx, i, false))"
                    width="24"
                    :height="Math.max(24, Math.abs(getBranchSectionEndY(br, secIdx, i, false) - getBranchSectionStartY(br, secIdx, i, false)))"
                    fill="transparent"
                    style="cursor: pointer;"
                    title="Налаштувати ділянку розгалудження"
                    @click.stop="selectBranchSection(br, secIdx - 1, i, false)" />`;

canvasContent = canvasContent.replace(`<template v-for="(si, secIdx) in (getBranchNodesLength(br) + 1)" :key="'lbrsec-' + secIdx">`, leftSectionOverlay);

fs.writeFileSync('src/modules/route-constructor/components/RouteCanvas.vue', canvasContent);

console.log('Clean fixes applied successfully!');
