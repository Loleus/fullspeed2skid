// aiRecovery.js
export class AIRecovery {
  constructor(ai) {
    this.ai = ai;
    // Nowe właściwości dla ulepszonego systemu recovery
    this.lastSafeWaypoint = null;
    this.recoveryPhase = 'assess'; // assess, cautious_reverse, find_nearest, check_obstacles, intelligent_reverse, cautious_approach
    this.obstacleCheckRadius = 120; // Zwiększony promień sprawdzania przeszkód
    this.maxAngleForDirectApproach = Math.PI / 4; // 45 stopni - zwiększony kąt dla bezpośredniego podejścia
    this.cautiousThrottle = 0.05; // BARDZO ostrożny gaz - 4x wolniej!
    this.minReverseSpeed = -2; // BARDZO wolniejsze cofanie
    this.reverseTime = 3.0; // Czas cofania (3 sekundy) - ZWIĘKSZONE
    this.gentleDriveTimer = 0; // Timer dla delikatnej jazdy
    this.recoveryEndTime = 0; // Czas zakończenia recovery
    
    // NOWE: Mechanizmy zapobiegające gwałtownym ruchom
    this.momentumDamping = 0.95; // Tłumienie pędu po zatrzymaniu
    this.lastSpeed = 0; // Poprzednia prędkość dla wykrywania nagłych zmian
    this.speedChangeThreshold = 5.0; // Próg wykrywania nagłych zmian prędkości
    this.stabilizationTimer = 0; // Timer stabilizacji po zatrzymaniu
    this.stabilizationDelay = 1.0; // Czas stabilizacji przed ruszeniem
    this.gradualThrottleIncrease = 0.02; // Stopniowe zwiększanie throttle
    this.currentThrottle = 0; // Aktualny throttle (stopniowo zwiększany)
    
    // NOWE: Mechanizmy obsługi przeszkód podczas cofania
    this.reverseSteering = 0; // Kierunek skręcania podczas cofania
    this.lastCollisionTime = 0; // Czas ostatniej kolizji
    this.collisionCount = 0; // Licznik kolizji podczas cofania
    this.collisionThreshold = 2.0; // Próg prędkości dla rozróżnienia delikatnej/mocnej kolizji
    this.maxCollisionsInSameSpot = 2; // MAKSYMALNIE 2 kolizje w tym samym miejscu
    this.forwardAttempts = 0; // Licznik prób jazdy do przodu
    this.maxForwardAttempts = 3; // Maksymalnie 3 próby jazdy do przodu
    this.stuckInLoop = false; // Czy AI jest w pętli
    this.loopDetectionTime = 0; // Czas wykrywania pętli
    this.reverseObstaclePhase = 'none'; // none, gentle_reverse, forward_steer, continue_reverse, find_nearest_waypoint
    this.originalSteering = 0; // Oryginalny kierunek skręcania przed kolizją
    this.lastCollisionPosition = null; // Pozycja ostatniej kolizji
    this.obstacleAvoidanceDistance = 150; // Odległość unikania przeszkód
    this.lastSteeringChange = 0; // Czas ostatniej zmiany kierunku skręcania
    this.steeringStabilityDelay = 0.5; // Opóźnienie między zmianami kierunku (0.5 sekundy)
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
        
        // KLUCZOWA NAPRAWA: Znajdź najbliższy bezpieczny waypoint (nie przez przeszkodę!)
        let safeWaypoint = null;
        let safeIndex = -1;
        
        // Sprawdź poprzednie waypointy po kolei, aż znajdziesz bezpieczny
        for (let i = 1; i <= 5; i++) { // Sprawdź 5 poprzednich waypointów
            const checkIndex = (this.ai.currentWaypointIndex - i + this.ai.waypoints.length) % this.ai.waypoints.length;
            const waypoint = this.ai.waypoints[checkIndex];
            
            // Sprawdź czy waypoint jest bezpieczny (nie w strefie niebezpiecznej)
            const isSafe = !this.ai.dangerZones.some(zone => {
                const dist = Math.hypot(waypoint.x - zone.x, waypoint.y - zone.y);
                return dist < this.ai.dangerZoneRadius * 1.5; // Zwiększona strefa bezpieczeństwa
            });
            
            if (isSafe) {
                safeWaypoint = waypoint;
                safeIndex = checkIndex;
                console.log(`[AI] Found safe waypoint ${i} steps back: ${checkIndex} at (${waypoint.x.toFixed(1)}, ${waypoint.y.toFixed(1)})`);
                break;
            }
        }
        
        // Jeśli nie znaleziono bezpiecznego waypointa, użyj poprzedniego
        if (!safeWaypoint) {
            const prevIndex = (this.ai.currentWaypointIndex - 1 + this.ai.waypoints.length) % this.ai.waypoints.length;
            safeWaypoint = this.ai.waypoints[prevIndex];
            safeIndex = prevIndex;
            console.log(`[AI] No safe waypoint found, using previous: ${prevIndex}`);
        }
        
        this.lastSafeWaypoint = safeWaypoint;
        console.log(`[AI] Using safe waypoint: ${safeIndex} at (${this.lastSafeWaypoint.x.toFixed(1)}, ${this.lastSafeWaypoint.y.toFixed(1)})`);
        console.log(`[AI] Current waypoint index stays: ${this.ai.currentWaypointIndex}`);
        
        // ZAWSZE przejdź do cofania - nie sprawdzaj czy waypoint jest "widoczny"
        // AI musi się wycofać z problematycznego obszaru
        console.log('[AI] Always backing up from problem area - no shortcuts!');
        
        // Przejdź do ostrożnego cofania
        this.recoveryPhase = 'cautious_reverse';
        this.ai.recoveryTimer = this.reverseTime; // Zwiększony czas na ostrożne cofanie
        return { left: false, right: false, up: false, down: false };
    }

    // --- FAZA 1: BARDZO OSTROŻNE COFANIE Z OBSŁUGĄ PRZESZKÓD ---
    if (this.recoveryPhase === 'cautious_reverse') {
        console.log(`[AI] Recovery Phase: CAUTIOUS_REVERSE - backing up toward last safe waypoint, speed=${state.speed.toFixed(1)}, obstaclePhase=${this.reverseObstaclePhase}`);
        
        // KLUCZOWA NAPRAWA: ZAWSZE wymuś odblokowanie throttle dla cofania
        this.ai.throttleLock = false; // ZAWSZE wymuś odblokowanie
        console.log('[AI] Forced throttle unlock for reverse');

        // Sprawdź czy jest kolizja podczas cofania
        const hasCollision = this._checkReverseCollision(state);
        if (hasCollision) {
            this._handleReverseCollision(state);
        }

        // Obsługa różnych faz obsługi przeszkód podczas cofania
        if (this.reverseObstaclePhase === 'forward_steer') {
            // Faza 1: Natychmiastowe przejście do przodu z tą samą kierownicą
            console.log(`[AI] FORWARD_STEER: Driving forward with original steering=${this.originalSteering.toFixed(2)}, attempt=${this.forwardAttempts}`);
            
            // Sprawdź czy dotarliśmy do waypointa podczas jazdy do przodu
            if (this._checkWaypointReached()) {
                console.log('[AI] Waypoint reached during forward steering - continuing recovery');
                this.reverseObstaclePhase = 'none';
                this.collisionCount = 0;
                this.forwardAttempts = 0; // Reset prób
                return { left: false, right: false, up: false, down: false };
            }
            
            // Sprawdź czy czas jazdy do przodu się skończył
            if (this.ai.recoveryTimer <= 0) {
                this.forwardAttempts++;
                console.log(`[AI] Forward attempt ${this.forwardAttempts} failed - going back to reverse`);
                
                // Jeśli za dużo prób - wróć do cofania
                if (this.forwardAttempts >= this.maxForwardAttempts) {
                    console.log('[AI] Too many forward attempts - returning to reverse mode');
                    this.reverseObstaclePhase = 'gentle_reverse';
                    this.forwardAttempts = 0;
                    this.ai.recoveryTimer = 2.0; // Czas na cofanie
                    return { left: false, right: false, up: false, down: true };
                }
                
                // Spróbuj ponownie z cofaniem
                this.reverseObstaclePhase = 'gentle_reverse';
                this.ai.recoveryTimer = 1.5; // Krótszy czas cofania
                return { left: false, right: false, up: false, down: true };
            }
            
            // Podczas jazdy do przodu używamy normalnej logiki skręcania (nie odwróconej)
            const targetWP = this.lastSafeWaypoint;
            const angleToTarget = Math.atan2(targetWP.y - this.ai.carY, targetWP.x - this.ai.carX);
            const angleDiff = this.ai._normalizeAngle(angleToTarget - state.carAngle);
            const forwardSteering = this._getStabilizedSteering(angleDiff, dt); // Stabilizowane skręcanie
            
            return {
                left: forwardSteering < -0.01,
                right: forwardSteering > 0.01,
                up: true,
                down: false
            };
        } else if (this.reverseObstaclePhase === 'gentle_reverse') {
            // Faza 2: Delikatne cofanie z kierownicą w przeciwną stronę
            console.log(`[AI] GENTLE_REVERSE: Slowly backing with opposite steering, attempt=${this.forwardAttempts}`);
            
            // Sprawdź czy dotarliśmy do waypointa podczas delikatnego cofania
            if (this._checkWaypointReached()) {
                console.log('[AI] Waypoint reached during gentle reverse - trying forward again');
                this.reverseObstaclePhase = 'forward_steer'; // Spróbuj ponownie do przodu
                this.ai.recoveryTimer = 1.0; // Krótki czas na próbę do przodu
                return { left: false, right: false, up: false, down: false };
            }
            
            // Sprawdź czy czas cofania się skończył
            if (this.ai.recoveryTimer <= 0) {
                console.log('[AI] Gentle reverse time expired - trying forward again');
                this.reverseObstaclePhase = 'forward_steer'; // Spróbuj ponownie do przodu
                this.ai.recoveryTimer = 1.0; // Krótki czas na próbę do przodu
                return { left: false, right: false, up: false, down: false };
            }
            
            // Delikatne cofanie z kierownicą w tym samym kierunku co waypoint
            const targetWP = this.lastSafeWaypoint;
            const angleToTarget = Math.atan2(targetWP.y - this.ai.carY, targetWP.x - this.ai.carX);
            const angleDiff = this.ai._normalizeAngle(angleToTarget - state.carAngle);
            const gentleReverseSteering = this._getStabilizedSteering(angleDiff, dt); // Stabilizowane skręcanie
            
            return {
                left: gentleReverseSteering < -0.01,
                right: gentleReverseSteering > 0.01,
                up: false,
                down: true
            };
        } else if (this.reverseObstaclePhase === 'continue_reverse') {
            // Faza 3: Kontynuacja normalnego cofania
            console.log(`[AI] CONTINUE_REVERSE: Normal reverse to waypoint`);
            this.reverseObstaclePhase = 'none'; // Reset do normalnego cofania
        } else if (this.reverseObstaclePhase === 'find_nearest_waypoint') {
            // Faza 4: Znajdź najbliższy waypoint i jedź do niego
            console.log(`[AI] FIND_NEAREST_WAYPOINT: Looking for closest waypoint`);
            
            // Znajdź najbliższy waypoint
            const nearestWaypoint = this._findNearestWaypoint();
            if (nearestWaypoint) {
                console.log(`[AI] Found nearest waypoint: ${nearestWaypoint.index}, distance: ${nearestWaypoint.distance.toFixed(1)}`);
                
                // Ustaw nowy cel
                this.lastSafeWaypoint = nearestWaypoint.waypoint;
                this.ai.currentWaypointIndex = nearestWaypoint.index;
                
                // Sprawdź czy dotarliśmy do waypointa
                if (this._checkWaypointReached()) {
                    console.log('[AI] Reached nearest waypoint - continuing recovery');
                    this.reverseObstaclePhase = 'none';
                    this.collisionCount = 0;
                    return { left: false, right: false, up: false, down: false };
                }
                
                // Jedź do najbliższego waypointa (do przodu, nie do tyłu!)
                const angleToTarget = Math.atan2(nearestWaypoint.waypoint.y - this.ai.carY, nearestWaypoint.waypoint.x - this.ai.carX);
                const angleDiff = this.ai._normalizeAngle(angleToTarget - state.carAngle);
                const forwardSteering = this._getStabilizedSteering(angleDiff, dt); // Stabilizowane skręcanie
                
                console.log(`[AI] DRIVING TO NEAREST: steering=${forwardSteering.toFixed(2)}, forward=true`);
                
                return {
                    left: forwardSteering < -0.01,
                    right: forwardSteering > 0.01,
                    up: true, // JEDŹ DO PRZODU!
                    down: false
                };
            }
            
            // Jeśli nie znaleziono waypointa, cofaj się normalnie
            console.log('[AI] No nearest waypoint found, using normal reverse');
            this.reverseObstaclePhase = 'none';
        }

        // Normalne cofanie w kierunku ostatniego bezpiecznego waypointa
        // Sprawdź czy prędkość nie jest za wysoka podczas cofania
        if (state.speed < this.minReverseSpeed) {
            console.log(`[AI] Speed too high during reverse: ${state.speed.toFixed(1)}, braking`);
            return { left: false, right: false, up: false, down: true };
        }
        
        if (Math.abs(state.speed) < 0.5) {
            const targetWP = this.lastSafeWaypoint;
            const angleToTarget = Math.atan2(targetWP.y - this.ai.carY, targetWP.x - this.ai.carX);
            const angleDiff = this.ai._normalizeAngle(angleToTarget - state.carAngle);
            
            // KLUCZOWA NAPRAWA: Podczas cofania skręcamy w TYM SAMYM kierunku co waypoint!
            // Jeśli waypoint jest po prawej, to podczas cofania też skręcamy w prawo
            const reverseSteering = this._getStabilizedSteering(angleDiff, dt); // Stabilizowane skręcanie
            this.originalSteering = reverseSteering;
            
            console.log(`[AI] REVERSE COMMAND: down=true, reverseSteer=${reverseSteering.toFixed(2)}, angleDiff=${angleDiff.toFixed(2)}, targetWP=(${targetWP.x.toFixed(1)},${targetWP.y.toFixed(1)})`);
            return {
                left: reverseSteering < -0.01,
                right: reverseSteering > 0.01,
                up: false,
                down: true // WYMUŚ COFANIE!
            };
        }

        // Sprawdź czy dotarliśmy do waypointa podczas cofania
        if (this._checkWaypointReached()) {
            console.log('[AI] Waypoint reached during reverse - continuing reverse for safety');
            // NIE przechodź do cautious_approach - kontynuuj cofanie!
            this.reverseObstaclePhase = 'none'; // Reset fazy przeszkód
            this.collisionCount = 0; // Reset licznika kolizji
            // Przedłuż czas cofania
            this.ai.recoveryTimer = 2.0;
            return { left: false, right: false, up: false, down: true };
        }

        // Jeśli czas się skończył, ale nie dotarliśmy do waypointa - PRZEDŁUŻ COFANIE!
        if (this.ai.recoveryTimer <= 0) {
            console.log('[AI] Reverse time expired - extending reverse time!');
            this.ai.recoveryTimer = 2.0; // Przedłuż czas cofania
            return { left: false, right: false, up: false, down: true };
        }

        return { left: false, right: false, up: false, down: false };
    }

    // --- FAZA 2: USUNIĘTA - powodowała problemy z waypointami ---

    // --- FAZA 3: USUNIĘTA - powodowała problemy z waypointami ---

    return { left: false, right: false, up: false, down: false };
  }

  _startSmartRecovery() {
    const state = this.ai.getFullState();

    this.ai.recoveryMode = true;
    this.recoveryPhase = 'assess'; // Zacznij od oceny sytuacji
    this.ai.recoveryTimer = 1.0; // Czas na ocenę sytuacji
    this.ai.recoveryAttempts++;

    // NOWE: Reset wszystkich timerów stabilizacji
    this.stabilizationTimer = 0;
    this.currentThrottle = 0;
    this.lastSpeed = state.speed;
    this.gentleDriveTimer = 0;

    // NOWE: Reset zmiennych obsługi przeszkód podczas cofania
    this.reverseObstaclePhase = 'none';
    this.collisionCount = 0;
    this.lastCollisionTime = 0;
    this.originalSteering = 0;
    this.lastCollisionPosition = null;
    this.lastSteeringChange = 0;
    this.forwardAttempts = 0; // Reset prób jazdy do przodu
    this.stuckInLoop = false; // Reset wykrywania pętli
    this.loopDetectionTime = 0;

    console.log(`[AI] Recovery STARTED (assessing situation, attempt ${this.ai.recoveryAttempts})`);

    this.ai.stuckDetector.stuckTime = 0;
    this.ai.stuckDetector.positionTimer = 0;
    this.ai.stuckDetector.lastPosition = { x: this.ai.carX, y: this.ai.carY };
  }

  // Metoda wywoływana przy ponownej kolizji podczas recovery
  handleRecoveryCollision() {
    console.log('[AI] Collision during recovery - checking collision count');
    
    // Zwiększ licznik kolizji
    this.collisionCount++;
    
    // Jeśli to druga kolizja w tym samym miejscu - NATYCHMIAST jedź do przodu!
    if (this.collisionCount >= this.maxCollisionsInSameSpot) {
      console.log(`[AI] ${this.collisionCount} collisions - STOP backing up! Going forward immediately!`);
      
      // Przejdź do fazy jazdy do przodu z licznikiem prób
      this.reverseObstaclePhase = 'forward_steer';
      this.ai.recoveryTimer = 1.0; // Krótki czas na próbę do przodu
      this.ai.throttleLock = false; // Wymuś odblokowanie throttle
      this.collisionCount = 0; // Reset licznika
      this.forwardAttempts = 0; // Reset prób
      
      console.log('[AI] Forced transition to forward driving after multiple collisions');
    } else {
      // Pierwsza kolizja - kontynuuj ostrożne cofanie, ale krócej
      console.log(`[AI] First collision - continuing reverse but shorter time`);
      this.reverseTime = Math.min(this.reverseTime, 1.0); // Maksymalnie 1 sekunda cofania
      this.recoveryPhase = 'cautious_reverse';
      this.ai.recoveryTimer = this.reverseTime;
      this.ai.throttleLock = false;
    }
  }

  // Sprawdza czy podczas cofania nastąpiła kolizja z przeszkodą
  _checkReverseCollision(state) {
    const currentTime = Date.now();
    const timeSinceLastCollision = currentTime - this.lastCollisionTime;
    
    // Sprawdź czy prędkość gwałtownie się zmieniła (wskazuje na kolizję)
    const speedChange = Math.abs(state.speed - this.lastSpeed);
    this.lastSpeed = state.speed;
    
    // Jeśli prędkość gwałtownie spadła podczas cofania, to prawdopodobnie kolizja
    // Zwiększony próg i dłuższy czas między kolizjami
    if (speedChange > this.collisionThreshold * 1.5 && state.speed < -0.5 && timeSinceLastCollision > 1000) {
      console.log(`[AI] Reverse collision detected: speedChange=${speedChange.toFixed(1)}, speed=${state.speed.toFixed(1)}, timeSince=${timeSinceLastCollision}ms`);
      this.lastCollisionTime = currentTime;
      this.collisionCount++;
      return true;
    }
    
    return false;
  }

  // Obsługuje kolizję podczas cofania zgodnie z nową logiką
  _handleReverseCollision(state) {
    console.log(`[AI] Handling reverse collision #${this.collisionCount}, speed=${state.speed.toFixed(1)}`);
    
    // Zapisz pozycję kolizji
    this.lastCollisionPosition = { x: this.ai.carX, y: this.ai.carY };
    
    // KLUCZOWA NAPRAWA: Po drugiej kolizji NATYCHMIAST jedź do przodu!
    if (this.collisionCount === 1) {
      // Pierwsza kolizja - natychmiast jedź do przodu z tą samą kierownicą
      console.log('[AI] First collision - switching to forward with same steering');
      this.reverseObstaclePhase = 'forward_steer';
      this.ai.recoveryTimer = 1.0; // Krótki czas na jazdę do przodu
    } else if (this.collisionCount >= this.maxCollisionsInSameSpot) {
      // Druga i kolejne kolizje - NATYCHMIAST jedź do przodu, NIE COFAJ SIĘ WIĘCEJ!
      console.log(`[AI] ${this.collisionCount} collisions - STOP backing up! Going forward immediately!`);
      this.reverseObstaclePhase = 'forward_steer';
      this.ai.recoveryTimer = 2.0; // Czas na jazdę do przodu
      
      // Reset licznika kolizji po przejściu do przodu
      this.collisionCount = 0;
    }
  }

  // Sprawdza czy waypoint został osiągnięty podczas cofania
  _checkWaypointReached() {
    if (!this.lastSafeWaypoint) return false;
    
    const distToWaypoint = Math.hypot(
      this.lastSafeWaypoint.x - this.ai.carX, 
      this.lastSafeWaypoint.y - this.ai.carY
    );
    
    // Sprawdź czy jesteśmy wystarczająco blisko waypointa
    const reached = distToWaypoint < this.ai.waypointZoneRadius * 1.5;
    
    if (reached) {
      console.log(`[AI] Waypoint reached during reverse obstacle handling: distance=${distToWaypoint.toFixed(1)}`);
    }
    
    return reached;
  }

  // Znajduje najbliższy waypoint do aktualnej pozycji
  _findNearestWaypoint() {
    if (!this.ai.waypoints || this.ai.waypoints.length === 0) return null;
    
    let nearestWaypoint = null;
    let minDistance = Infinity;
    let nearestIndex = -1;
    
    for (let i = 0; i < this.ai.waypoints.length; i++) {
      const waypoint = this.ai.waypoints[i];
      const distance = Math.hypot(
        waypoint.x - this.ai.carX,
        waypoint.y - this.ai.carY
      );
      
      if (distance < minDistance) {
        minDistance = distance;
        nearestWaypoint = waypoint;
        nearestIndex = i;
      }
    }
    
    if (nearestWaypoint) {
      console.log(`[AI] Nearest waypoint found: index=${nearestIndex}, distance=${minDistance.toFixed(1)}`);
    }
    
    return {
      waypoint: nearestWaypoint,
      index: nearestIndex,
      distance: minDistance
    };
  }

  // Stabilizuje skręcanie - zapobiega zachowaniu ping-pong
  _getStabilizedSteering(angleDiff, dt) {
    const currentTime = Date.now() / 1000; // Konwersja na sekundy
    const timeSinceLastChange = currentTime - this.lastSteeringChange;
    
    // Bardzo ostrożne skręcanie - nie skręcaj w przeciwną stronę!
    let steer = angleDiff * 0.01; // Bardzo mały mnożnik
    
    // Jeśli kąt jest bardzo duży, skręcaj jeszcze bardziej ostrożnie
    if (Math.abs(angleDiff) > Math.PI / 3) { // 60 stopni
      steer = steer * 0.2; // Jeszcze bardziej ostrożnie
    }
    
    // Jeśli minęło wystarczająco czasu, pozwól na większe skręcanie
    if (timeSinceLastChange >= this.steeringStabilityDelay) {
      this.lastSteeringChange = currentTime;
      steer = steer * 2; // Podwójne skręcanie, ale nadal ostrożne
    }
    
    // Bardzo małe ograniczenie skręcania
    return Phaser.Math.Clamp(steer, -0.003, 0.003);
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