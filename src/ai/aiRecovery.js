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
    this.reverseTime = 4.0; // Czas cofania (4 sekundy)
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
        
        // KLUCZOWA NAPRAWA: Cofnij się do poprzedniego waypointa i tam zostań
        const prevIndex = (this.ai.currentWaypointIndex - 1 + this.ai.waypoints.length) % this.ai.waypoints.length;
        this.lastSafeWaypoint = this.ai.waypoints[prevIndex];
        this.ai.currentWaypointIndex = prevIndex; // Cofnij się do poprzedniego waypointa
        
        console.log(`[AI] Reverting to PREVIOUS waypoint: ${prevIndex} (not looking further!)`);
        
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
            console.log(`[AI] FORWARD_STEER: Driving forward with original steering=${this.originalSteering.toFixed(2)}`);
            
            // Sprawdź czy dotarliśmy do waypointa podczas jazdy do przodu
            if (this._checkWaypointReached()) {
                console.log('[AI] Waypoint reached during forward steering - continuing recovery');
                this.reverseObstaclePhase = 'none';
                this.collisionCount = 0;
                return { left: false, right: false, up: false, down: false };
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
            console.log(`[AI] GENTLE_REVERSE: Slowly backing with opposite steering`);
            
            // Sprawdź czy dotarliśmy do waypointa podczas delikatnego cofania
            if (this._checkWaypointReached()) {
                console.log('[AI] Waypoint reached during gentle reverse - continuing recovery');
                this.reverseObstaclePhase = 'none';
                this.collisionCount = 0;
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
            console.log('[AI] Waypoint reached during reverse - transitioning to cautious approach');
            this.recoveryPhase = 'cautious_approach';
            this.ai.recoveryTimer = 1.5;
            this.reverseObstaclePhase = 'none'; // Reset fazy przeszkód
            this.collisionCount = 0; // Reset licznika kolizji
            return { left: false, right: false, up: false, down: false };
        }

        // Jeśli czas się skończył, ale nie dotarliśmy do waypointa - kontynuuj cofanie
        if (this.ai.recoveryTimer <= 0) {
            console.log('[AI] Reverse time expired, but waypoint not reached - extending reverse time');
            this.ai.recoveryTimer = 3.0; // Przedłuż czas cofania
            return { left: false, right: false, up: false, down: true };
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
        
        // NOWE: Wykrywanie nagłych zmian prędkości
        const speedChange = Math.abs(state.speed - this.lastSpeed);
        this.lastSpeed = state.speed;
        
        if (speedChange > this.speedChangeThreshold) {
            console.log(`[AI] Sudden speed change detected: ${speedChange.toFixed(1)} - applying emergency brake`);
            this.stabilizationTimer = this.stabilizationDelay; // Reset stabilizacji
            this.currentThrottle = 0; // Reset throttle
            return { left: false, right: false, up: false, down: true };
        }
        
        // Najpierw zatrzymaj się i ocenij sytuację
        if (Math.abs(state.speed) > 2) {
            console.log('[AI] Still moving, stopping first...');
            this.stabilizationTimer = 0; // Reset stabilizacji
            this.currentThrottle = 0; // Reset throttle
            return { left: false, right: false, up: false, down: true };
        }
        
        // NOWE: Timer stabilizacji - czekaj przed ruszeniem
        if (this.stabilizationTimer < this.stabilizationDelay) {
            this.stabilizationTimer += dt;
            console.log(`[AI] Stabilizing after stop: ${this.stabilizationTimer.toFixed(1)}/${this.stabilizationDelay}s`);
            return { left: false, right: false, up: false, down: false };
        }
        
        // BARDZO delikatne i ostrożne sterowanie - jak prawdziwy kierowca po wypadku
        const steer = Phaser.Math.Clamp(angleDiff * 0.05, -0.02, 0.02); // 6x mniej agresywne!
        
        // NOWE: Stopniowe zwiększanie throttle zamiast gwałtownego ruszania
        this.currentThrottle = Math.min(this.currentThrottle + this.gradualThrottleIncrease * dt, this.cautiousThrottle * 0.1);
        const throttle = this.currentThrottle;
        
        console.log(`[AI] Gradual throttle increase: ${throttle.toFixed(4)} (target: ${(this.cautiousThrottle * 0.1).toFixed(4)})`);
        
        // Sprawdź czy jesteśmy wystarczająco blisko poprzedniego waypointa
        const distToTarget = Math.hypot(targetWP.x - this.ai.carX, targetWP.y - this.ai.carY);
        if (distToTarget < this.ai.waypointZoneRadius * 1.5 && Math.abs(angleDiff) < 0.3) {
            console.log('[AI] Reached previous waypoint - recovery successful, staying here for a moment');
            
            // KLUCZOWA NAPRAWA: Sprawdź czy AI rzeczywiście opuściło problematyczny obszar
            const problemArea = this.ai.dangerZones.find(zone => {
                const dist = Math.hypot(this.ai.carX - zone.x, this.ai.carY - zone.y);
                return dist < this.ai.dangerZoneRadius;
            });
            
            if (problemArea) {
                console.log('[AI] Still in problem area - continuing reverse for safety');
                this.stabilizationTimer = 0; // Reset stabilizacji
                this.currentThrottle = 0; // Reset throttle
                return { left: false, right: false, up: false, down: true };
            }
            
            // STOPNIOWE PRZEJŚCIE: Nie kończ recovery od razu - przejdź do fazy "gentle_drive"
            console.log('[AI] Starting gentle transition from recovery to normal driving');
            this.recoveryPhase = 'gentle_drive';
            this.recoveryEndTime = Date.now(); // Zapisz czas zakończenia recovery
            this.gentleDriveTimer = 3.0; // 3 sekundy delikatnej jazdy
            
            // BARDZO delikatne sterowanie podczas przejścia
            return { left: false, right: false, up: true, down: false };
        }

        return {
            left: steer < -0.01,
            right: steer > 0.01,
            up: throttle > 0,
            down: false
        };
    }

    // --- FAZA 3: DELIKATNA JAZDA PO RECOVERY ---
    if (this.recoveryPhase === 'gentle_drive') {
        console.log(`[AI] Recovery Phase: GENTLE_DRIVE - very careful driving after recovery, timer=${this.gentleDriveTimer.toFixed(1)}`);
        
        this.gentleDriveTimer -= dt;
        
        if (this.gentleDriveTimer <= 0) {
            console.log('[AI] Gentle drive phase completed - returning to normal driving');
            this.ai.recoveryMode = false;
            this.recoveryPhase = 'assess';
            // Reset wszystkich timerów
            this.stabilizationTimer = 0;
            this.currentThrottle = 0;
            this.lastSpeed = 0;
            return { left: false, right: false, up: false, down: false };
        }
        
        // NOWE: Wykrywanie nagłych zmian prędkości również w gentle_drive
        const speedChange = Math.abs(state.speed - this.lastSpeed);
        this.lastSpeed = state.carAngle;
        
        if (speedChange > this.speedChangeThreshold * 0.5) { // Jeszcze bardziej wrażliwe
            console.log(`[AI] Sudden movement in gentle drive: ${speedChange.toFixed(1)} - slowing down`);
            this.gentleDriveTimer += 0.5; // Przedłuż fazę gentle_drive
            return { left: false, right: false, up: false, down: true };
        }
        
        // BARDZO delikatne sterowanie - jak nowicjusz
        const targetWP = this.ai.waypoints[this.ai.currentWaypointIndex];
        const angleToTarget = Math.atan2(targetWP.y - this.ai.carY, targetWP.x - this.ai.carX);
        const angleDiff = this.ai._normalizeAngle(angleToTarget - state.carAngle);
        
        // Jeszcze bardziej delikatne sterowanie z dodatkowym tłumieniem
        const baseSteer = angleDiff * 0.02;
        const steer = Phaser.Math.Clamp(baseSteer * this.momentumDamping, -0.01, 0.01); // 10x mniej agresywne!
        
        // NOWE: Stopniowe zwiększanie throttle również w gentle_drive
        this.currentThrottle = Math.min(this.currentThrottle + this.gradualThrottleIncrease * dt * 0.5, this.cautiousThrottle * 0.05);
        const throttle = this.currentThrottle;
        
        console.log(`[AI] GENTLE DRIVE: steer=${steer.toFixed(4)}, throttle=${throttle.toFixed(4)}, speed=${state.speed.toFixed(1)}, momentum=${this.momentumDamping.toFixed(2)}`);
        
        return {
            left: steer < -0.005,
            right: steer > 0.005,
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
    
    if (this.collisionCount === 1) {
      // Pierwsza kolizja - natychmiast jedź do przodu z tą samą kierownicą
      console.log('[AI] First collision - switching to forward with same steering');
      this.reverseObstaclePhase = 'forward_steer';
      this.ai.recoveryTimer = 1.0; // Krótki czas na jazdę do przodu
    } else if (this.collisionCount === 2) {
      // Druga kolizja - delikatnie cofaj z kierownicą w tym samym kierunku
      console.log('[AI] Second collision - gentle reverse with same steering');
      this.reverseObstaclePhase = 'gentle_reverse';
      this.ai.recoveryTimer = 2.0; // Dłuższy czas na delikatne cofanie
    } else if (this.collisionCount >= 3) {
      // Trzecia i kolejne kolizje - znajdź najbliższy waypoint i jedź do niego
      console.log('[AI] Multiple collisions - finding nearest waypoint instead of excessive backing');
      this.reverseObstaclePhase = 'find_nearest_waypoint';
      this.ai.recoveryTimer = 3.0; // Krótszy czas na znalezienie waypointa
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
    
    // Jeśli minęło wystarczająco czasu, pozwól na zmianę kierunku
    if (timeSinceLastChange >= this.steeringStabilityDelay) {
      this.lastSteeringChange = currentTime;
      return Phaser.Math.Clamp(angleDiff * 0.03, -0.015, 0.015);
    }
    
    // W przeciwnym razie używaj bardzo delikatnego skręcania
    return Phaser.Math.Clamp(angleDiff * 0.01, -0.005, 0.005);
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