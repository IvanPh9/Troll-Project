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

export const OVAL_DEFAULTS = {
  RAIL_HALF : 96,   // half-width between rail centers (3 * 32px grid)
  RAIL_W    :  9,   // stroke-width of rails and caps
  CAP_R     : 96,   // radius of semicircle caps (matches RAIL_HALF)
  SEG_BASE  : 64,   // minimum height of a segment
  STOP_H    :  32,  // additional height per stop
  END_R     :  15,  // radius of terminus node circle
  CTRL_R    :  10,  // radius of control node circle
};

export class OvalLayout {
  constructor(nodes, segments, branches = [], opts = {}) {
    this.nodes = nodes || [];
    this.segments = segments || [];
    this.branches = branches || [];
    this.isBranchMode = opts.isBranchMode || false;
    Object.assign(this, OVAL_DEFAULTS, opts);

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

  getBranchRequiredHeight(b) {
    const sections = b.sections || [];
    const nodeCount = (b.nodes || []).length;
    const sectionCount = Math.max(nodeCount + 1, 1);
    let totalStops = 0;
    for (let si = 0; si < sectionCount; si++) {
      totalStops += (sections[si]?.stops || []).length;
    }
    const isEditable = (this.editable !== false && !this.isBranchMode);
    const pillsHeight = isEditable ? sectionCount * 32 : 0;
    const nodesHeight = nodeCount * 32;
    return Math.max(112, 48 + totalStops * 32 + pillsHeight + nodesHeight + 32);
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

  _segH(seg, isLastSeg, segIdx, ignoreFarBranches = false) {
    const isBranchMode = !!this.isBranchMode;
    const isEditable = this.editable !== false && !isBranchMode;
    const base = 64;

    const hasBranchStart = this.branches && this.branches.some(b => b.segIdx === segIdx);
    const startBranchPadding = (!isBranchMode && hasBranchStart) ? 32 : 0;
    const stopsCount = (seg && seg.stops) ? seg.stops.length : 0;

    // Check if there is a branch merging into THIS segment or starting in THIS segment
    if (this.branches) {
      const activeBr = this.branches.find(b => 
        b.finished && 
        (b.bypassedMainState || b.targetType === 'current' || b.targetStopId) &&
        (b.segIdx === segIdx || (b.targetStopId && seg && seg.stops && seg.stops.some(st => String(st.id) === String(b.targetStopId))))
      );
      if (activeBr) {
        const brH = this.getBranchRequiredHeight(activeBr);
        const topOffset = (isBranchMode || hasBranchStart) ? 64 : 32;
        return topOffset + brH + stopsCount * this.STOP_H + (isEditable ? 32 : 0);
      }
    }

    const pillH = isEditable ? 32 : 0;
    return base + startBranchPadding + stopsCount * this.STOP_H + pillH;
  }

  _computeRightYs(segs) {
    let ys = [this.topY];
    for (let i = 0; i < segs.length; i++) {
      const isLast = (i === segs.length - 1);
      const actualSegIdx = this.segments.findIndex(s => s.id === segs[i].id);
      ys.push(ys[i] + this._segH(segs[i], isLast, actualSegIdx, true));
    }
    
    let changed = true;
    while (changed) {
      changed = false;
      for (let b of this.branches) {
        if (b.side !== 'right') continue;
        const parentSeg = this.segments[b.segIdx];
        const sIdx = parentSeg ? this._rightSegments.findIndex(s => String(s.id) === String(parentSeg.id)) : (b.segIdx ?? 0);
        if (sIdx === -1) continue;

        const brH = this.getBranchRequiredHeight(b);
        const startY = ys[sIdx];

        if (b.finished && b.targetStopId) {
          // Branch merges into a stop on the right rail
          const targetSegIdx = this._rightSegments.findIndex(s => s.stops && s.stops.some(st => String(st.id) === String(b.targetStopId)));
          if (targetSegIdx !== -1) {
            const targetSeg = this._rightSegments[targetSegIdx];
            const mergeIdx = targetSeg.stops.findIndex(st => String(st.id) === String(b.targetStopId));
            const isSameSeg = (targetSegIdx === sIdx);
            const isEditable = (this.editable !== false && !this.isBranchMode);
            const hasBranchStart = this.branches && this.branches.some(br => br.segIdx === this.segments.findIndex(s => s.id === targetSeg.id));
            const topOffset = (this.isBranchMode || hasBranchStart) ? 64 : 32;
            const preMergeH = topOffset + mergeIdx * 32 + (isEditable ? 32 : 0) + 16;
            const postMergeStops = targetSeg.stops.length - mergeIdx;
            const minSegH = isSameSeg 
              ? (topOffset + brH + (targetSeg.stops ? targetSeg.stops.length : 0) * 32 + (isEditable ? 32 : 0))
              : (preMergeH + postMergeStops * 32 + 32);

            if (ys[targetSegIdx + 1] - ys[targetSegIdx] < minSegH) {
              const diff = minSegH - (ys[targetSegIdx + 1] - ys[targetSegIdx]);
              for (let k = targetSegIdx + 1; k < ys.length; k++) ys[k] += diff;
              changed = true;
            }

            if (targetSegIdx > sIdx) {
              const mergeTargetY = ys[targetSegIdx] + preMergeH;
              if (mergeTargetY - startY < brH) {
                const diff = brH - (mergeTargetY - startY);
                for (let k = targetSegIdx; k < ys.length; k++) ys[k] += diff;
                changed = true;
              }
            }
          }
        } else if (b.finished && b.targetType === 'node' && b.targetNodeId) {
          const rightNodeIndex = this._rightNodes.findIndex(n => String(n.id) === String(b.targetNodeId));
          const targetIdx = rightNodeIndex !== -1 ? rightNodeIndex : -1;
          if (targetIdx !== -1 && targetIdx > sIdx) {
            const currentH = ys[targetIdx] - startY;
            if (currentH < brH) {
              const diff = brH - currentH;
              for (let k = targetIdx; k < ys.length; k++) ys[k] += diff;
              changed = true;
            }
          }
        } else if (b.finished && (!b.targetType || b.targetType === 'current')) {
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
    for (let i = n - 1; i >= 0; i--) {
      const isLast = (i === n - 1);
      const actualSegIdx = this.segments.findIndex(s => s.id === segs[i].id);
      ys[i] = ys[i + 1] - this._segH(segs[i], isLast, actualSegIdx, true);
    }
    
    let changed = true;
    while (changed) {
      changed = false;
      for (let b of this.branches) {
        if (b.side !== 'left') continue;
        const parentSeg = this.segments[b.segIdx];
        const sIdx = parentSeg ? this._leftSegments.findIndex(s => String(s.id) === String(parentSeg.id)) : (b.segIdx ?? 0);
        if (sIdx === -1) continue;

        const brH = this.getBranchRequiredHeight(b);
        const startY = ys[sIdx + 1];

        if (b.finished && b.targetStopId) {
          // Branch merges into a stop on the left rail
          const targetSegIdx = this._leftSegments.findIndex(s => s.stops && s.stops.some(st => String(st.id) === String(b.targetStopId)));
          if (targetSegIdx !== -1) {
            const targetSeg = this._leftSegments[targetSegIdx];
            const mergeIdx = targetSeg.stops.findIndex(st => String(st.id) === String(b.targetStopId));
            const isSameSeg = (targetSegIdx === sIdx);
            const isEditable = (this.editable !== false && !this.isBranchMode);
            const hasBranchStart = this.branches && this.branches.some(br => br.segIdx === this.segments.findIndex(s => s.id === targetSeg.id));
            const bottomOffset = (this.isBranchMode || hasBranchStart) ? 64 : 32;
            const preMergeH = bottomOffset + mergeIdx * 32 + (isEditable ? 32 : 0) + 16;
            const postMergeStops = targetSeg.stops.length - mergeIdx;
            const minSegH = isSameSeg 
              ? (bottomOffset + brH + (targetSeg.stops ? targetSeg.stops.length : 0) * 32 + (isEditable ? 32 : 0))
              : (preMergeH + postMergeStops * 32 + 32);

            if (ys[targetSegIdx + 1] - ys[targetSegIdx] < minSegH) {
              const diff = minSegH - (ys[targetSegIdx + 1] - ys[targetSegIdx]);
              for (let k = 0; k <= targetSegIdx; k++) ys[k] -= diff;
              changed = true;
            }

            if (targetSegIdx < sIdx) {
              const mergeTargetY = ys[targetSegIdx + 1] - preMergeH;
              const currentDist = startY - mergeTargetY;
              if (currentDist < brH) {
                const diff = brH - currentDist;
                for (let k = 0; k <= targetSegIdx + 1; k++) ys[k] -= diff;
                changed = true;
              }
            }
          }
        } else if (b.finished && b.targetType === 'node' && b.targetNodeId) {
          const leftNodeIndex = this._leftNodes.findIndex(n => String(n.id) === String(b.targetNodeId));
          const targetIdx = leftNodeIndex !== -1 ? leftNodeIndex + 1 : -1;
          if (targetIdx !== -1 && targetIdx <= sIdx) {
            const currentH = startY - ys[targetIdx];
            if (currentH < brH) {
              const diff = brH - currentH;
              for (let k = 0; k <= targetIdx; k++) ys[k] -= diff;
              changed = true;
            }
          }
        } else if (b.finished && (!b.targetType || b.targetType === 'current')) {
          const targetIdx = sIdx;
          const currentH = startY - ys[targetIdx];
          if (currentH < brH) {
            const diff = brH - currentH;
            for (let k = 0; k <= targetIdx; k++) ys[k] -= diff;
            changed = true;
          }
        } else if (b.finished && b.targetType === 'bottom_arc') {
          const targetIdx = 0;
          const currentH = startY - ys[targetIdx];
          if (currentH < brH) {
            const diff = brH - currentH;
            for (let k = 0; k <= targetIdx; k++) ys[k] -= diff;
            changed = true;
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
    const n = (seg && seg.stops) ? seg.stops.length : 0;
    if (n === 0) return (top + bot) / 2;
    const isLeft = seg && seg.side === 'left';
    const isBranchMode = !!this.isBranchMode;

    const hasBranchStart = this.branches && this.branches.some(b => b.segIdx === segIdx);
    const topOffset = (isBranchMode || hasBranchStart) ? 64 : 32;
    const bottomOffset = (isBranchMode || hasBranchStart) ? 64 : 32;

    if (this.branches) {
      const activeBr = this.branches.find(b => 
        b.finished && 
        (b.bypassedMainState || b.targetType === 'current' || b.targetStopId) && 
        (b.segIdx === segIdx || (b.targetStopId && seg.stops && seg.stops.some(st => String(st.id) === String(b.targetStopId))))
      );
      if (activeBr) {
        let mergeIdx = -1;
        if (activeBr.targetStopId && seg.stops) {
          mergeIdx = seg.stops.findIndex(st => String(st.id) === String(activeBr.targetStopId));
        }
        if (mergeIdx === -1) {
          mergeIdx = 0;
        }
        const brH = this.getBranchRequiredHeight(activeBr);
        if (isLeft) {
          const mergeTargetY = bot - bottomOffset - brH;
          if (stIdx < mergeIdx) {
            return bot - bottomOffset - stIdx * 32;
          } else {
            return mergeTargetY - (stIdx - mergeIdx) * 32;
          }
        } else {
          const mergeTargetY = top + topOffset + brH;
          if (stIdx < mergeIdx) {
            return top + topOffset + stIdx * 32;
          } else {
            return mergeTargetY + (stIdx - mergeIdx) * 32;
          }
        }
      }
    }

    if (isLeft) {
      return bot - bottomOffset - stIdx * 32;
    } else {
      return top + topOffset + stIdx * 32;
    }
  }

  // Positioning Add Stop & Add Branch buttons
  getRightAddBranchY(seg, top, bot, isLastSeg) {
    return top + 32;
  }
  getRightAddStopY(seg, top, bot, isLastSeg, segIdx) {
    const hasBranchStart = this.branches && this.branches.some(b => b.segIdx === segIdx);
    const isBranchMode = !!this.isBranchMode;
    const topOffset = (isBranchMode || hasBranchStart) ? 64 : 32;
    const n = seg.stops ? seg.stops.length : 0;

    if (this.branches) {
      const activeBr = this.branches.find(b => 
        b.finished && 
        (b.bypassedMainState || b.targetType === 'current' || b.targetStopId) && 
        (b.segIdx === segIdx || (b.targetStopId && seg.stops && seg.stops.some(st => String(st.id) === String(b.targetStopId))))
      );
      if (activeBr) {
        let mergeIdx = -1;
        if (activeBr.targetStopId && seg.stops) {
          mergeIdx = seg.stops.findIndex(st => String(st.id) === String(activeBr.targetStopId));
        }
        if (mergeIdx === -1) {
          mergeIdx = 0;
        }
        const brH = this.getBranchRequiredHeight(activeBr);
        const mergeTargetY = top + topOffset + brH;
        return mergeTargetY + (n - mergeIdx) * 32;
      }
    }

    return top + topOffset + n * 32;
  }

  getLeftAddStopY(seg, top, bot, isLastSeg, segIdx) {
    const hasBranchStart = this.branches && this.branches.some(b => b.segIdx === segIdx);
    const isBranchMode = !!this.isBranchMode;
    const bottomOffset = (isBranchMode || hasBranchStart) ? 64 : 32;
    const n = seg.stops ? seg.stops.length : 0;

    if (this.branches) {
      const activeBr = this.branches.find(b => 
        b.finished && 
        (b.bypassedMainState || b.targetType === 'current' || b.targetStopId) && 
        (b.segIdx === segIdx || (b.targetStopId && seg.stops && seg.stops.some(st => String(st.id) === String(b.targetStopId))))
      );
      if (activeBr) {
        let mergeIdx = -1;
        if (activeBr.targetStopId && seg.stops) {
          mergeIdx = seg.stops.findIndex(st => String(st.id) === String(activeBr.targetStopId));
        }
        if (mergeIdx === -1) {
          mergeIdx = 0;
        }
        const brH = this.getBranchRequiredHeight(activeBr);
        const mergeTargetY = bot - bottomOffset - brH;
        return mergeTargetY - (n - mergeIdx) * 32;
      }
    }

    return bot - bottomOffset - n * 32;
  }

  getRightIntervalY(seg, top, bot, isLastSeg, segIdx) {
    const hasQuestionBr = this.branches && this.branches.some(b => 
      b.finished && 
      (!b.bypassedMainState || b.bypassedMainState === 'question') && 
      (b.segIdx === segIdx || (b.targetStopId && seg.stops && seg.stops.some(st => String(st.id) === String(b.targetStopId))))
    );
    if (hasQuestionBr) {
      return bot - 28;
    }

    if (seg.stops && seg.stops.length > 0) {
      return (top + bot) / 2;
    }
    if (isLastSeg) {
      return (top + bot) / 2;
    }
    if (this.editable === false) {
      if (segIdx === 0) return top + 8;
    }
    return top + 20;
  }

  getLeftIntervalY(seg, top, bot, isLastSeg, segIdx) {
    const hasQuestionBr = this.branches && this.branches.some(b => 
      b.finished && 
      (!b.bypassedMainState || b.bypassedMainState === 'question') && 
      (b.segIdx === segIdx || (b.targetStopId && seg.stops && seg.stops.some(st => String(st.id) === String(b.targetStopId))))
    );
    if (hasQuestionBr) {
      return top + 28;
    }

    if (seg.stops && seg.stops.length > 0) {
      return (top + bot) / 2;
    }
    if (isLastSeg) {
      return (top + bot) / 2;
    }
    if (this.editable === false) {
      const leftCount = this._leftSegments ? this._leftSegments.length : this.segments.filter(s => s.side === 'left').length;
      if (segIdx === 0) return top + 8;
    }
    return top + 20;
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
