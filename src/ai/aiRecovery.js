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
    this.minReverseSpeed = -4; // Wolniejsze cofanie
    this.reverseTime = 4.0; // Dłuższy czas cofania (4 sekundy)
    this.gentleDriveTimer = 0; // Timer dla delikatnej jazdy
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
        
        // ZAWSZE przejdź do cofania - nie sprawdzaj czy waypoint jest "widoczny"
        // AI musi się wycofać z problematycznego obszaru
        console.log('[AI] Always backing up from problem area - no shortcuts!');
        
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
            // NAPRAWKA: Nie dodawaj Math.PI - AI ma skręcać w kierunku waypointa, nie w przeciwnym!
            const angleDiff = this.ai._normalizeAngle(angleToTarget - state.carAngle);
            
            // Bardzo ostrożne skręcanie podczas cofania
            const steer = Phaser.Math.Clamp(angleDiff * 0.1, -0.05, 0.05); // 6x mniej agresywne!
            
            console.log(`[AI] REVERSE COMMAND: down=true, steer=${steer.toFixed(2)}, angleDiff=${angleDiff.toFixed(2)}`);
            return {
                left: steer < -0.01,
                right: steer > 0.01,
                up: false,
                down: true // WYMUŚ COFANIE!
            };
        }

        // Po cofnięciu przejdź bezpośrednio do ostrożnego podejścia
        if (Math.abs(state.speed) < 1.0 && this.ai.recoveryTimer < 0.5) {
            console.log('[AI] Speed low enough, transitioning to cautious approach');
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
        
        // Najpierw zatrzymaj się i ocenij sytuację
        if (Math.abs(state.speed) > 2) {
            console.log('[AI] Still moving, stopping first...');
            return { left: false, right: false, up: false, down: true };
        }
        
        // BARDZO delikatne i ostrożne sterowanie - jak prawdziwy kierowca po wypadku
        const steer = Phaser.Math.Clamp(angleDiff * 0.05, -0.02, 0.02); // 6x mniej agresywne!
        
        // BARDZO ostrożny gaz - wolno i spokojnie
        const throttle = this.cautiousThrottle * 0.1; // 10x wolniej!
        
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
            return { left: false, right: false, up: false, down: false };
        }
        
        // BARDZO delikatne sterowanie - jak nowicjusz
        const targetWP = this.ai.waypoints[this.ai.currentWaypointIndex];
        const angleToTarget = Math.atan2(targetWP.y - this.ai.carY, targetWP.x - this.ai.carX);
        const angleDiff = this.ai._normalizeAngle(angleToTarget - state.carAngle);
        
        // Jeszcze bardziej delikatne sterowanie
        const steer = Phaser.Math.Clamp(angleDiff * 0.02, -0.01, 0.01); // 10x mniej agresywne!
        
        // BARDZO wolny gaz
        const throttle = this.cautiousThrottle * 0.05; // 20x wolniej!
        
        console.log(`[AI] GENTLE DRIVE: steer=${steer.toFixed(3)}, throttle=${throttle.toFixed(3)}, speed=${state.speed.toFixed(1)}`);
        
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