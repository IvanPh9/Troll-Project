/**
 * branchLevelModel.js
 * 
 * Computes topological nesting levels and lateral DX offsets for alternative branches.
 * 
 * Levels:
 * - Level 1: Closest to main rail (baseDx: 128px or 224px when bypassing stops/nodes)
 * - Level 2: Outer layer (384px = 224 + 160)
 * - Level K: Outer layer (224 + (K - 1) * 160)
 */

export function getBranchTargetSegIdx(b, allSegments) {
  if (!b || !allSegments || allSegments.length === 0) return b?.segIdx ?? 0;
  
  if (b.targetStopId) {
    const sIdx = allSegments.findIndex(s => s.stops && s.stops.some(st => String(st.id) === String(b.targetStopId)));
    if (sIdx !== -1) return sIdx;
  }
  
  if (b.targetNodeId && b.targetType !== 'bottom_arc') {
    const sIdx = allSegments.findIndex(s => String(s.nextNodeId) === String(b.targetNodeId));
    if (sIdx !== -1) return sIdx;
  }

  if (b.targetType === 'bottom_arc') {
    // For right side, bottom arc is at the end of the right rail
    const rightSegs = allSegments.filter(s => s.side === 'right' || (!s.side && allSegments.indexOf(s) < Math.ceil(allSegments.length / 2)));
    if (b.side !== 'left') {
      const lastRightSeg = rightSegs[rightSegs.length - 1];
      const idx = lastRightSeg ? allSegments.indexOf(lastRightSeg) : allSegments.length - 1;
      return idx !== -1 ? idx : (b.segIdx ?? 0);
    } else {
      // For left side, bottom arc is at the first segment of the left rail
      const leftSegs = allSegments.filter(s => s.side === 'left' || (!s.side && allSegments.indexOf(s) >= Math.ceil(allSegments.length / 2)));
      const firstLeftSeg = leftSegs[0];
      const idx = firstLeftSeg ? allSegments.indexOf(firstLeftSeg) : 0;
      return idx !== -1 ? idx : (b.segIdx ?? 0);
    }
  }

  if (b.segIdx !== undefined && allSegments[b.segIdx]) {
    return b.segIdx;
  }

  return b.segIdx ?? 0;
}

export function getBranchSpan(b, allSegments) {
  if (!b) return [0, 0];
  const sIdx = b.segIdx ?? 0;
  const targetIdx = b.finished ? getBranchTargetSegIdx(b, allSegments) : sIdx;
  return [Math.min(sIdx, targetIdx), Math.max(sIdx, targetIdx)];
}

export function doSpansOverlap(spanA, spanB) {
  return Math.max(spanA[0], spanB[0]) <= Math.min(spanA[1], spanB[1]);
}

/**
 * Calculates topological levels (1, 2, 3...) for all branches on the route.
 * 
 * @param {Array} branches - Array of branch objects
 * @param {Array} segments - Array of main route segments
 * @param {Array} nodes - Array of main route nodes
 * @returns {Object} Map of branchId -> level (integer >= 1)
 */
export function calculateBranchLevels(branches = [], segments = [], nodes = []) {
  const levels = {};
  if (!branches || branches.length === 0) return levels;

  // Separate by side (Right vs Left)
  const rightBranches = branches.filter(b => b.side !== 'left' && !b.parentBranchId);
  const leftBranches = branches.filter(b => b.side === 'left' && !b.parentBranchId);
  const subBranches = branches.filter(b => !!b.parentBranchId);

  function assignLevelsForSide(sideBranches) {
    if (sideBranches.length === 0) return;

    // Calculate span for each branch
    const withSpans = sideBranches.map(b => ({
      branch: b,
      span: getBranchSpan(b, segments),
      isBottomArc: b.targetType === 'bottom_arc'
    }));

    // Sort: shorter/inner spans first, bottom_arc last
    withSpans.sort((a, b) => {
      if (a.isBottomArc && !b.isBottomArc) return 1;
      if (!a.isBottomArc && b.isBottomArc) return -1;
      const lenA = a.span[1] - a.span[0];
      const lenB = b.span[1] - b.span[0];
      if (lenA !== lenB) return lenA - lenB;
      return a.span[0] - b.span[0];
    });

    const assigned = [];

    for (const item of withSpans) {
      const b = item.branch;
      const span = item.span;

      // Find all previously assigned branches that overlap with this branch
      const overlapping = assigned.filter(prev => doSpansOverlap(span, prev.span));
      const usedLevels = new Set(overlapping.map(prev => levels[prev.branch.id]));

      // Determine minimum level: must be higher than any strictly contained inner branch
      let minLevel = 1;
      for (const prev of overlapping) {
        const prevSpan = prev.span;
        const isStrictlyContained = (prevSpan[0] >= span[0] && prevSpan[1] <= span[1] && (prevSpan[0] > span[0] || prevSpan[1] < span[1]));
        if (isStrictlyContained || (item.isBottomArc && !prev.isBottomArc)) {
          const prevLvl = levels[prev.branch.id] || 1;
          if (prevLvl >= minLevel) {
            minLevel = prevLvl + 1;
          }
        }
      }

      let chosenLevel = minLevel;
      while (usedLevels.has(chosenLevel)) {
        chosenLevel++;
      }

      levels[b.id] = chosenLevel;
      assigned.push(item);
    }
  }

  assignLevelsForSide(rightBranches);
  assignLevelsForSide(leftBranches);

  // Sub-branches (hierarchical child branches)
  for (const sb of subBranches) {
    const parentLvl = levels[sb.parentBranchId] || 1;
    levels[sb.id] = parentLvl + 1;
  }

  return levels;
}

export function doesBranchBypassMainContent(br, allSegments = []) {
  if (!br || !br.finished || !allSegments || allSegments.length === 0) {
    return false;
  }

  const startSegIdx = br.segIdx ?? 0;
  const targetSegIdx = getBranchTargetSegIdx(br, allSegments);

  // If the branch spans across different segments (or to bottom_arc),
  // there is at least one control node inside the bypassed main rail section.
  if (targetSegIdx !== startSegIdx || br.targetType === 'bottom_arc') {
    return true;
  }

  // Same segment: check if there are any stops on the main rail inside the loop (before the merge point).
  const seg = allSegments[startSegIdx];
  const stops = seg?.stops || [];
  if (stops.length === 0) {
    return false;
  }

  if (br.targetStopId) {
    const mergeStopIdx = stops.findIndex(st => String(st.id) === String(br.targetStopId));
    if (mergeStopIdx !== -1) {
      return mergeStopIdx > 0;
    }
  }

  // If merging into the segment's end control node (or no targetStopId while stops exist on the segment),
  // all stops on this segment are inside the loop.
  return stops.length > 0;
}

/**
 * Computes the lateral DX offset for a branch given its assigned level.
 * 
 * @param {Object} br - Branch object
 * @param {Object|number} levelsOrLevel - Level number or levels map
 * @param {Array} allSegments - Segments array
 * @returns {number} Lateral offset in pixels
 */
export function getBranchDxForLevel(br, levelsOrLevel = 1, allSegments = []) {
  if (!br) return 112;
  const level = (typeof levelsOrLevel === 'number') 
    ? levelsOrLevel 
    : (levelsOrLevel && br.id && levelsOrLevel[br.id] ? levelsOrLevel[br.id] : 1);

  const numericLevel = Number(level) || 1;
  const hasMainContentInside = doesBranchBypassMainContent(br, allSegments);
  const baseDx = hasMainContentInside ? 224 : 112;
  // Half offset (112px) when no stops/control nodes inside on main rail; Full offset (224px) when main rail has stops/nodes inside (+ 224px per outer level)
  return baseDx + Math.round((numericLevel - 1) * 224);
}

export function getMaxBranchLevel(branches = [], levels = {}) {
  let maxRight = 1;
  let maxLeft = 1;
  for (const b of branches) {
    const lvl = levels[b.id] || 1;
    if (b.side === 'left') {
      if (lvl > maxLeft) maxLeft = lvl;
    } else {
      if (lvl > maxRight) maxRight = lvl;
    }
  }
  return { maxRight, maxLeft, maxOverall: Math.max(maxRight, maxLeft) };
}
