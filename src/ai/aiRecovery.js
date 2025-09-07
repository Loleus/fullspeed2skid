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
    this.reverseTime = 3.0; // Długi czas cofania (3 sekundy)
    this.recoveryEndTime = 0; // Czas zakończenia recovery
  }

  _handleSmarterRecovery(dt, state) {
    this.ai.recoveryTimer -= dt;

    console.log(`[AI] Recovery: phase=${this.recoveryPhase}, timer=${this.ai.recoveryTimer.toFixed(1)}, attempts=${this.ai.recoveryAttempts}, throttleLock=${this.ai.throttleLock}`);

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
        
        // KLUCZOWA NAPRAWA: Cofnij się do poprzedniego waypointa i tam zostań
        const prevIndex = (this.ai.currentWaypointIndex - 1 + this.ai.waypoints.length) % this.ai.waypoints.length;
        this.lastSafeWaypoint = this.ai.waypoints[prevIndex];
        this.ai.currentWaypointIndex = prevIndex; // Cofnij się do poprzedniego waypointa
        
        console.log(`[AI] Reverting to PREVIOUS waypoint: ${prevIndex} (not looking further!)`);
        
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
        console.log(`[AI] Recovery Phase: CAUTIOUS_REVERSE - backing up toward last safe waypoint, speed=${state.speed.toFixed(1)}`);
        
        // KLUCZOWA NAPRAWA: ZAWSZE wymuś odblokowanie throttle dla cofania
        this.ai.throttleLock = false; // ZAWSZE wymuś odblokowanie
        console.log('[AI] Forced throttle unlock for reverse');

        // Cofaj się w kierunku ostatniego bezpiecznego waypointa
        if (Math.abs(state.speed) < 0.5) {
            const targetWP = this.lastSafeWaypoint;
            const angleToTarget = Math.atan2(targetWP.y - this.ai.carY, targetWP.x - this.ai.carX);
            const angleDiff = this.ai._normalizeAngle(angleToTarget - (state.carAngle + Math.PI)); // +PI bo cofamy
            
            // Bardzo ostrożne skręcanie podczas cofania
            const steer = Phaser.Math.Clamp(angleDiff * 0.3, -0.2, 0.2);
            
            console.log(`[AI] REVERSE COMMAND: down=true, steer=${steer.toFixed(2)}, angleDiff=${angleDiff.toFixed(2)}`);
            return {
                left: steer < -0.01,
                right: steer > 0.01,
                up: false,
                down: true // WYMUŚ COFANIE!
            };
        }

        // Po cofnięciu przejdź bezpośrednio do ostrożnego podejścia
        if (state.speed < this.minReverseSpeed && this.ai.recoveryTimer < 0.5) {
            this.recoveryPhase = 'cautious_approach';
            this.ai.recoveryTimer = 1.5;
            return { left: false, right: false, up: false, down: false };
        }

        return { left: false, right: false, up: false, down: false };
    }

    // --- FAZA 2: OSTROŻNE ZBLIŻANIE DO POPRZEDNIEGO WAYPOINTA ---
    if (this.recoveryPhase === 'cautious_approach') {
        console.log('[AI] Recovery Phase: CAUTIOUS_APPROACH - carefully approaching PREVIOUS waypoint');
        
        // KLUCZOWA NAPRAWA: Jedź do poprzedniego waypointa (nie następnego!)
        const targetWP = this.ai.waypoints[this.ai.currentWaypointIndex]; // To jest poprzedni waypoint
        const angleToTarget = Math.atan2(targetWP.y - this.ai.carY, targetWP.x - this.ai.carX);
        const angleDiff = this.ai._normalizeAngle(angleToTarget - state.carAngle);
        
        // Bardzo ostrożne sterowanie
        const steer = Phaser.Math.Clamp(angleDiff * 0.3, -0.2, 0.2);
        
        // Bardzo ostrożny gaz
        const throttle = this.cautiousThrottle;
        
        // Sprawdź czy jesteśmy wystarczająco blisko poprzedniego waypointa
        const distToTarget = Math.hypot(targetWP.x - this.ai.carX, targetWP.y - this.ai.carY);
        if (distToTarget < this.ai.waypointZoneRadius * 1.5 && Math.abs(angleDiff) < 0.3) {
            console.log('[AI] Reached previous waypoint - recovery successful, staying here for a moment');
            this.ai.recoveryMode = false;
            this.recoveryPhase = 'assess';
            this.recoveryEndTime = Date.now(); // Zapisz czas zakończenia recovery
            // KLUCZOWA NAPRAWA: Nie przechodź do następnego waypointa od razu
            // AI zostanie przy poprzednim waypointa i będzie jechać normalnie
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
    this.ai.throttleLock = false; // Wymuś odblokowanie throttle
    
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