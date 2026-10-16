/**
 * routeGeometry.js
 * Mathematical model for the oval (stadium-shaped) transit route diagram.
 *
 * Coordinate system:
 *   - Center of oval at (0, 0)
 *   - Right rail at x = +RAIL_HALF   (forward direction, going DOWN)
 *   - Left  rail at x = -RAIL_HALF   (return direction, going UP)
 *   - First node (top terminus) at y = 0
 *   - Last  node (bottom terminus) at y = totalH
 *
 * Clockwise travel (screen coords, y↓):
 *   DOWN the right rail → around bottom cap (LEFT) → UP the left rail → around top cap (RIGHT)
 */

import { calculateBranchLevels, getBranchDxForLevel, getMaxBranchLevel } from './branchLevelModel.js';

export const OVAL_DEFAULTS = {
  RAIL_HALF : 96,   // half-width between rail centers (3 * 32px grid)
  RAIL_W    :  9,   // stroke-width of rails and caps
  CAP_R     : 96,   // radius of semicircle caps (matches RAIL_HALF)
  SEG_BASE  : 64,   // minimum height of a segment
  STOP_H    :  32,  // additional height per stop
  END_R     :  15,  // radius of terminus node circle
  CTRL_R    :  10,  // radius of control node circle
};

export function splitStopName(name, maxLength = 20) {
  if (!name || typeof name !== 'string') return [name || ''];
  const trimmed = name.trim();
  if (trimmed.length <= maxLength) return [trimmed];
  
  const words = trimmed.split(/\s+/);
  if (words.length <= 1) return [trimmed];

  let bestIdx = 1;
  let minScore = Infinity;

  for (let i = 1; i < words.length; i++) {
    const l1 = words.slice(0, i).join(' ');
    const l2 = words.slice(i).join(' ');
    const overPenalty = l1.length > maxLength ? (l1.length - maxLength) * 3 : 0;
    const balanceDiff = Math.abs(l1.length - l2.length);
    const score = overPenalty + balanceDiff;

    if (score < minScore) {
      minScore = score;
      bestIdx = i;
    }
  }

  const line1 = words.slice(0, bestIdx).join(' ');
  const line2 = words.slice(bestIdx).join(' ');
  return [line1, line2];
}

export function isStopMultiline(stopOrName) {
  const name = typeof stopOrName === 'string' ? stopOrName : (stopOrName?.name || '');
  return splitStopName(name).length > 1;
}

export function getStopHeight(stopOrName) {
  return isStopMultiline(stopOrName) ? 64 : 32;
}

export class OvalLayout {
  constructor(nodes, segments, branches = [], opts = {}) {
    this.nodes = nodes || [];
    this.segments = segments || [];
    this.branches = branches || [];
    this.isBranchMode = opts.isBranchMode || false;
    Object.assign(this, OVAL_DEFAULTS, opts);

    // Calculate branch nesting levels (Level 1..N)
    this._branchLevels = calculateBranchLevels(this.branches, this.segments, this.nodes);

    // Pre-compute once at construction time for O(1) property access
    this._rightNodes = this.nodes.filter(n => !n.side || n.side === 'right');
    this._leftNodes = this.nodes.filter(n => n.side === 'left');
    this._rightSegments = this.segments.filter(s => s.side === 'right' || (!s.side && this.segments.indexOf(s) < Math.ceil(this.segments.length / 2)));
    this._leftSegments = this.segments.filter(s => s.side === 'left' || (!s.side && this.segments.indexOf(s) >= Math.ceil(this.segments.length / 2)));

    // Calculate initial right node Ys
    this._rightNodeY = this._computeRightYs(this._rightSegments);
    let botPadding = (this.editable !== false && !this.isBranchMode) ? 160 : 0; // completely remove space when not editable or in branch mode
    let botY = this._rightNodeY[this._rightNodeY.length - 1] + botPadding;
    
    // Calculate left node Ys based on current botY
    this._leftNodeY = this._computeLeftYs(this._leftSegments, botY);
    
    // If the top left node gets too close to topY, the left rail needs more space.
    let topPadding = (this.editable !== false && !this.isBranchMode) ? 160 : 0;
    if (this._leftNodeY[0] < this.topY + topPadding) {
      const deficit = (this.topY + topPadding) - this._leftNodeY[0];
      botY += deficit;
      this._leftNodeY = this._computeLeftYs(this._leftSegments, botY);
    }
    
    this._botY = botY;
  }

  get rightX() { return  this.RAIL_HALF; }
  get leftX()  { return -this.RAIL_HALF; }

  // Cached getters for O(1) property access
  get rightNodes()    { return this._rightNodes; }
  get leftNodes()     { return this._leftNodes; }
  get rightSegments() { return this._rightSegments; }
  get leftSegments()  { return this._leftSegments; }
  get branchLevels()  { return this._branchLevels; }

  getBranchLevel(b) { return this._branchLevels[b?.id] || 1; }
  getBranchDx(b) { return getBranchDxForLevel(b, this._branchLevels, this.segments); }

  getBranchRequiredHeight(b) {
    const sections = b.sections || [];
    const nodeCount = (b.nodes || []).length;
    const sectionCount = Math.max(nodeCount + 1, 1);
    let totalStopsHeight = 0;
    for (let si = 0; si < sectionCount; si++) {
      const stops = sections[si]?.stops || [];
      totalStopsHeight += stops.reduce((acc, st) => acc + getStopHeight(st), 0);
    }
    const isEditable = (this.editable !== false && !this.isBranchMode);
    const pillsHeight = isEditable ? sectionCount * 32 : 0;
    const nodesHeight = nodeCount * 32;
    const finishExtra = !b.finished ? 48 : 0;
    return Math.max(96, 64 + totalStopsHeight + pillsHeight + nodesHeight + finishExtra);
  }

  getBranchPadding(segIdx, ignoreFarBranches = false) {
    const segBranches = (segIdx !== undefined) ? this.branches.filter(b => b.segIdx === segIdx) : [];
    let branchPadding = 0;
    segBranches.forEach(b => {
      if (ignoreFarBranches && b.finished && b.targetType && b.targetType !== 'current') {
        return;
      }
      let branchHeight = this.getBranchRequiredHeight(b);
      
      // Ensure finished branches have grid-aligned height
      if (b.finished) {
        branchHeight = Math.max(112, branchHeight);
      }

      // Sub-branches inside this branch
      const subBrs = this.branches.filter(sb => sb.parentBranchId === b.id);
      const subBrPadding = subBrs.reduce((acc, sb) => {
        const sbSections = sb.sections || [];
        const sbNodeCount = (sb.nodes || []).length;
        const sbSectionCount = Math.max(sbNodeCount + 1, 1);
        let sbH = sb.finished ? 100 : 50;
        for (let si = 0; si < sbSectionCount; si++) {
          sbH += ((sbSections[si]?.stops || []).length) * 32 + 25;
        }
        return acc + sbH;
      }, 0);
      branchPadding += branchHeight + subBrPadding;
    });
    return branchPadding;
  }

  _getBranchTargetSegIdx(b, sideSegments = null) {
    const segs = sideSegments || this.segments;
    if (!b || !segs) return b?.segIdx ?? 0;
    if (b.targetStopId) {
      const idx = segs.findIndex(s => s.stops && s.stops.some(st => String(st.id) === String(b.targetStopId)));
      if (idx !== -1) return idx;
    }
    if (b.targetNodeId && b.targetType !== 'bottom_arc') {
      const idx = segs.findIndex(s => String(s.nextNodeId) === String(b.targetNodeId));
      if (idx !== -1) return idx;
    }
    if (sideSegments && b.segIdx !== undefined && this.segments && this.segments[b.segIdx]) {
      const pId = this.segments[b.segIdx].id;
      const idx = sideSegments.findIndex(s => String(s.id) === String(pId));
      if (idx !== -1) return idx;
    }
    return b.segIdx ?? 0;
  }

  _getActiveMergeBranches(seg, segIdx) {
    if (!this.branches || !this.branches.length) return [];
    const actualSegIdx = (segIdx !== undefined) 
      ? segIdx 
      : (seg ? this.segments.indexOf(seg) : -1);
    if (actualSegIdx === -1) return [];

    const matches = this.branches.filter(b => {
      if (!b || b.targetType === 'bottom_arc') return false;
      const targetSegIdx = this._getBranchTargetSegIdx(b);
      return targetSegIdx === actualSegIdx;
    });

    // Sort by branch level ascending (Level 1 first, Level 2 second, etc.)
    matches.sort((a, b) => (this.getBranchLevel(a) - this.getBranchLevel(b)));
    return matches;
  }

  getSegmentLayout(seg, segIdx, isRight = true) {
    const globalSegIdx = seg
      ? this.segments.findIndex(s => String(s.id) === String(seg.id))
      : ((segIdx !== undefined) ? segIdx : -1);
    const sideSegments = isRight ? this._rightSegments : this._leftSegments;
    const sideSegIdx = (seg && sideSegments)
      ? sideSegments.findIndex(s => String(s.id) === String(seg.id))
      : ((segIdx !== undefined) ? segIdx : -1);
    
    const isBranchMode = !!this.isBranchMode;
    const hasBranchStart = this.branches && this.branches.some(b => b.segIdx === globalSegIdx);
    const topOffset = (isBranchMode || hasBranchStart) ? 64 : 32;
    const bottomOffset = (isBranchMode || hasBranchStart) ? 64 : 32;
    const isEditable = this.editable !== false && !isBranchMode;
    const stops = (seg && seg.stops) ? seg.stops : [];
    
    const mergeBrs = this._getActiveMergeBranches(seg, globalSegIdx);

    const slotBranches = new Map();
    for (let slot = 0; slot <= stops.length; slot++) {
      slotBranches.set(slot, []);
    }

    for (const br of mergeBrs) {
      let slot = stops.length;
      if (br.targetStopId && stops.length > 0) {
        const sIdx = stops.findIndex(st => String(st.id) === String(br.targetStopId));
        if (sIdx !== -1) {
          slot = sIdx;
        }
      } else if (!br.finished && br.segIdx === globalSegIdx) {
        slot = 0;
      } else if (br.targetType === 'node' || br.targetNodeId) {
        slot = stops.length;
      }
      slotBranches.get(slot).push(br);
    }

    for (const [slot, brs] of slotBranches.entries()) {
      brs.sort((a, b) => (this.getBranchLevel(a) - this.getBranchLevel(b)));
    }

    const layoutResult = {
      stops: new Map(),
      merges: new Map(),
      pills: [],
      totalHeight: 0
    };

    if (isRight) {
      const topY = (this._rightNodeY && sideSegIdx !== -1 && this._rightNodeY[sideSegIdx] !== undefined)
        ? this._rightNodeY[sideSegIdx]
        : 0;

      let currentY = topY + topOffset;

      for (let slot = 0; slot <= stops.length; slot++) {
        const brs = slotBranches.get(slot) || [];

        // 0. Pill BEFORE slot 0 merges (inside the loop between node and first merge)
        if (slot === 0 && isEditable && brs.some(b => b.finished)) {
          layoutResult.pills.push({
            id: `pill-${globalSegIdx}-0-before`,
            y: currentY,
            insertIdx: 0,
            isAfterMerge: false,
            title: 'Додати зупинку'
          });
          currentY += 32;
        }

        // 1. Merges at this slot
        if (brs.length > 0) {
          for (let k = 0; k < brs.length; k++) {
            const br = brs[k];
            const brH = this.getBranchRequiredHeight(br);
            const isSameSeg = (br.segIdx === globalSegIdx);
            const parentSeg = this.segments[br.segIdx];
            const brSIdx = parentSeg ? (this._rightSegments ? this._rightSegments.findIndex(s => String(s.id) === String(parentSeg.id)) : br.segIdx) : br.segIdx;
            const brStartY = (this._rightNodeY && this._rightNodeY[brSIdx] !== undefined) ? this._rightNodeY[brSIdx] : topY;

            let neededY = currentY;
            if (isSameSeg) {
              neededY = Math.max(currentY, topY + brH);
            } else {
              neededY = Math.max(currentY, brStartY + brH);
            }

            const mergeY = neededY;
            layoutResult.merges.set(br.id, {
              mergeY: mergeY,
              turnY: mergeY,
              arrowY: mergeY + 15
            });
            currentY = mergeY + 32;
          }
        }

        // 2. Stop at this slot
        if (slot < stops.length) {
          const st = stops[slot];
          layoutResult.stops.set(String(st.id), { y: currentY });
          currentY += getStopHeight(st);

          // If the next slot has a merge, add a pill for this section after this stop (BEFORE the merge)
          const nextSlotBrs = slotBranches.get(slot + 1) || [];
          if (isEditable && nextSlotBrs.some(b => b.finished)) {
            layoutResult.pills.push({
              id: `pill-${globalSegIdx}-${slot + 1}-before`,
              y: currentY,
              insertIdx: slot + 1,
              isAfterMerge: false,
              title: 'Додати зупинку'
            });
            currentY += 32;
          }
        } else if (slot === stops.length) {
          // 3. End of segment pill (after all stops and node merges)
          if (isEditable) {
            const hasNodeMerges = (slotBranches.get(stops.length) || []).some(b => b.finished);
            layoutResult.pills.push({
              id: `pill-${globalSegIdx}-${slot}-after`,
              y: currentY,
              insertIdx: slot,
              isAfterMerge: hasNodeMerges,
              title: 'Додати зупинку'
            });
            currentY += 32;
          }
        }
      }

      layoutResult.totalHeight = currentY - topY;
    } else {
      const botY = (this._leftNodeY && sideSegIdx !== -1 && this._leftNodeY[sideSegIdx + 1] !== undefined)
        ? this._leftNodeY[sideSegIdx + 1]
        : 0;

      let currentY = botY - bottomOffset;

      for (let slot = 0; slot <= stops.length; slot++) {
        const brs = slotBranches.get(slot) || [];

        // 0. Pill BEFORE slot 0 merges (inside the loop between node and first merge)
        if (slot === 0 && isEditable && brs.some(b => b.finished)) {
          layoutResult.pills.push({
            id: `pill-${globalSegIdx}-0-before`,
            y: currentY,
            insertIdx: 0,
            isAfterMerge: false,
            title: 'Додати зупинку'
          });
          currentY -= 32;
        }

        // 1. Merges at this slot
        if (brs.length > 0) {
          for (let k = 0; k < brs.length; k++) {
            const br = brs[k];
            const brH = this.getBranchRequiredHeight(br);
            const isSameSeg = (br.segIdx === globalSegIdx);
            const parentSeg = this.segments[br.segIdx];
            const brSIdx = parentSeg ? (this._leftSegments ? this._leftSegments.findIndex(s => String(s.id) === String(parentSeg.id)) : br.segIdx) : br.segIdx;
            const brStartY = (this._leftNodeY && this._leftNodeY[brSIdx + 1] !== undefined) ? this._leftNodeY[brSIdx + 1] : botY;

            let neededY = currentY;
            if (isSameSeg) {
              neededY = Math.min(currentY, botY - brH);
            } else {
              neededY = Math.min(currentY, brStartY - brH);
            }

            const mergeY = neededY;
            layoutResult.merges.set(br.id, {
              mergeY: mergeY,
              turnY: mergeY,
              arrowY: mergeY - 15
            });
            currentY = mergeY - 32;
          }
        }

        // 2. Stop at this slot
        if (slot < stops.length) {
          const st = stops[slot];
          layoutResult.stops.set(String(st.id), { y: currentY });
          currentY -= getStopHeight(st);

          const nextSlotBrs = slotBranches.get(slot + 1) || [];
          if (isEditable && nextSlotBrs.some(b => b.finished)) {
            layoutResult.pills.push({
              id: `pill-${globalSegIdx}-${slot + 1}-before`,
              y: currentY,
              insertIdx: slot + 1,
              isAfterMerge: false,
              title: 'Додати зупинку'
            });
            currentY -= 32;
          }
        } else if (slot === stops.length) {
          if (isEditable) {
            const hasNodeMerges = (slotBranches.get(stops.length) || []).some(b => b.finished);
            layoutResult.pills.push({
              id: `pill-${globalSegIdx}-${slot}-after`,
              y: currentY,
              insertIdx: slot,
              isAfterMerge: hasNodeMerges,
              title: 'Додати зупинку'
            });
            currentY -= 32;
          }
        }
      }

      layoutResult.totalHeight = botY - currentY;
    }

    return layoutResult;
  }

  getBranchMergeY(br, isRight = true) {
    if (!br) return 0;
    if (br.targetType === 'bottom_arc') return this.botY;

    const targetSegIdx = this._getBranchTargetSegIdx(br);
    const targetSeg = this.segments[targetSegIdx];
    if (!targetSeg) return 0;

    const layout = this.getSegmentLayout(targetSeg, targetSegIdx, isRight);
    const mergeInfo = layout.merges.get(br.id);
    return mergeInfo ? mergeInfo.mergeY : (isRight ? 0 : this.botY);
  }

  getSegmentPills(seg, segIdx, isRight = true) {
    const actualSegIdx = (segIdx !== undefined) ? segIdx : (seg ? this.segments.indexOf(seg) : -1);
    const layout = this.getSegmentLayout(seg, actualSegIdx, isRight);
    return layout.pills;
  }

  _segH(seg, isLastSeg, segIdx, ignoreFarBranches = false) {
    const isLeft = (seg && seg.side === 'left');
    const actualSegIdx = (segIdx !== undefined) ? segIdx : (seg ? this.segments.indexOf(seg) : -1);
    const layout = this.getSegmentLayout(seg, actualSegIdx, !isLeft);
    return layout.totalHeight;
  }

  _computeRightYs(segs) {
    let ys = [this.topY];
    this._rightNodeY = ys;
    for (let i = 0; i < segs.length; i++) {
      const isLast = (i === segs.length - 1);
      const actualSegIdx = this.segments.findIndex(s => s.id === segs[i].id);
      ys.push(ys[i] + this._segH(segs[i], isLast, actualSegIdx, true));
    }
    
    let changed = true;
    let iterations = 0;
    while (changed && iterations++ < 50) {
      changed = false;
      for (let b of this.branches) {
        if (b.side === 'left') continue;
        const parentSeg = this.segments[b.segIdx];
        const sIdx = parentSeg ? this._rightSegments.findIndex(s => String(s.id) === String(parentSeg.id)) : (b.segIdx ?? 0);
        if (sIdx === -1) continue;

        const brH = this.getBranchRequiredHeight(b);
        const startY = ys[sIdx];

        if (b.finished && (b.targetStopId || b.targetType !== 'bottom_arc')) {
          const targetSegIdx = this._getBranchTargetSegIdx(b, this._rightSegments);
          if (targetSegIdx !== -1) {
            const targetSeg = this._rightSegments[targetSegIdx];
            const actualTargetSegIdx = this.segments.findIndex(s => s.id === targetSeg.id);
            const minSegH = this._segH(targetSeg, targetSegIdx === this._rightSegments.length - 1, actualTargetSegIdx, true);
            
            if (ys[targetSegIdx + 1] - ys[targetSegIdx] < minSegH) {
              const diff = minSegH - (ys[targetSegIdx + 1] - ys[targetSegIdx]);
              for (let k = targetSegIdx + 1; k < ys.length; k++) ys[k] += diff;
              changed = true;
            }
          }
        } else if (!b.finished || (!b.targetType || b.targetType === 'current')) {
          const targetIdx = sIdx + 1;
          if (targetIdx < ys.length) {
            const currentH = ys[targetIdx] - startY;
            if (currentH < brH) {
              const diff = brH - currentH;
              for (let k = targetIdx; k < ys.length; k++) ys[k] += diff;
              changed = true;
            }
          }
        } else if (b.finished && b.targetType === 'bottom_arc') {
          const targetIdx = ys.length - 1;
          if (targetIdx > sIdx) {
            const currentH = ys[targetIdx] - startY;
            if (currentH < brH) {
              const diff = brH - currentH;
              for (let k = targetIdx; k < ys.length; k++) ys[k] += diff;
              changed = true;
            }
          }
        }
      }
    }
    return ys;
  }

  _computeLeftYs(segs, botY) {
    const n = segs.length;
    let ys = new Array(n + 1);
    ys[n] = botY;
    this._leftNodeY = ys;
    for (let i = n - 1; i >= 0; i--) {
      const isLast = (i === n - 1);
      const actualSegIdx = this.segments.findIndex(s => s.id === segs[i].id);
      ys[i] = ys[i + 1] - this._segH(segs[i], isLast, actualSegIdx, true);
    }
    
    let changed = true;
    let iterations = 0;
    while (changed && iterations++ < 50) {
      changed = false;
      for (let b of this.branches) {
        if (b.side !== 'left') continue;
        const parentSeg = this.segments[b.segIdx];
        const sIdx = parentSeg ? this._leftSegments.findIndex(s => String(s.id) === String(parentSeg.id)) : (b.segIdx ?? 0);
        if (sIdx === -1) continue;

        const brH = this.getBranchRequiredHeight(b);
        const startY = ys[sIdx + 1];

        if (b.finished && (b.targetStopId || b.targetType !== 'bottom_arc')) {
          const targetSegIdx = this._getBranchTargetSegIdx(b, this._leftSegments);
          if (targetSegIdx !== -1) {
            const targetSeg = this._leftSegments[targetSegIdx];
            const actualTargetSegIdx = this.segments.findIndex(s => s.id === targetSeg.id);
            const minSegH = this._segH(targetSeg, targetSegIdx === this._leftSegments.length - 1, actualTargetSegIdx, true);

            if (ys[targetSegIdx + 1] - ys[targetSegIdx] < minSegH) {
              const diff = minSegH - (ys[targetSegIdx + 1] - ys[targetSegIdx]);
              for (let k = 0; k <= targetSegIdx; k++) ys[k] -= diff;
              changed = true;
            }
          }
        } else if (!b.finished || (!b.targetType || b.targetType === 'current')) {
          const targetIdx = sIdx;
          if (targetIdx >= 0) {
            const currentH = startY - ys[targetIdx];
            if (currentH < brH) {
              const diff = brH - currentH;
              for (let k = 0; k <= targetIdx; k++) ys[k] -= diff;
              changed = true;
            }
          }
        } else if (b.finished && b.targetType === 'bottom_arc') {
          const targetIdx = 0;
          if (targetIdx < sIdx) {
            const currentH = startY - ys[targetIdx];
            if (currentH < brH) {
              const diff = brH - currentH;
              for (let k = 0; k <= targetIdx; k++) ys[k] -= diff;
              changed = true;
            }
          }
        }
      }
    }
    return ys;
  }

  get rightNodeY() { return this._rightNodeY; }
  get leftNodeY()  { return this._leftNodeY; }

  get topY() { return 0; }
  get botY() { return this._botY; }
  get totalH() { return this._botY; }

  getMergeStopId(segIdx) {
    if (!this.branches) return null;
    const seg = this.segments ? this.segments[segIdx] : null;
    const br = this.branches.find(b => b.finished && (b.bypassedMainState || b.targetType === 'current' || b.targetStopId) && (b.segIdx === segIdx || (b.targetStopId && seg && seg.stops && seg.stops.some(st => String(st.id) === String(b.targetStopId)))));
    return br ? br.targetStopId : null;
  }

  // Distribute stops properly between top and bot node Ys
  stopY(seg, top, bot, stIdx, isLastSeg, segIdx) {
    const stops = (seg && seg.stops) ? seg.stops : [];
    if (!stops[stIdx]) return (top + bot) / 2;
    const isLeft = (seg && seg.side === 'left');
    const actualSegIdx = (segIdx !== undefined) ? segIdx : (seg ? this.segments.indexOf(seg) : -1);
    const layout = this.getSegmentLayout(seg, actualSegIdx, !isLeft);
    const stopInfo = layout.stops.get(String(stops[stIdx].id));
    return stopInfo ? stopInfo.y : ((top + bot) / 2);
  }

  // Positioning Add Stop & Add Branch buttons
  getRightAddBranchY(seg, top, bot, isLastSeg) {
    return top + 32;
  }
  getRightAddStopY(seg, top, bot, isLastSeg, segIdx) {
    const pills = this.getSegmentPills(seg, segIdx, true);
    return pills.length > 0 ? pills[pills.length - 1].y : (top + 64);
  }

  getLeftAddStopY(seg, top, bot, isLastSeg, segIdx) {
    const pills = this.getSegmentPills(seg, segIdx, false);
    return pills.length > 0 ? pills[pills.length - 1].y : (bot - 64);
  }

  getRightIntervalY(seg, top, bot, isLastSeg, segIdx) {
    const actualSegIdx = (segIdx !== undefined) ? segIdx : (seg ? this.segments.indexOf(seg) : -1);
    const layout = this.getSegmentLayout(seg, actualSegIdx, true);
    if (layout.merges && layout.merges.size > 0) {
      const firstMergeY = [...layout.merges.values()][0]?.mergeY;
      if (firstMergeY && Math.abs(firstMergeY - top) >= 48) {
        return (top + firstMergeY) / 2;
      }
    }
    return (top + bot) / 2;
  }

  getLeftIntervalY(seg, top, bot, isLastSeg, segIdx) {
    const actualSegIdx = (segIdx !== undefined) ? segIdx : (seg ? this.segments.indexOf(seg) : -1);
    const layout = this.getSegmentLayout(seg, actualSegIdx, false);
    if (layout.merges && layout.merges.size > 0) {
      const firstMergeY = [...layout.merges.values()][0]?.mergeY;
      if (firstMergeY && Math.abs(bot - firstMergeY) >= 48) {
        return (bot + firstMergeY) / 2;
      }
    }
    return (top + bot) / 2;
  }

  getLeftAddBranchY(seg, top, bot, isLastSeg, segIdx) {
    return this.getLeftAddStopY(seg, top, bot, isLastSeg, segIdx);
  }



  getRightAddNodeY(bot) {
    return bot - 32;
  }
  getLeftAddNodeY(bot) {
    return bot - 32;
  }

  // Cap Paths
  get topCapPath() {
    const y = this.topY;
    return `M ${this.rightX} ${y} A ${this.CAP_R} ${this.CAP_R} 0 0 0 ${this.leftX} ${y}`;
  }

  get botCapPath() {
    const y = this.botY;
    // Sweep-flag 0 ensures the arc bows DOWNWARD correctly
    return `M ${this.leftX} ${y} A ${this.CAP_R} ${this.CAP_R} 0 0 0 ${this.rightX} ${y}`;
  }

  get dirArrows() {
    const midY = (this.topY + this.botY) / 2;
    return [
      { x: this.rightX + 20, y: midY,                           rotate:  90 },
      { x: 0,                y: this.botY + this.CAP_R + 20,    rotate: 180 },
      { x: this.leftX - 20,  y: midY,                           rotate: 270 },
      { x: 0,                y: this.topY - this.CAP_R - 20,    rotate:   0 },
    ];
  }

  isCapSegment(sIdx) {
    // Left for backwards compatibility if needed
    return false;
  }
}
