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
  RAIL_HALF : 100,   // half-width between rail centers
  RAIL_W    :  9,   // stroke-width of rails and caps
  CAP_R     : 100,   // radius of semicircle caps
  SEG_BASE  : 90,   // minimum height of a segment
  STOP_H    :  32,  // additional height per stop
  END_R     :  15,  // radius of terminus node circle
  CTRL_R    :  10,  // radius of control node circle
};

export class OvalLayout {
  constructor(nodes, segments, branches = [], opts = {}) {
    this.nodes = nodes || [];
    this.segments = segments || [];
    this.branches = branches || [];
    Object.assign(this, OVAL_DEFAULTS, opts);

    // Pre-compute once at construction time for O(1) property access
    this._rightNodes = this.nodes.filter(n => !n.side || n.side === 'right');
    this._leftNodes = this.nodes.filter(n => !n.side || n.side === 'left');
    this._rightSegments = this.segments.filter(s => !s.side || s.side === 'right');
    this._leftSegments = this.segments.filter(s => !s.side || s.side === 'left');

    this._rightNodeY = this._computeRightYs(this._rightSegments);

    const rightTotalH = this._rightNodeY[this._rightNodeY.length - 1] ?? 0;

    let leftTotalH = 0;
    for (let i = 0; i < this._leftSegments.length; i++) {
      const isLast = (i === this._leftSegments.length - 1);
      const actualSegIdx = this.segments.findIndex(s => s.id === this._leftSegments[i].id);
      leftTotalH += this._segH(this._leftSegments[i], isLast, actualSegIdx);
    }

    this._botY = Math.max(rightTotalH + 60, leftTotalH + 60, this.SEG_BASE);

    // Left rail accumulates UPWARDS from botY towards topY (0)
    this._leftNodeY = this._computeLeftYs(this._leftSegments, this._botY);
  }

  get rightX() { return  this.RAIL_HALF; }
  get leftX()  { return -this.RAIL_HALF; }

  // Cached getters for O(1) property access
  get rightNodes()    { return this._rightNodes; }
  get leftNodes()     { return this._leftNodes; }
  get rightSegments() { return this._rightSegments; }
  get leftSegments()  { return this._leftSegments; }

  _segH(seg, isLast, segIdx) {
    const base = isLast ? this.SEG_BASE + 50 : this.SEG_BASE;
    const segBranches = (segIdx !== undefined) ? this.branches.filter(b => b.segIdx === segIdx) : [];
    let branchPadding = 0;
    segBranches.forEach(b => {
      const nodeCount = b.nodes ? b.nodes.length : 0;
      const sections = b.sections || [];
      let bStopsCount = (b.stops ? b.stops.length : 0);
      sections.forEach(s => { bStopsCount += (s.stops ? s.stops.length : 0); });
      const subBrs = this.branches.filter(sb => sb.parentBranchId === b.id);
      const subBrPadding = subBrs.reduce((acc, sb) => acc + 220 + (sb.nodes ? sb.nodes.length : 0) * 140, 0);
      const branchHeight = 140 * (nodeCount + 1) + bStopsCount * 30 + subBrPadding;
      branchPadding += b.finished ? branchHeight : (branchHeight + 160);
    });
    return base + ((seg && seg.stops) ? seg.stops.length : 0) * this.STOP_H + branchPadding;
  }

  _computeRightYs(segs) {
    let ys = [this.topY];
    for (let i = 0; i < segs.length; i++) {
      const isLast = (i === segs.length - 1);
      const actualSegIdx = this.segments.findIndex(s => s.id === segs[i].id);
      ys.push(ys[i] + this._segH(segs[i], isLast, actualSegIdx));
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
      const h = this._segH(segs[i], isLast, actualSegIdx);
      ys[i] = ys[i + 1] - h;
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
    const segBranches = (segIdx !== undefined) ? this.branches.filter(b => b.segIdx === segIdx) : [];
    const isLeft = seg && seg.side === 'left';

    let branchOffset = 0;
    segBranches.forEach(b => {
      const nodeCount = b.nodes ? b.nodes.length : 0;
      branchOffset += b.finished ? (55 + nodeCount * 40) : (200 + nodeCount * 80);
    });

    let padTop = 45;
    let padBot = isLastSeg ? 95 : 45;

    if (isLeft) {
      // Left side branches are placed near bot, so add padding to padBot
      padBot += branchOffset;
    } else {
      // Right side branches are placed near top, so add padding to padTop
      padTop += branchOffset;
    }

    const avail = Math.max(40, (bot - top) - padTop - padBot);
    const step = avail / (n + 1);
    return top + padTop + step * (stIdx + 1);
  }

  // Positioning Add Stop & Add Branch buttons
  getRightAddBranchY(seg, top, bot, isLastSeg) {
    return top + 36;
  }
  getRightAddStopY(seg, top, bot, isLastSeg) {
    const n = seg.stops ? seg.stops.length : 0;
    if (n === 0) return top + 30; // smaller distance for empty segment
    return top + 45 + (n - 1) * 32 + 45; // tightly packed after last stop
  }

  getLeftAddStopY(seg, top, bot, isLastSeg) {
    return top + 45; // Pushed down to avoid overlap with "+ Додати ділянку" (which is at top + 20)
  }
  getLeftAddBranchY(seg, top, bot, isLastSeg) {
    return top + 45;
  }

  getLeftIntervalY(seg, top, bot, isLastSeg) {
    const n = seg.stops ? seg.stops.length : 0;
    const mid = (top + bot) / 2;
    if (n % 2 !== 0) {
      const padTop = 45;
      const padBot = isLastSeg ? 95 : 45;
      const avail = (bot - top) - padTop - padBot;
      const step = avail / (n + 1);
      return mid - step / 2;
    }
    return mid;
  }

  getRightAddNodeY(bot) {
    return bot - 30;
  }
  getLeftAddNodeY(bot) {
    return bot - 30;
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
