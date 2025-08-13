// aiRecovery.js
export class AIRecovery {
  constructor(ai) {
    this.ai = ai;
  }

  _handleSmarterRecovery(dt, state) {
    this.ai.recoveryTimer -= dt;

    if (this.ai.recoveryTimer <= 0 || this.ai.recoveryAttempts > this.ai.maxRecoveryAttempts) {
        console.log('[AI] Recovery FAILED - timeout or max attempts reached. Entering desperate mode.');
        this.ai.recoveryMode = false;
        this.ai.recoveryAttempts = 0;
        this.ai.recoverySubPhase = 'normal';
        // we delegate entering desperate mode to driving module via AICar wrapper
        this.ai._enterDesperateMode();
        return { left: false, right: false, up: false, down: false };
    }

    // --- FAZA 1: COFANIE Z KOREKTĄ KURSU ---
    if (this.ai.recoverySubPhase === 'reverse') {
        const reverseThrottle = 0.5;
        const prevWp = this.ai.waypoints[(this.ai.currentWaypointIndex - 1 + this.ai.waypoints.length) % this.ai.waypoints.length];
        const angleToPrevWp = Math.atan2(
            prevWp.y - this.ai.carY,
            prevWp.x - this.ai.carX
        );
        const angleDiff = this.ai._normalizeAngle(angleToPrevWp - state.carAngle);
        
        this.ai.recoverySteer = Phaser.Math.Clamp(angleDiff * 0.5, -0.3, 0.3);

        if (state.speed < 2 || Math.abs(state.speed) < 5) {
            this.ai.recoverySubPhase = 'reorient';
            this.ai.recoveryTimer = this.ai.config.recovery.reorientTimer;
            return { left: false, right: false, up: false, down: false };
        }

        return {
            left: this.ai.recoverySteer < -0.01,
            right: this.ai.recoverySteer > 0.01,
            up: false,
            down: true
        };
    }
    // --- FAZA 2: WYPROSTOWYWANIE SIĘ ---
    else if (this.ai.recoverySubPhase === 'reorient') {
        const targetWP = this.ai.waypoints[this.ai.currentWaypointIndex];
        const angleToTarget = Math.atan2(targetWP.y - this.ai.carY, targetWP.x - this.ai.carX);
        const angleDiff = this.ai._normalizeAngle(angleToTarget - state.carAngle);
        
        const steer = Phaser.Math.Clamp(angleDiff * 0.3, -0.2, 0.2);
        
        if (this.ai.recoveryTimer <= 0 || Math.abs(angleDiff) < 0.3) {
            this.ai.recoveryMode = false;
            return { left: false, right: false, up: true, down: false };
        }

        return {
            left: steer < -0.01,
            right: steer > 0.01,
            up: Math.abs(angleDiff) < 0.5,
            down: false
        };
    }

    return { left: false, right: false, up: false, down: false };
  }

  _startSmartRecovery() {
    const state = this.ai.getFullState();

    this.ai.recoveryMode = true;
    this.ai.recoverySubPhase = 'reverse';
    this.ai.recoveryTimer = this.ai.config.recovery.reverseTimer;
    this.ai.recoveryAttempts++;

    console.log(`[AI] Recovery STARTED (phase: reverse, attempt ${this.ai.recoveryAttempts})`);

    const currentSpeed = Math.hypot(state.v_x, state.v_y);
    if (currentSpeed > 10) {
      this.ai.recoverySteer = -Math.sign(state.carAngle);
    } else {
      this.ai.recoverySteer = 0;
    }

    this.ai.stuckDetector.stuckTime = 0;
    this.ai.stuckDetector.positionTimer = 0;
    this.ai.stuckDetector.lastPosition = { x: this.ai.carX, y: this.ai.carY };
  }
}