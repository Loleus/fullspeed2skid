import { Car } from "./car.js";

export class AICar extends Car {
  constructor(scene, carSprite, worldData, waypoints) {
    super(scene, carSprite, worldData);
    this.waypoints = waypoints;
    this.currentWaypointIndex = 0;
    
    // Parametry sterowania
    this.waypointZoneRadius = 80; // Większy promień dla łatwiejszego zaliczania
    
    // Parametry skrętu - bardziej łagodne
    this.steerP = 0.4; // Zmniejszono z 0.6
    this.maxSteerInput = 0.2; // Zmniejszono z 0.25
    this.deadZoneAngle = 0.1; // Zwiększono z 0.08
    
    // Lookahead system - patrzenie na przyszłe waypoints
    this.lookaheadDistance = 150; // Jak daleko patrzeć w przód
    this.lookaheadWaypoints = 3; // Ile waypointów sprawdzać w przód
    
    // Stan
    this.steerCommand = 0;
    this.debugAngle = 0;
    
    // Wykrywanie utknięcia
    this.stuckDetector = {
      lastWaypoint: 0,
      sameWaypointTime: 0,
      maxStuckTime: 4.0 // Zwiększono z 3.0
    };
    
    // Recovery
    this.recoveryMode = false;
    this.recoveryTimer = 0;
    
    // Debug
    this.debugTimer = 0;
    this.debugInterval = 1.0;
  }

  updateAI(dt, worldW, worldH) {
    const state = this.getFullState();
    
    // Debug
    this._updateDebug(dt, state);
    
    // Wykryj utknięcie na tym samym waypoint
    this._detectStuck(dt);
    
    // Tryb recovery
    if (this.recoveryMode) {
      this.recoveryTimer -= dt;
      
      if (this.recoveryTimer <= 0) {
        this.recoveryMode = false;
        console.log('[AI] Recovery END');
      } else {
        // W recovery - cofaj i skręcaj łagodniej
        const nextWP = this.waypoints[(this.currentWaypointIndex + 1) % this.waypoints.length];
        const angleToNext = Math.atan2(nextWP.y - this.carY, nextWP.x - this.carX);
        const angleDiff = this._normalizeAngle(angleToNext - state.carAngle);
        
        const control = {
          left: angleDiff < -0.5, // Zwiększono próg
          right: angleDiff > 0.5,
          up: false,
          down: true // Cofaj
        };
        
        // Jeśli prędkość prawie zero, spróbuj jechać do przodu
        if (Math.abs(state.v_x) < 30) {
          control.up = true;
          control.down = false;
        }
        
        this.update(dt, control, worldW, worldH);
        return;
      }
    }
    
    // Wykryj poślizg - bardziej agresywne działanie
    if (Math.abs(state.v_y) > 100 && state.speed > 120) {
      console.log(`[AI] SLIDE! v_y=${state.v_y.toFixed(0)}`);
      // Wymuś zwolnienie i stabilizację
    }

    // Sprawdź waypoint
    this._checkCurrentWaypoint();
    
    // Pobierz cel z lookahead
    const targetInfo = this._getLookaheadTarget();
    
    // Odległość i kąt
    const distToTarget = Math.hypot(
      targetInfo.x - this.carX,
      targetInfo.y - this.carY
    );
    
    const angleToTarget = Math.atan2(
      targetInfo.y - this.carY,
      targetInfo.x - this.carX
    );
    
    let angleDiff = this._normalizeAngle(angleToTarget - state.carAngle);
    this.debugAngle = Phaser.Math.RadToDeg(angleDiff);
    
    // Oblicz sterowanie - bardziej łagodne
    let steer = 0;
    let throttle = 0.4; // Zmniejszono domyślną prędkość
    
    const absAngleDiff = Math.abs(angleDiff);
    
    // Łagodniejsza logika sterowania
    if (absAngleDiff < this.deadZoneAngle) {
      // Jedź prosto
      steer = 0;
      throttle = 0.6;
      
    } else {
      // Sterowanie proporcjonalne - bardziej łagodne
      steer = angleDiff * this.steerP;
      
      // Ogranicz maksymalne sterowanie
      steer = Phaser.Math.Clamp(steer, -this.maxSteerInput, this.maxSteerInput);
      
      // Dostosuj prędkość do kąta skrętu - bardziej konserwatywnie
      if (absAngleDiff > 1.2) { // > 69 stopni - bardzo ostry
        throttle = 0.1;
        steer = Math.sign(angleDiff) * 0.25; // Zmniejszono z 0.35
      } else if (absAngleDiff > 0.8) { // > 46 stopni
        throttle = 0.15;
      } else if (absAngleDiff > 0.4) { // > 23 stopni
        throttle = 0.25;
      } else if (absAngleDiff > 0.2) { // > 11 stopni
        throttle = 0.35;
      } else {
        throttle = 0.5;
      }
    }
    
    // Dodatkowe ograniczenia prędkości
    if (state.speed > 300) {
      throttle = Math.min(throttle, 0.2);
    } else if (state.speed > 250) {
      throttle = Math.min(throttle, 0.3);
    }
    
    // Anty-poślizg - bardziej agresywne
    if (Math.abs(state.v_y) > 60) {
      throttle *= 0.3; // Zmniejszono z 0.5
      steer *= 0.6; // Zmniejszono z 0.8
    }
    
    // Sprawdź czy następny waypoint wymaga ostrego skrętu
    const upcomingTurnSharpness = this._getUpcomingTurnSharpness();
    if (upcomingTurnSharpness > 1.0) { // Ostry zakręt
      throttle *= 0.7;
    }
    
    this.steerCommand = steer;
    
    // Kontrola
    const control = {
      left: steer < -0.01, // Zmniejszono próg
      right: steer > 0.01,
      up: throttle > 0,
      down: false
    };

    this.update(dt, control, worldW, worldH);
  }
  
  _getLookaheadTarget() {
    // Sprawdź czy należy patrzeć dalej w przód
    const currentWP = this.waypoints[this.currentWaypointIndex];
    const distToCurrent = Math.hypot(currentWP.x - this.carX, currentWP.y - this.carY);
    
    // Jeśli jesteśmy blisko obecnego waypointa, patrz na następny
    if (distToCurrent < this.lookaheadDistance) {
      const nextIndex = (this.currentWaypointIndex + 1) % this.waypoints.length;
      const nextWP = this.waypoints[nextIndex];
      const distToNext = Math.hypot(nextWP.x - this.carX, nextWP.y - this.carY);
      
      // Jeśli i następny jest blisko, patrz jeszcze dalej
      if (distToNext < this.lookaheadDistance * 0.7) {
        const furtherIndex = (this.currentWaypointIndex + 2) % this.waypoints.length;
        return this.waypoints[furtherIndex];
      }
      
      return nextWP;
    }
    
    return currentWP;
  }
  
  _getUpcomingTurnSharpness() {
    const currentIndex = this.currentWaypointIndex;
    const nextIndex = (currentIndex + 1) % this.waypoints.length;
    const afterNextIndex = (currentIndex + 2) % this.waypoints.length;
    
    const current = this.waypoints[currentIndex];
    const next = this.waypoints[nextIndex];
    const afterNext = this.waypoints[afterNextIndex];
    
    // Oblicz kąty między segmentami
    const angle1 = Math.atan2(next.y - current.y, next.x - current.x);
    const angle2 = Math.atan2(afterNext.y - next.y, afterNext.x - next.x);
    
    const angleDiff = Math.abs(this._normalizeAngle(angle2 - angle1));
    
    return angleDiff; // Zwraca ostrość zakrętu w radianach
  }
  
  _normalizeAngle(angle) {
    while (angle > Math.PI) angle -= 2 * Math.PI;
    while (angle < -Math.PI) angle += 2 * Math.PI;
    return angle;
  }
  
  _detectStuck(dt) {
    // Sprawdź czy nadal na tym samym waypoint
    if (this.currentWaypointIndex === this.stuckDetector.lastWaypoint) {
      this.stuckDetector.sameWaypointTime += dt;
      
      // Jeśli za długo na tym samym waypoint
      if (this.stuckDetector.sameWaypointTime > this.stuckDetector.maxStuckTime) {
        console.log(`[AI] STUCK on WP ${this.currentWaypointIndex}! Forcing skip`);
        
        // Przesuń się do następnego waypointa
        this.currentWaypointIndex = (this.currentWaypointIndex + 1) % this.waypoints.length;
        
        // Włącz recovery mode
        this.recoveryMode = true;
        this.recoveryTimer = 2.0; // Zwiększono z 1.5
        
        // Reset licznika
        this.stuckDetector.sameWaypointTime = 0;
        this.stuckDetector.lastWaypoint = this.currentWaypointIndex;
      }
    } else {
      // Zmienił się waypoint - reset
      this.stuckDetector.lastWaypoint = this.currentWaypointIndex;
      this.stuckDetector.sameWaypointTime = 0;
    }
  }
  
  _checkCurrentWaypoint() {
    const currentWP = this.waypoints[this.currentWaypointIndex];
    const dist = Math.hypot(
      currentWP.x - this.carX,
      currentWP.y - this.carY
    );
    
    // Zalicz waypoint - większy promień
    if (dist < this.waypointZoneRadius) {
      const prevIndex = this.currentWaypointIndex;
      this.currentWaypointIndex = (this.currentWaypointIndex + 1) % this.waypoints.length;
      console.log(`[AI] WP ${prevIndex} -> ${this.currentWaypointIndex}`);
      return;
    }
    
    // Sprawdź czy waypoint jest bardzo daleko za nami
    const angleToWP = Math.atan2(
      currentWP.y - this.carY,
      currentWP.x - this.carX
    );
    const angleDiff = Math.abs(this._normalizeAngle(angleToWP - this.getAngle()));
    
    // Pomiń jeśli waypoint jest bardzo z tyłu i daleko
    if (angleDiff > 2.5 && dist > 200) { // Zmniejszono progi
      console.log(`[AI] WP ${this.currentWaypointIndex} far behind, skipping`);
      this.currentWaypointIndex = (this.currentWaypointIndex + 1) % this.waypoints.length;
    }
  }
  
  _updateDebug(dt, state) {
    this.debugTimer += dt;
    
    if (this.debugTimer >= this.debugInterval) {
      const targetWP = this.waypoints[this.currentWaypointIndex];
      const distToTarget = Math.hypot(targetWP.x - this.carX, targetWP.y - this.carY);
      
      const debugInfo = {
        wp: this.currentWaypointIndex,
        dist: distToTarget.toFixed(0),
        angle: this.debugAngle.toFixed(1) + '°',
        speed: state.speed.toFixed(0),
        v_y: state.v_y.toFixed(0),
        mode: this.recoveryMode ? 'RECOVERY' : 'DRIVE',
        steer: this.steerCommand.toFixed(2),
        stuck: this.stuckDetector.sameWaypointTime.toFixed(1)
      };
      
      console.log('[AI]', JSON.stringify(debugInfo));
      this.debugTimer = 0;
    }
  }

  handleCollision(prevX, prevY, worldW, worldH) {
    super.handleCollision(prevX, prevY, worldW, worldH);
    
    // Po kolizji przesuń do następnego waypointa
    console.log(`[AI] Collision! Skip to next WP`);
    this.currentWaypointIndex = (this.currentWaypointIndex + 1) % this.waypoints.length;
    
    // Włącz recovery
    this.recoveryMode = true;
    this.recoveryTimer = 2.5; // Zwiększono
    
    // Reset stuck detector
    this.stuckDetector.sameWaypointTime = 0;
  }

  getDebugInfo() {
    const state = this.getFullState();
    return {
      wp: `${this.currentWaypointIndex}/${this.waypoints.length}`,
      angle: this.debugAngle.toFixed(0) + '°',
      speed: state.speed.toFixed(0),
      mode: this.recoveryMode ? 'REC' : 'OK',
      stuck: this.stuckDetector.sameWaypointTime > 1 ? 
        `${this.stuckDetector.sameWaypointTime.toFixed(1)}s` : ''
    };
  }
}