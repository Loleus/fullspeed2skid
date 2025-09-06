// aiRecovery.js
export class AIRecovery {
  constructor(ai) {
    this.ai = ai;
    // Nowe właściwości dla ulepszonego systemu recovery
    this.lastSafeWaypoint = null;
    this.recoveryPhase = 'assess'; // assess, cautious_reverse, find_nearest, check_obstacles, intelligent_reverse, cautious_approach
    this.obstacleCheckRadius = 80; // Promień sprawdzania przeszkód
    this.maxAngleForDirectApproach = Math.PI / 6; // 30 stopni - maksymalny kąt dla bezpośredniego podejścia
    this.cautiousThrottle = 0.3; // Bardzo ostrożny gaz w fazie początkowej
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
        
        // Zapamiętaj ostatni bezpieczny waypoint (poprzedni)
        const prevIndex = (this.ai.currentWaypointIndex - 1 + this.ai.waypoints.length) % this.ai.waypoints.length;
        this.lastSafeWaypoint = this.ai.waypoints[prevIndex];
        
        // Sprawdź czy widzimy obecny waypoint
        const currentWP = this.ai.waypoints[this.ai.currentWaypointIndex];
        if (this._canSeeWaypoint(currentWP) && this._isPathClear(currentWP)) {
            console.log('[AI] Current waypoint visible and clear - resuming normal driving');
            this.ai.recoveryMode = false;
            this.recoveryPhase = 'assess';
            return { left: false, right: false, up: true, down: false };
        }
        
        // Przejdź do ostrożnego cofania
        this.recoveryPhase = 'cautious_reverse';
        this.ai.recoveryTimer = 1.0; // Czas na ostrożne cofanie
        return { left: false, right: false, up: false, down: false };
    }

    // --- FAZA 1: BARDZO OSTROŻNE COFANIE ---
    if (this.recoveryPhase === 'cautious_reverse') {
        console.log('[AI] Recovery Phase: CAUTIOUS_REVERSE - backing up carefully');
        
        if (this.ai.throttleLock) {
            return { left: false, right: false, up: false, down: false };
        }

        // Cofaj się prosto, bez skręcania
        if (Math.abs(state.speed) < 0.5) {
            return {
                left: false,
                right: false,
                up: false,
                down: true
            };
        }

        // Po cofnięciu przejdź do szukania najbliższego waypointa
        if (state.speed < -4 && this.ai.recoveryTimer < 0.5) {
            this.recoveryPhase = 'find_nearest';
            this.ai.recoveryTimer = 0.5;
            return { left: false, right: false, up: false, down: false };
        }

        return { left: false, right: false, up: false, down: false };
    }

    // --- FAZA 2: SZUKANIE NAJBLIŻSZEGO WAYPOINTA ---
    if (this.recoveryPhase === 'find_nearest') {
        console.log('[AI] Recovery Phase: FIND_NEAREST - looking for closest visible waypoint');
        
        const nearestWP = this._findNearestVisibleWaypoint();
        if (nearestWP) {
            console.log(`[AI] Found nearest waypoint at index ${nearestWP.index}`);
            this.ai.currentWaypointIndex = nearestWP.index;
            this.recoveryPhase = 'check_obstacles';
            this.ai.recoveryTimer = 0.3;
            return { left: false, right: false, up: false, down: false };
        } else {
            // Jeśli nie znaleziono żadnego waypointa, spróbuj cofnąć się dalej
            this.recoveryPhase = 'cautious_reverse';
            this.ai.recoveryTimer = 1.0;
            return { left: false, right: false, up: false, down: true };
        }
    }

    // --- FAZA 3: SPRAWDZENIE PRZESZKÓD ---
    if (this.recoveryPhase === 'check_obstacles') {
        console.log('[AI] Recovery Phase: CHECK_OBSTACLES - checking for obstacles on path');
        
        const targetWP = this.ai.waypoints[this.ai.currentWaypointIndex];
        const angleToTarget = Math.atan2(targetWP.y - this.ai.carY, targetWP.x - this.ai.carX);
        const angleDiff = Math.abs(this.ai._normalizeAngle(angleToTarget - state.carAngle));
        
        // Sprawdź czy na drodze do waypointa są przeszkody
        if (this._hasObstaclesOnPath(targetWP) || angleDiff > this.maxAngleForDirectApproach) {
            console.log('[AI] Obstacles detected or angle too sharp - entering intelligent reverse');
            this.recoveryPhase = 'intelligent_reverse';
            this.ai.recoveryTimer = 2.0;
            return { left: false, right: false, up: false, down: false };
        } else {
            console.log('[AI] Path clear - proceeding with cautious approach');
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
        console.log('[AI] Recovery Phase: CAUTIOUS_APPROACH - carefully approaching waypoint');
        
        const targetWP = this.ai.waypoints[this.ai.currentWaypointIndex];
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

  // Znajduje najbliższy widoczny waypoint
  _findNearestVisibleWaypoint() {
    let nearestWP = null;
    let minDistance = Infinity;
    let nearestIndex = -1;

    // Sprawdź waypointy w promieniu 200 pikseli
    for (let i = 0; i < this.ai.waypoints.length; i++) {
      const wp = this.ai.waypoints[i];
      const dist = Math.hypot(wp.x - this.ai.carX, wp.y - this.ai.carY);
      
      if (dist < 200 && this._canSeeWaypoint(wp) && dist < minDistance) {
        nearestWP = wp;
        minDistance = dist;
        nearestIndex = i;
      }
    }

    return nearestWP ? { waypoint: nearestWP, index: nearestIndex, distance: minDistance } : null;
  }

  // Sprawdza czy na drodze do waypointa są przeszkody
  _hasObstaclesOnPath(targetWP) {
    const pathPoints = 8; // Sprawdź więcej punktów na drodze
    const dx = (targetWP.x - this.ai.carX) / pathPoints;
    const dy = (targetWP.y - this.ai.carY) / pathPoints;
    
    for (let i = 1; i <= pathPoints; i++) {
      const checkX = this.ai.carX + dx * i;
      const checkY = this.ai.carY + dy * i;
      
      // Sprawdź czy punkt na drodze jest w strefie niebezpiecznej
      for (const zone of this.ai.dangerZones) {
        const dist = Math.hypot(checkX - zone.x, checkY - zone.y);
        if (dist < this.obstacleCheckRadius) {
          return true;
        }
      }
      
      // Sprawdź czy punkt jest poza drogą (dodatkowa kontrola)
      const surfaceType = this.ai.worldData?.getSurfaceTypeAt?.(checkX, checkY);
      if (surfaceType === 'obstacle') {
        return true;
      }
    }
    
    return false;
  }
}