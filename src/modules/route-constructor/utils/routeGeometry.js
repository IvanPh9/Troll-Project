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
    this._leftNodes = this.nodes.filter(n => !n.side || n.side === 'left');
    this._rightSegments = this.segments.filter(s => !s.side || s.side === 'right');
    this._leftSegments = this.segments.filter(s => !s.side || s.side === 'left');

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

  getBranchPadding(segIdx, ignoreFarBranches = false) {
    const segBranches = (segIdx !== undefined) ? this.branches.filter(b => b.segIdx === segIdx) : [];
    let branchPadding = 0;
    segBranches.forEach(b => {
      if (ignoreFarBranches && b.finished && b.targetType && b.targetType !== 'current') {
        return;
      }
      const sections = b.sections || [];
      const nodeCount = (b.nodes || []).length;
      const sectionCount = Math.max(nodeCount + 1, 1);
      const isType1 = b.mergeConfigured === 'add_inside';
      const isType2 = b.finished && b.targetType && b.targetType !== 'current';
      const dx = (isType1 || isType2) ? 190 : 45;
      let branchHeight = 64; // 64px diagonal/vertical curve clearance
      for (let si = 0; si < sectionCount; si++) {
        const stopsInSection = (sections[si]?.stops || []).length;
        branchHeight += stopsInSection * 32;
        if (this.editable !== false) {
          branchHeight += 32; // Space for the Add Pill
        }
      }
      if (nodeCount > 0) branchHeight += nodeCount * 32;
      
      // Ensure finished branches have grid-aligned height: 96 (out) + 32 (vertical) + 64 (merge in) = 192px
      if (b.finished) {
        branchHeight = Math.max(128, branchHeight + 32);
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
    const base = this.editable !== false ? 64 : 32;
    const branchPadding = this.getBranchPadding(segIdx, ignoreFarBranches);
    return base + ((seg && seg.stops) ? seg.stops.length : 0) * this.STOP_H + branchPadding;
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
        const sIdx = b.segIdx ?? 0;
        
        let brH = 96;
        const sectionCount = Math.max((b.nodes || []).length + 1, 1);
        for (let si = 0; si < sectionCount; si++) {
           const stopsCount = (b.sections?.[si]?.stops || []).length;
           brH += stopsCount * 32;
        }
        const nodeCount = (b.nodes || []).length;
        if (nodeCount > 0) brH += nodeCount * 32;
        if (b.finished) brH = Math.max(128, brH + 32);
        
        let targetIdx = -1;
        if (b.finished && b.targetType === 'node' && b.targetNodeId) {
           targetIdx = this.nodes.findIndex(n => n.id === b.targetNodeId);
        } else if (b.finished && b.targetType === 'bottom_arc') {
           targetIdx = ys.length - 1;
        }
        
        if (targetIdx !== -1 && targetIdx > sIdx) {
           const currentH = ys[targetIdx] - ys[sIdx];
           if (currentH < brH) {
             const diff = brH - currentH;
             for(let k = targetIdx; k < ys.length; k++) ys[k] += diff;
             changed = true;
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
    while(changed) {
      changed = false;
      for (let b of this.branches) {
        if (b.side !== 'left') continue;
        const sIdx = b.segIdx ?? 0;
        
        let brH = 48 + 25; 
        const sectionCount = Math.max((b.nodes || []).length + 1, 1);
        for (let si = 0; si < sectionCount; si++) {
           const stopsCount = (b.sections?.[si]?.stops || []).length;
           brH += (stopsCount > 0 ? (35 + stopsCount * 32) : 25);
        }
        const nodeCount = (b.nodes || []).length;
        if (nodeCount > 0) brH += nodeCount * 28;
        if (b.finished) brH = Math.max(135, brH);
        
        let targetIdx = -1;
        if (b.finished && b.targetType === 'node' && b.targetNodeId) {
           targetIdx = this.nodes.findIndex(n => n.id === b.targetNodeId);
        } else if (b.finished && b.targetType === 'bottom_arc') {
           targetIdx = 0;
        }
        
        if (targetIdx !== -1 && targetIdx <= sIdx) {
           const currentH = ys[sIdx + 1] - ys[targetIdx];
           if (currentH < brH) {
             const diff = brH - currentH;
             for (let k = sIdx + 1; k <= n; k++) ys[k] += diff;
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

  // Distribute stops properly between top and bot node Ys
  stopY(seg, top, bot, stIdx, isLastSeg, segIdx) {
    const n = (seg && seg.stops) ? seg.stops.length : 0;
    if (n === 0) return (top + bot) / 2;
    const isLeft = seg && seg.side === 'left';
    const isBranchMode = !!this.isBranchMode;

    const branchOffset = this.getBranchPadding(segIdx);

    if (isLeft) {
      // On left rail, travel is UPWARD (from bot to top).
      // bot is the lower control node Y.
      // In branch mode, offset stops 64px ABOVE bot so the UP-LEFT (-26px) spur button sits in clear space.
      const bottomOffset = isBranchMode ? 64 : 32;
      return bot - branchOffset - bottomOffset - 32 * (n - 1 - stIdx);
    } else {
      // On right rail, travel is DOWNWARD (from top to bot).
      // In branch mode, offset stops 64px BELOW top so the DOWN-RIGHT (+26px) spur button sits in clear space.
      const topOffset = isBranchMode ? 64 : 32;
      return top + branchOffset + topOffset + 32 * stIdx;
    }
  }

  // Positioning Add Stop & Add Branch buttons
  getRightAddBranchY(seg, top, bot, isLastSeg) {
    return top + 36;
  }
  getRightAddStopY(seg, top, bot, isLastSeg, segIdx) {
    const pad = this.getBranchPadding(segIdx);
    const n = seg.stops ? seg.stops.length : 0;
    const isBranchMode = !!this.isBranchMode;
    const topOffset = isBranchMode ? 64 : 32;
    return top + pad + topOffset + 32 * n;
  }

  getLeftAddStopY(seg, top, bot, isLastSeg, segIdx) {
    // Pill is placed at exactly 32px from the top (before the highest stop)
    return top + 32; 
  }
  getRightIntervalY(seg, top, bot, isLastSeg, segIdx) {
    if (seg.stops && seg.stops.length > 0) {
      return (top + bot) / 2;
    }
    if (this.editable === false) {
      if (isLastSeg) return top + 24; // shift down towards bottom curve
      if (segIdx === 0) return top + 8; // shift up towards top curve
    }
    return top + 16;
  }

  getLeftIntervalY(seg, top, bot, isLastSeg, segIdx) {
    if (seg.stops && seg.stops.length > 0) {
      return (top + bot) / 2;
    }
    if (this.editable === false) {
      const leftCount = this._leftSegments ? this._leftSegments.length : this.segments.filter(s => s.side === 'left').length;
      if (segIdx === leftCount - 1) return top + 24; // shift down towards bottom curve
      if (segIdx === 0) return top + 8; // shift up towards top curve
    }
    return top + 16;
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
