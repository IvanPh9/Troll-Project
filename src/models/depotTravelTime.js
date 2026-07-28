export class DepotTravelTime {
    constructor(depotTravelTimeId, routeId, depotStopId, controlPointId, travelTimeMinutes) {
        this.depotTravelTimeId = depotTravelTimeId;
        this.routeId = routeId;
        this.depotStopId = depotStopId;
        this.controlPointId = controlPointId;
        this.travelTimeMinutes = travelTimeMinutes;
    }
}
