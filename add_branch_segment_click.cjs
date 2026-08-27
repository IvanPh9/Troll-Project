const fs = require('fs');

// 1. Update RouteConstructor.vue
let constructorContent = fs.readFileSync('src/modules/route-constructor/RouteConstructor.vue', 'utf8');

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

// 2. Update RouteCanvas.vue
let canvasContent = fs.readFileSync('src/modules/route-constructor/components/RouteCanvas.vue', 'utf8');

// Add helper functions for branch section start/end Y and selectBranchSection
if (!canvasContent.includes('function selectBranchSection')) {
  const insertBefore = "function getBranchAddStopY";
  const newHelpers = `function selectBranchSection(br, secIdx = 0) {
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

  canvasContent = canvasContent.replace(insertBefore, newHelpers + insertBefore);
}

// Make branch path clickable and add clickable section overlays
// Right branch paths:
canvasContent = canvasContent.replace(
  `:d="getRightBranchFinishedPath(br, i).d"\n                  fill="none"`,
  `:d="getRightBranchFinishedPath(br, i).d"\n                  fill="none" style="cursor:pointer;" @click.stop="selectBranchSection(br, 0)"`
);
canvasContent = canvasContent.replace(
  `:d="getBranchOutPath(layout.rightX, layout.rightNodeY[i], getBranchDx(br), 1, 1, getBranchEndpointY(br, i, true))"\n                  fill="none"`,
  `:d="getBranchOutPath(layout.rightX, layout.rightNodeY[i], getBranchDx(br), 1, 1, getBranchEndpointY(br, i, true))"\n                  fill="none" style="cursor:pointer;" @click.stop="selectBranchSection(br, 0)"`
);

// Left branch paths:
canvasContent = canvasContent.replace(
  `:d="getLeftBranchFinishedPath(br, i).d"\n                  fill="none"`,
  `:d="getLeftBranchFinishedPath(br, i).d"\n                  fill="none" style="cursor:pointer;" @click.stop="selectBranchSection(br, 0)"`
);
canvasContent = canvasContent.replace(
  `:d="getBranchOutPath(layout.leftX, layout.leftNodeY[i+1], getBranchDx(br), -1, -1, getBranchEndpointY(br, i, false))"\n                  fill="none"`,
  `:d="getBranchOutPath(layout.leftX, layout.leftNodeY[i+1], getBranchDx(br), -1, -1, getBranchEndpointY(br, i, false))"\n                  fill="none" style="cursor:pointer;" @click.stop="selectBranchSection(br, 0)"`
);

// Add clickable section overlays for Right Branch sections
const rightSecOverlay = `<!-- Clickable Branch Section Overlay (Right) -->
              <rect :x="layout.rightX + getBranchDx(br) - 12"
                    :y="Math.min(getBranchSectionStartY(br, secIdx, i, true), getBranchSectionEndY(br, secIdx, i, true))"
                    width="24"
                    :height="Math.max(24, Math.abs(getBranchSectionEndY(br, secIdx, i, true) - getBranchSectionStartY(br, secIdx, i, true)))"
                    fill="transparent"
                    style="cursor: pointer;"
                    title="Налаштувати ділянку розгалудження"
                    @click.stop="selectBranchSection(br, secIdx - 1)" />

              <g v-for="(bStop, bStIdx) in getBranchSectionStops(br, secIdx)"`;

canvasContent = canvasContent.replace('<g v-for="(bStop, bStIdx) in getBranchSectionStops(br, secIdx)"', rightSecOverlay);

fs.writeFileSync('src/modules/route-constructor/components/RouteCanvas.vue', canvasContent);
console.log('Successfully added branch segment click handlers!');
