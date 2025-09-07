// aiRecovery.js
export class AIRecovery {
  constructor(ai) {
    this.ai = ai;
    // Nowe właściwości dla ulepszonego systemu recovery
    this.lastSafeWaypoint = null;
    this.recoveryPhase = 'assess'; // assess, cautious_reverse, find_nearest, check_obstacles, intelligent_reverse, cautious_approach
    this.obstacleCheckRadius = 120; // Zwiększony promień sprawdzania przeszkód
    this.maxAngleForDirectApproach = Math.PI / 4; // 45 stopni - zwiększony kąt dla bezpośredniego podejścia
    this.cautiousThrottle = 0.2; // Jeszcze bardziej ostrożny gaz
    this.minReverseSpeed = -8; // Minimalna prędkość cofania (zwiększona)
    this.reverseTime = 1.5; // Czas cofania (zwiększony)
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

    // --- FAZA 0: OCENA SYTUACJI ---
    if (this.recoveryPhase === 'assess') {
        console.log('[AI] Recovery Phase: ASSESS - evaluating situation');
        
        // Zapamiętaj ostatni bezpieczny waypoint (poprzedni) i cofnij się do niego
        const prevIndex = (this.ai.currentWaypointIndex - 1 + this.ai.waypoints.length) % this.ai.waypoints.length;
        this.lastSafeWaypoint = this.ai.waypoints[prevIndex];
        this.ai.currentWaypointIndex = prevIndex; // Cofnij się do ostatniego zdobytego waypointa
        
        console.log(`[AI] Reverting to last safe waypoint: ${prevIndex}`);
        
        // Sprawdź czy widzimy obecny waypoint (teraz poprzedni)
        const currentWP = this.ai.waypoints[this.ai.currentWaypointIndex];
        if (this._canSeeWaypoint(currentWP) && this._isPathClear(currentWP)) {
            console.log('[AI] Last safe waypoint visible and clear - resuming normal driving');
            this.ai.recoveryMode = false;
            this.recoveryPhase = 'assess';
            return { left: false, right: false, up: true, down: false };
        }
        
        // Przejdź do ostrożnego cofania
        this.recoveryPhase = 'cautious_reverse';
        this.ai.recoveryTimer = this.reverseTime; // Zwiększony czas na ostrożne cofanie
        return { left: false, right: false, up: false, down: false };
    }

    // --- FAZA 1: BARDZO OSTROŻNE COFANIE ---
    if (this.recoveryPhase === 'cautious_reverse') {
        console.log('[AI] Recovery Phase: CAUTIOUS_REVERSE - backing up toward last safe waypoint');
        
        if (this.ai.throttleLock) {
            return { left: false, right: false, up: false, down: false };
        }

        // Cofaj się w kierunku ostatniego bezpiecznego waypointa
        if (Math.abs(state.speed) < 0.5) {
            const targetWP = this.lastSafeWaypoint;
            const angleToTarget = Math.atan2(targetWP.y - this.ai.carY, targetWP.x - this.ai.carX);
            const angleDiff = this.ai._normalizeAngle(angleToTarget - (state.carAngle + Math.PI)); // +PI bo cofamy
            
            // Bardzo ostrożne skręcanie podczas cofania
            const steer = Phaser.Math.Clamp(angleDiff * 0.3, -0.2, 0.2);
            
            return {
                left: steer < -0.01,
                right: steer > 0.01,
                up: false,
                down: true
            };
        }

        // Po cofnięciu przejdź do sprawdzenia czy droga jest czysta
        if (state.speed < this.minReverseSpeed && this.ai.recoveryTimer < 0.5) {
            this.recoveryPhase = 'check_obstacles';
            this.ai.recoveryTimer = 0.5;
            return { left: false, right: false, up: false, down: false };
        }

        return { left: false, right: false, up: false, down: false };
    }

    // --- FAZA 2: SPRAWDZENIE PRZESZKÓD (po cofnięciu do bezpiecznego waypointa) ---

    // --- FAZA 3: SPRAWDZENIE PRZESZKÓD ---
    if (this.recoveryPhase === 'check_obstacles') {
        console.log('[AI] Recovery Phase: CHECK_OBSTACLES - checking path to next waypoint');
        
        // Sprawdź drogę do następnego waypointa (nie obecnego)
        const nextIndex = (this.ai.currentWaypointIndex + 1) % this.ai.waypoints.length;
        const targetWP = this.ai.waypoints[nextIndex];
        const angleToTarget = Math.atan2(targetWP.y - this.ai.carY, targetWP.x - this.ai.carX);
        const angleDiff = Math.abs(this.ai._normalizeAngle(angleToTarget - state.carAngle));
        
        // Sprawdź czy na drodze do następnego waypointa są przeszkody
        if (this._hasObstaclesOnPath(targetWP) || angleDiff > this.maxAngleForDirectApproach) {
            console.log('[AI] Obstacles detected on path to next waypoint - entering intelligent reverse');
            this.recoveryPhase = 'intelligent_reverse';
            this.ai.recoveryTimer = 2.0;
            return { left: false, right: false, up: false, down: false };
        } else {
            console.log('[AI] Path to next waypoint clear - proceeding with cautious approach');
            this.recoveryPhase = 'cautious_approach';
            this.ai.recoveryTimer = 1.5;
            return { left: false, right: false, up: false, down: false };
        }
    }

    // --- FAZA 4: INTELIGENTNE WYCOFANIE ---
    if (this.recoveryPhase === 'intelligent_reverse') {
        console.log('[AI] Recovery Phase: INTELLIGENT_REVERSE - backing up until better angle');
        
        if (this.ai.throttleLock) {
            return { left: false, right: false, up: false, down: false };
        }

        // Cofaj się i sprawdzaj czy kąt się poprawia
        const targetWP = this.ai.waypoints[this.ai.currentWaypointIndex];
        const angleToTarget = Math.atan2(targetWP.y - this.ai.carY, targetWP.x - this.ai.carX);
        const angleDiff = Math.abs(this.ai._normalizeAngle(angleToTarget - state.carAngle));
        
        if (Math.abs(state.speed) < 0.5) {
            return {
                left: false,
                right: false,
                up: false,
                down: true
            };
        }

        // Sprawdź czy kąt się poprawił lub nie ma już przeszkód
        if (angleDiff < this.maxAngleForDirectApproach && !this._hasObstaclesOnPath(targetWP)) {
            console.log('[AI] Angle improved and path clear - switching to cautious approach');
            this.recoveryPhase = 'cautious_approach';
            this.ai.recoveryTimer = 1.5;
            return { left: false, right: false, up: false, down: false };
        }

        // Jeśli czas się skończył, spróbuj mimo wszystko
        if (this.ai.recoveryTimer <= 0) {
            console.log('[AI] Intelligent reverse timeout - forcing cautious approach');
            this.recoveryPhase = 'cautious_approach';
            this.ai.recoveryTimer = 1.5;
            return { left: false, right: false, up: false, down: false };
        }

        return { left: false, right: false, up: false, down: false };
    }

    // --- FAZA 5: OSTROŻNE ZBLIŻANIE ---
    if (this.recoveryPhase === 'cautious_approach') {
        console.log('[AI] Recovery Phase: CAUTIOUS_APPROACH - carefully approaching next waypoint');
        
        // Jedź do następnego waypointa (nie obecnego)
        const nextIndex = (this.ai.currentWaypointIndex + 1) % this.ai.waypoints.length;
        const targetWP = this.ai.waypoints[nextIndex];
        const angleToTarget = Math.atan2(targetWP.y - this.ai.carY, targetWP.x - this.ai.carX);
        const angleDiff = this.ai._normalizeAngle(angleToTarget - state.carAngle);
        
        // Bardzo ostrożne sterowanie
        const steer = Phaser.Math.Clamp(angleDiff * 0.3, -0.2, 0.2);
        
        // Bardzo ostrożny gaz
        const throttle = this.cautiousThrottle;
        
        // Sprawdź czy jesteśmy wystarczająco blisko i skierowani
        const distToTarget = Math.hypot(targetWP.x - this.ai.carX, targetWP.y - this.ai.carY);
        if (distToTarget < this.ai.waypointZoneRadius * 1.5 && Math.abs(angleDiff) < 0.3) {
            console.log('[AI] Recovery successful - resuming normal driving');
            this.ai.recoveryMode = false;
            this.recoveryPhase = 'assess';
            return { left: false, right: false, up: true, down: false };
        }

        return {
            left: steer < -0.01,
            right: steer > 0.01,
            up: throttle > 0,
            down: false
        };
    }

    return { left: false, right: false, up: false, down: false };
  }

  _startSmartRecovery() {
    const state = this.ai.getFullState();

    this.ai.recoveryMode = true;
    this.recoveryPhase = 'assess'; // Zacznij od oceny sytuacji
    this.ai.recoveryTimer = 1.0; // Czas na ocenę sytuacji
    this.ai.recoveryAttempts++;

    console.log(`[AI] Recovery STARTED (assessing situation, attempt ${this.ai.recoveryAttempts})`);

    this.ai.stuckDetector.stuckTime = 0;
    this.ai.stuckDetector.positionTimer = 0;
    this.ai.stuckDetector.lastPosition = { x: this.ai.carX, y: this.ai.carY };
  }

  // Metoda wywoływana przy ponownej kolizji podczas recovery
  handleRecoveryCollision() {
    console.log('[AI] Collision during recovery - forcing longer reverse');
    
    // Zwiększ parametry cofania dla kolejnych prób
    this.minReverseSpeed = Math.min(this.minReverseSpeed - 2, -12); // Cofaj się jeszcze dalej
    this.reverseTime = Math.min(this.reverseTime + 0.5, 3.0); // Dłuższy czas cofania
    this.obstacleCheckRadius = Math.min(this.obstacleCheckRadius + 20, 200); // Większy promień sprawdzania
    
    // Wymuś powrót do fazy cofania
    this.recoveryPhase = 'cautious_reverse';
    this.ai.recoveryTimer = this.reverseTime;
    
    console.log(`[AI] Updated recovery params: minReverseSpeed=${this.minReverseSpeed}, reverseTime=${this.reverseTime}, obstacleRadius=${this.obstacleCheckRadius}`);
  }

  // Sprawdza czy waypoint jest widoczny (w rozsądnym kącie przed nami)
  _canSeeWaypoint(waypoint) {
    const angleToWP = Math.atan2(waypoint.y - this.ai.carY, waypoint.x - this.ai.carX);
    const angleDiff = Math.abs(this.ai._normalizeAngle(angleToWP - this.ai.carAngle));
    
    // Waypoint jest "widoczny" jeśli jest w rozsądnym kącie przed nami (nie za plecami)
    return angleDiff < Math.PI/2;
  }

  // Sprawdza czy ścieżka do waypointa jest czysta (bez przeszkód)
  _isPathClear(waypoint) {
    return this.ai.aiDriving._isPathSafe(waypoint);
  }


  // Sprawdza czy na drodze do waypointa są przeszkody
  _hasObstaclesOnPath(targetWP) {
    const pathPoints = 12; // Zwiększona liczba punktów sprawdzania
    const dx = (targetWP.x - this.ai.carX) / pathPoints;
    const dy = (targetWP.y - this.ai.carY) / pathPoints;
    
    for (let i = 1; i <= pathPoints; i++) {
      const checkX = this.ai.carX + dx * i;
      const checkY = this.ai.carY + dy * i;
      
      // Sprawdź czy punkt na drodze jest w strefie niebezpiecznej
      for (const zone of this.ai.dangerZones) {
        const dist = Math.hypot(checkX - zone.x, checkY - zone.y);
        if (dist < this.obstacleCheckRadius) {
          console.log(`[AI] Obstacle detected at path point ${i}, distance: ${dist.toFixed(1)}`);
          return true;
        }
      }
      
      // Sprawdź czy punkt jest poza drogą (dodatkowa kontrola)
      const surfaceType = this.ai.worldData?.getSurfaceTypeAt?.(checkX, checkY);
      if (surfaceType === 'obstacle') {
        console.log(`[AI] Off-road obstacle detected at path point ${i}`);
        return true;
      }
    }
    
    return false;
  }
}