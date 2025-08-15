// aiRecovery.js
export class AIRecovery {
  constructor(ai) {
    this.ai = ai;
  }

  _handleSmarterRecovery(dt, state) {
    this.ai.recoveryTimer -= dt;

    // Sprawdź czy waypointy są w zasięgu
    const currentWP = this.ai.waypoints[this.ai.currentWaypointIndex];
    const distToWP = Math.hypot(currentWP.x - this.ai.carX, currentWP.y - this.ai.carY);
    const angleToWP = Math.atan2(currentWP.y - this.ai.carY, currentWP.x - this.ai.carX);
    const angleDiff = this.ai._normalizeAngle(angleToWP - state.carAngle);
    
    // Jeśli waypoint jest w zasięgu i droga jest prosta - wyjdź z recovery
    if (distToWP < this.ai.lookaheadDistance * 2.0 && Math.abs(angleDiff) < Math.PI/3) {
        console.log(`[AI] Recovery EXIT - WP in range (${distToWP.toFixed(0)}px), angle=${Phaser.Math.RadToDeg(angleDiff).toFixed(1)}°`);
        this.ai.recoveryMode = false;
        this.ai.recoveryAttempts = 0;
        return { left: false, right: false, up: false, down: false };
    }

    if (this.ai.recoveryTimer <= 0 || this.ai.recoveryAttempts > this.ai.maxRecoveryAttempts) {
        console.log('[AI] Recovery FAILED - timeout or max attempts reached. Entering desperate mode.');
        this.ai.recoveryMode = false;
        this.ai.recoveryAttempts = 0;
        this.ai.recoverySubPhase = 'normal';
        this.ai._enterDesperateMode();
        return { left: false, right: false, up: false, down: false };
    }

    // --- FAZA 1: CZEKANIE ---
    if (this.ai.recoverySubPhase === 'wait') {
        console.log(`[AI] Recovery: czekanie, timer=${this.ai.recoveryTimer.toFixed(1)}`);
        
        // Po zakończeniu czekania przejdź do cofania
        if (this.ai.recoveryTimer <= 0) {
            this.ai.recoverySubPhase = 'reverse';
            this.ai.recoveryTimer = 2.0; // 2 sekundy cofania
            console.log(`[AI] Recovery: przejście do cofania`);
        }
        
        return { left: false, right: false, up: false, down: false };
    }
    // --- FAZA 2: COFANIE ---
    else if (this.ai.recoverySubPhase === 'reverse') {
        // Sprawdź kierunek do waypointa i skręć w odpowiednią stronę
        const angleToWp = Math.atan2(currentWP.y - this.ai.carY, currentWP.x - this.ai.carX);
        const angleDiff = this.ai._normalizeAngle(angleToWp - (state.carAngle + Math.PI)); // +PI bo cofamy
        
        // Łagodniejsze sterowanie podczas cofania
        this.ai.recoverySteer = Phaser.Math.Clamp(angleDiff * 0.3, -0.2, 0.2);

        console.log(`[AI] Recovery: cofanie, timer=${this.ai.recoveryTimer.toFixed(1)}, steer=${this.ai.recoverySteer.toFixed(2)}`);
        
        // Po zakończeniu cofania przejdź do reorientacji
        if (this.ai.recoveryTimer <= 0) {
            this.ai.recoverySubPhase = 'reorient';
            this.ai.recoveryTimer = 3.0; // 3 sekundy orientacji
            console.log(`[AI] Recovery: przejście do reorientacji`);
        }

        return {
            left: this.ai.recoverySteer < -0.01,
            right: this.ai.recoverySteer > 0.01,
            up: false,
            down: true  // Cofaj
        };
    }
    // --- FAZA 3: WYPROSTOWYWANIE SIĘ ---
    else if (this.ai.recoverySubPhase === 'reorient') {
        const targetWP = this.ai.waypoints[this.ai.currentWaypointIndex];
        const angleToTarget = Math.atan2(targetWP.y - this.ai.carY, targetWP.x - this.ai.carX);
        const angleDiff = this.ai._normalizeAngle(angleToTarget - state.carAngle);
        
        // Łagodniejsze sterowanie w trybie reorientacji
        const steer = Phaser.Math.Clamp(angleDiff * 0.3, -0.2, 0.2);
        
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

    // Sprawdź czy waypointy są w zasięgu
    const currentWP = this.ai.waypoints[this.ai.currentWaypointIndex];
    const distToWP = Math.hypot(currentWP.x - this.ai.carX, currentWP.y - this.ai.carY);
    const angleToWP = Math.atan2(currentWP.y - this.ai.carY, currentWP.x - this.ai.carX);
    const angleDiff = this.ai._normalizeAngle(angleToWP - state.carAngle);
    
    // Jeśli waypoint jest w zasięgu i droga jest prosta - nie włączaj recovery
    if (distToWP < this.ai.lookaheadDistance * 2.0 && Math.abs(angleDiff) < Math.PI/3) {
        console.log(`[AI] Recovery NOT NEEDED - WP in range (${distToWP.toFixed(0)}px), angle=${Phaser.Math.RadToDeg(angleDiff).toFixed(1)}°`);
        return {
            left: false,
            right: false,
            up: true, // Kontynuuj jazdę
            down: false
        };
    }

    this.ai.recoveryMode = true;
    this.ai.recoverySubPhase = 'wait'; // Zmieniamy fazę na czekanie
    this.ai.recoveryTimer = 3.0; // 3 sekundy czekania
    this.ai.recoveryAttempts++;

    console.log(`[AI] Recovery STARTED (phase: wait, attempt ${this.ai.recoveryAttempts})`);

    // Po drugim odbiciu natychmiast cofaj
    if (this.ai.recoveryAttempts >= 2) {
        console.log(`[AI] Second collision - immediate reverse`);
        this.ai.recoverySubPhase = 'reverse'; // Przełączamy się na cofanie
        this.ai.recoveryTimer = 2.0; // 2 sekundy cofania
        return {
            left: false,
            right: false,
            up: false,
            down: true  // Od razu zacznij cofać
        };
    }

    this.ai.stuckDetector.stuckTime = 0;
    this.ai.stuckDetector.positionTimer = 0;
    this.ai.stuckDetector.lastPosition = { x: this.ai.carX, y: this.ai.carY };
  }
}