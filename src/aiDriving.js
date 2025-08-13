// aiDriving.js
export class AIDriving {
  constructor(ai) {
    // ai = referencja do instancji AICar
    this.ai = ai;
  }

  // Zwraca bezpieczny waypoint (kopia oryginalnej logiki)
  _getSafeTarget() {
    const currentWP = this.ai.waypoints[this.ai.currentWaypointIndex];
    if (!this._isWaypointInDangerZone(currentWP)) {
      return currentWP;
    }

    const maxSkip = 3; // zgodnie z oryginałem

    for (let i = 1; i <= maxSkip; i++) {
      const index = (this.ai.currentWaypointIndex + i) % this.ai.waypoints.length;
      const wp = this.ai.waypoints[index];

      if (!this._isWaypointInDangerZone(wp)) {
        const angleToWP = Math.atan2(wp.y - this.ai.carY, wp.x - this.ai.carX);
        const angleDiff = Math.abs(this.ai._normalizeAngle(angleToWP - this.ai.getAngle()));

        if (angleDiff < 0.8) {
          console.log(`[AI] Skipping to safe WP ${index} (${i} ahead)`);
          this.ai.currentWaypointIndex = index;
          this.ai.waypointStability.lastChangeTime = Date.now();
          return wp;
        }
      }
    }

    console.log('[AI] No safe WP found ahead, sticking to current');
    return currentWP;
  }

  _isWaypointInDangerZone(waypoint) {
    for (const zone of this.ai.dangerZones) {
      const dist = Math.hypot(waypoint.x - zone.x, waypoint.y - zone.y);
      if (dist < this.ai.dangerZoneRadius) {
        return true;
      }
    }
    return false;
  }

  _isInDangerZone() {
    for (const zone of this.ai.dangerZones) {
      const dist = Math.hypot(this.ai.carX - zone.x, this.ai.carY - zone.y);
      if (dist < this.ai.dangerZoneRadius) {
        return true;
      }
    }
    return false;
  }

  _addDangerZone(x, y) {
    const zone = {
      x,
      y,
      time: Date.now(),
      collisions: 1
    };

    for (const existingZone of this.ai.dangerZones) {
      const dist = Math.hypot(x - existingZone.x, y - existingZone.y);
      if (dist < this.ai.dangerZoneRadius) {
        existingZone.collisions++;
        existingZone.time = Date.now();
        console.log(`[AI] Updated danger zone (${existingZone.collisions} collisions)`);
        return;
      }
    }

    this.ai.dangerZones.push(zone);
    console.log(`[AI] Added danger zone at (${x.toFixed(0)}, ${y.toFixed(0)})`);

    if (this.ai.dangerZones.length > this.ai.maxDangerZones) {
      this.ai.dangerZones.shift();
    }
  }

  _cleanupDangerZones() {
    const now = Date.now();
    this.ai.dangerZones = this.ai.dangerZones.filter(zone => {
      return (now - zone.time) < this.ai.dangerZoneAvoidTime;
    });
  }

  _enterDesperateMode() {
    this.ai.desperateMode = true;
    // używamy wartości z config, ale to ta sama wartość co w oryginale (5.0)
    this.ai.desperateModeTimer = this.ai.config.desperateMode.timer;
    console.log('[AI] DESPERATE MODE ACTIVATED');
  }

  _updateDesperateMode(dt) {
    if (this.ai.desperateMode) {
      this.ai.desperateModeTimer -= dt;
      if (this.ai.desperateModeTimer <= 0) {
        this.ai.desperateMode = false;
        console.log('[AI] Desperate mode ended');
      }
    }
  }

  _handleDesperateMode(dt, state) {
    const lookahead = Math.max(1, Math.min(3, Math.floor(state.speed / 60)));
    const targetIndex = (this.ai.currentWaypointIndex + lookahead) % this.ai.waypoints.length;
    const targetWP = this.ai.waypoints[targetIndex];

    const angleToTarget = Math.atan2(targetWP.y - this.ai.carY, targetWP.x - this.ai.carX);
    const angleDiff = this.ai._normalizeAngle(angleToTarget - state.carAngle);

    const steer = Phaser.Math.Clamp(angleDiff * 0.15, -0.1, 0.1);

    return {
      left: steer < -0.01,
      right: steer > 0.01,
      up: true,
      down: false
    };
  }

  _checkWaypointCompletion() {
    const currentWP = this.ai.waypoints[this.ai.currentWaypointIndex];
    const dist = Math.hypot(
      currentWP.x - this.ai.carX,
      currentWP.y - this.ai.carY
    );

    if (dist < this.ai.waypointZoneRadius) {
      const prevIndex = this.ai.currentWaypointIndex;
      this.ai.currentWaypointIndex = (this.ai.currentWaypointIndex + 1) % this.ai.waypoints.length;
      this.ai.waypointStability.lastChangeTime = Date.now();
      // console.log(`[AI] WP ${prevIndex} -> ${this.ai.currentWaypointIndex}`);
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
          this._addDangerZone(this.ai.carX, this.ai.carY);
          this._enterDesperateMode();
          this.ai.stuckDetector.stuckTime = 0;
        }
      } else {
        this.ai.stuckDetector.stuckTime = 0;
      }

      this.ai.stuckDetector.lastPosition = { ...currentPos };
      this.ai.stuckDetector.positionTimer = 0;
    }
  }

  // expose dangerZones for external checks (AICar.handleCollision uses it)
  get dangerZones() {
    return this.ai.dangerZones;
  }
}