// aiDriving.js
export class AIDriving {
  constructor(ai) {
    // ai = referencja do instancji AICar
    this.ai = ai;
  }

  // Zwraca aktualny cel
  _getSafeTarget() {
    return this.ai.waypoints[this.ai.currentWaypointIndex];
  }

  _checkWaypointCompletion() {
    const currentWP = this.ai.waypoints[this.ai.currentWaypointIndex];
    const dist = Math.hypot(
      currentWP.x - this.ai.carX,
      currentWP.y - this.ai.carY
    );

    if (dist < this.ai.waypointZoneRadius) {
      this.ai.currentWaypointIndex = (this.ai.currentWaypointIndex + 1) % this.ai.waypoints.length;
    }
  }

  _detectStuck(dt) {
    const currentPos = { x: this.ai.carX, y: this.ai.carY };
    this.ai.stuckDetector.positionTimer += dt;

    const checkInterval = this.ai.config.stuckDetector.positionCheckInterval;

    if (this.ai.stuckDetector.positionTimer >= checkInterval) {
      const distMoved = Math.hypot(
        currentPos.x - this.ai.stuckDetector.lastPosition.x,
        currentPos.y - this.ai.stuckDetector.lastPosition.y
      );

      if (distMoved < this.ai.stuckDetector.minMovementDistance) {
        this.ai.stuckDetector.stuckTime += checkInterval;
        console.log(`[AI] STUCK! Moved ${distMoved.toFixed(0)}px, stuck for ${this.ai.stuckDetector.stuckTime}s`);

        if (this.ai.stuckDetector.stuckTime >= this.ai.config.stuckDetector.stuckTimeThreshold) {
          console.log('[AI] STUCK! Resetting stuck timer');
          this.ai.stuckDetector.stuckTime = 0;
        }
      } else {
        this.ai.stuckDetector.stuckTime = 0;
      }

      this.ai.stuckDetector.lastPosition = { ...currentPos };
      this.ai.stuckDetector.positionTimer = 0;
    }
  }

  // Removed dangerZones getter
}