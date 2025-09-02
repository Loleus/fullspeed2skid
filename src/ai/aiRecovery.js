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
        this.ai._enterDesperateMode();
        return { left: false, right: false, up: false, down: false };
    }

    // --- FAZA 0: SPRAWDZENIE WIDOCZNOŚCI ---
    if (this.ai.recoverySubPhase === 'check_visibility') {
        const currentWP = this.ai.waypoints[this.ai.currentWaypointIndex];
        
        if (this._canSeeWaypoint(currentWP)) {
            // Widzimy waypoint - możemy jechać normalnie
            console.log('[AI] Can see waypoint, resuming normal driving');
            this.ai.recoveryMode = false;
            this.ai.recoverySubPhase = 'normal';
            return { left: false, right: false, up: true, down: false };
        } else {
            // Nie widzimy waypointa - musimy się cofnąć
            console.log('[AI] Cannot see waypoint, need to reverse');
            this.ai.recoverySubPhase = 'reverse';
            this.ai.recoveryTimer = this.ai.config.recovery.reverseTimer;
            return { left: false, right: false, up: false, down: false };
        }
    }

    // --- FAZA 1: COFANIE ---
    if (this.ai.recoverySubPhase === 'reverse') {
        // Najpierw zwolnij gaz aby wyłączyć throttleLock
        if (this.ai.throttleLock) {
            return { left: false, right: false, up: false, down: false };
        }

        // Szukaj wyższego waypointa w zasięgu widoczności
        let bestWaypoint = null;
        let maxDistance = 0;
        
        for (let i = 0; i < this.ai.waypoints.length; i++) {
            const wp = this.ai.waypoints[i];
            const dist = Math.hypot(wp.x - this.ai.carX, wp.y - this.ai.carY);
            
            // Sprawdź czy waypoint jest "wyżej" niż obecny
            if (i > this.ai.currentWaypointIndex && dist > maxDistance && dist < this.ai.lookaheadDistance * 2) {
                bestWaypoint = wp;
                maxDistance = dist;
            }
        }

        // Jeśli znaleziono lepszy waypoint, skręć w jego kierunku podczas cofania
        if (bestWaypoint) {
            const angleToWp = Math.atan2(
                bestWaypoint.y - this.ai.carY,
                bestWaypoint.x - this.ai.carX
            );
            const angleDiff = this.ai._normalizeAngle(angleToWp - (state.carAngle + Math.PI)); // +PI bo cofamy
            this.ai.recoverySteer = Phaser.Math.Clamp(angleDiff * 0.5, -0.3, 0.3);
        } else {
            // Jeśli nie znaleziono lepszego waypointa, po prostu cofaj prosto
            this.ai.recoverySteer = 0;
        }

        // Sprawdź czy możemy zacząć cofać
        if (Math.abs(state.speed) < 1) {  // Jeśli prawie się zatrzymaliśmy
            return {
                left: this.ai.recoverySteer < -0.01,
                right: this.ai.recoverySteer > 0.01,
                up: false,
                down: true  // Rozpocznij cofanie
            };
        }

        // Po cofnięciu sprawdź ponownie widoczność
        if (state.speed < -5) {
            this.ai.recoverySubPhase = 'check_visibility';
            this.ai.recoveryTimer = 0.5; // Krótkie sprawdzenie
            return { left: false, right: false, up: false, down: false };
        }

        // Domyślnie czekaj na zatrzymanie
        return {
            left: false,
            right: false,
            up: false,
            down: false
        };
    }
    // --- FAZA 2: WYPROSTOWYWANIE SIĘ ---
    else if (this.ai.recoverySubPhase === 'reorient') {
        const targetWP = this.ai.waypoints[this.ai.currentWaypointIndex];
        const angleToTarget = Math.atan2(targetWP.y - this.ai.carY, targetWP.x - this.ai.carX);
        const angleDiff = this.ai._normalizeAngle(angleToTarget - state.carAngle);
        
        // Zwiększamy czułość sterowania w trybie reorientacji
        const steer = Phaser.Math.Clamp(angleDiff * 0.5, -0.4, 0.4);
        
        // Bardziej restrykcyjne warunki wyjścia z recovery
        if (this.ai.recoveryTimer <= 0 && Math.abs(angleDiff) < 0.2) {
            this.ai.recoveryMode = false;
            // Łagodniejsze przejście do normalnej jazdy
            return {
                left: steer < -0.01,
                right: steer > 0.01,
                up: Math.abs(angleDiff) < 0.3, // Mniejszy kąt dla gazu
                down: false
            };
        }

        return {
            left: steer < -0.01,
            right: steer > 0.01,
            up: Math.abs(angleDiff) < 0.4, // Większa tolerancja kąta podczas reorientacji
            down: false
        };
    }

    return { left: false, right: false, up: false, down: false };
  }

  _startSmartRecovery() {
    const state = this.ai.getFullState();

    this.ai.recoveryMode = true;
    this.ai.recoverySubPhase = 'check_visibility'; // Zacznij od sprawdzenia
    this.ai.recoveryTimer = 0.5; // Krótki czas na ocenę sytuacji
    this.ai.recoveryAttempts++;

    console.log(`[AI] Recovery STARTED (checking visibility first, attempt ${this.ai.recoveryAttempts})`);

    this.ai.stuckDetector.stuckTime = 0;
    this.ai.stuckDetector.positionTimer = 0;
    this.ai.stuckDetector.lastPosition = { x: this.ai.carX, y: this.ai.carY };
  }

  // Dodaj metodę sprawdzającą widoczność waypointa
  _canSeeWaypoint(waypoint) {
    const angleToWP = Math.atan2(waypoint.y - this.ai.carY, waypoint.x - this.ai.carX);
    const angleDiff = Math.abs(this.ai._normalizeAngle(angleToWP - this.ai.carAngle));
    
    // Waypoint jest "widoczny" jeśli:
    // 1. Jest w rozsądnym kącie przed nami (nie za plecami)
    // 2. Ścieżka do niego jest czysta
    return angleDiff < Math.PI/2 && this.ai.aiDriving._isPathSafe(waypoint);
  }
}