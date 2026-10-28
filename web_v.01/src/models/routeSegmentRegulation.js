export class RouteSegmentRegulation {
    constructor(routeSegmentRegulationId, routeSegmentId, dayPeriodId, normTravelTime, minInterval, maxInterval) {
        this.routeSegmentRegulationId = routeSegmentRegulationId;
        this.routeSegmentId = routeSegmentId;
        this.dayPeriodId = dayPeriodId;
        this.normTravelTime = normTravelTime; // нормований час в дорозі (хв)
        this.minInterval = minInterval; // мінімальний інтервал (хв)
        this.maxInterval = maxInterval; // максимальний інтервал (хв)
    }
}
