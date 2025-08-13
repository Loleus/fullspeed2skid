// ai_modules/StuckDetector.js

export class StuckDetector {
  constructor(config) {
    this.config = config;
    this.reset({ x: 0, y: 0 });
  }

  reset(position) {
    this.lastPosition = { ...position };
    this.positionTimer = 0;
    this.stuckTime = 0;
    this.isStuck = false;
  }

  update(dt, currentPos) {
    this.positionTimer += dt;

    if (this.positionTimer >= this.config.STUCK_CHECK_INTERVAL) {
      const distMoved = Math.hypot(
        currentPos.x - this.lastPosition.x,
        currentPos.y - this.lastPosition.y
      );

      if (distMoved < this.config.STUCK_MIN_MOVEMENT_DISTANCE) {
        this.stuckTime += this.config.STUCK_CHECK_INTERVAL;
        console.log(`[StuckDetector] Potentially stuck! Moved ${distMoved.toFixed(0)}px`);
        
        if (this.stuckTime >= this.config.STUCK_TIME_TO_TRIGGER_DESPERATE) {
            this.isStuck = true; // Sygnalizuj, że trzeba podjąć drastyczne środki
        }
      } else {
        // Reset, jeśli samochód się porusza
        this.stuckTime = 0;
        this.isStuck = false;
      }

      this.lastPosition = { ...currentPos };
      this.positionTimer = 0;
    }
  }
}