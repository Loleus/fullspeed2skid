// ai_modules/Navigation.js

export class Navigation {
  constructor(waypoints, config) {
    this.waypoints = waypoints;
    this.config = config;
    this.reset();
  }

  reset() {
    this.currentWaypointIndex = 0;
  }

  updateWaypointCompletion(carX, carY) {
    const currentWP = this.waypoints[this.currentWaypointIndex];
    const dist = Math.hypot(currentWP.x - carX, currentWP.y - carY);

    if (dist < this.config.WAYPOINT_ZONE_RADIUS) {
      this.currentWaypointIndex = (this.currentWaypointIndex + 1) % this.waypoints.length;
    }
  }

  getSafeTarget(car, dangerZoneManager) {
    const maxSkip = 3;
    for (let i = 0; i <= maxSkip; i++) {
      const index = (this.currentWaypointIndex + i) % this.waypoints.length;
      const wp = this.waypoints[index];
      if (!dangerZoneManager.isPointInDanger(wp)) {
        if (i > 0) {
            console.log(`[Navigation] Skipping to safe waypoint ${index}`);
            this.currentWaypointIndex = index;
        }
        return wp;
      }
    }
    // Jeśli wszystkie pobliskie są niebezpieczne, trzymaj się obecnego
    return this.waypoints[this.currentWaypointIndex];
  }
  
  skipWaypoints(count) {
      this.currentWaypointIndex = (this.currentWaypointIndex + count) % this.waypoints.length;
      console.log(`[Navigation] Skipped ${count} waypoints, new target is ${this.currentWaypointIndex}`);
  }

  getCurrentWaypoint() {
      return this.waypoints[this.currentWaypointIndex];
  }
}