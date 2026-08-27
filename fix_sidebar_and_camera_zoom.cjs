const fs = require('fs');

// 1. Update RouteConstructor.vue to support String IDs in activeSegment
let constructorContent = fs.readFileSync('src/modules/route-constructor/RouteConstructor.vue', 'utf8');

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
fs.writeFileSync('src/modules/route-constructor/RouteConstructor.vue', constructorContent);

// 2. Update RouteCanvas.vue to add camera zoom to selectBranchSection
let canvasContent = fs.readFileSync('src/modules/route-constructor/components/RouteCanvas.vue', 'utf8');

const oldSelectBranchSection = /function selectBranchSection\(br, secIdx = 0\)[\s\S]*?\n\}/;
const newSelectBranchSection = `function selectBranchSection(br, secIdx = 0, segIndex = 0, isRight = true) {
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
}`;

canvasContent = canvasContent.replace(oldSelectBranchSection, newSelectBranchSection);

// Update calls to selectBranchSection in template
canvasContent = canvasContent.replace(/selectBranchSection\(br, 0\)/g, "selectBranchSection(br, 0, i, true)");
canvasContent = canvasContent.replace(/selectBranchSection\(br, secIdx - 1\)/g, "selectBranchSection(br, secIdx - 1, i, true)");

// Update left side template calls for selectBranchSection
const leftBranchPathSectionRegex = /<!-- Left Branches for this Segment -->[\s\S]*?<!-- Finish Branch Icon \(Left\) -->/;
let leftSectionStr = canvasContent.substring(canvasContent.indexOf('<!-- Left Branches for this Segment -->'), canvasContent.indexOf('<!-- Finish Branch Icon (Left) -->'));
leftSectionStr = leftSectionStr.replace(/selectBranchSection\(br, 0, i, true\)/g, "selectBranchSection(br, 0, i, false)");
leftSectionStr = leftSectionStr.replace(/selectBranchSection\(br, secIdx - 1, i, true\)/g, "selectBranchSection(br, secIdx - 1, i, false)");

const leftStartIndex = canvasContent.indexOf('<!-- Left Branches for this Segment -->');
const leftEndIndex = canvasContent.indexOf('<!-- Finish Branch Icon (Left) -->');
canvasContent = canvasContent.substring(0, leftStartIndex) + leftSectionStr + canvasContent.substring(leftEndIndex);

fs.writeFileSync('src/modules/route-constructor/components/RouteCanvas.vue', canvasContent);
console.log('Successfully updated sidebar activeSegment matching and camera zoom!');
