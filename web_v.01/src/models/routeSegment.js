export class RouteSegment {
    constructor(routeSegmentId, routeId, fromControlPointId, toControlPointId) {
        this.routeSegmentId = routeSegmentId;
        this.routeId = routeId;
        this.fromControlPointId = fromControlPointId;
        this.toControlPointId = toControlPointId;
        this.segmentStops = []; // масив SegmentStop
        this.regulations = []; // масив RouteSegmentRegulation
    }
}
