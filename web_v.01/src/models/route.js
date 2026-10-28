export class Route {
    constructor(routeId, routeNumber) {
        this.routeId = routeId;
        this.routeNumber = routeNumber;
        this.segments = []; // масив RouteSegment
    }
}
