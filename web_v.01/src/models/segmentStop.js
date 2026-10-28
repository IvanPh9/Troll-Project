export class SegmentStop {
    constructor(segmentStopId, routeSegmentId, stopId, sequenceNumber, description) {
        this.segmentStopId = segmentStopId;
        this.routeSegmentId = routeSegmentId;
        this.stopId = stopId;
        this.sequenceNumber = sequenceNumber; // порядковий номер на відрізку
        this.description = description;
    }
}
