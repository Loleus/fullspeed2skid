// AICar.js
import { Car } from "../vehicles/car.js";
import { aiConfig } from "./aiConfig.js";
import { AIDriving } from "./aiDriving.js";
import { AIRecovery } from "./aiRecovery.js";

export class AICar extends Car {
  constructor(scene, carSprite, worldData, waypoints) {
    super(scene, carSprite, worldData);
    this.isAI = true; // Ustawiamy flagę AI
    this.config = aiConfig;

    this.waypoints = waypoints;
    this.currentWaypointIndex = 0;
    this.recoverySubPhase = 'normal';
    this.recoverySteer = 0;

    // Parametry sterowania
    this.waypointZoneRadius = this.config.waypointZoneRadius;
    this.steerP = this.config.steerP;
    this.maxSteerInput = this.config.maxSteerInput;
    this.deadZoneAngle = this.config.deadZoneAngle;

    // Lookahead
    this.lookaheadDistance = this.config.lookaheadDistance;

    // Stan
    this.steerCommand = 0;
    this.debugAngle = 0;

    // Wykrywanie utknięcia (stan)
    this.stuckDetector = {
      lastPosition: { x: 0, y: 0 },
      positionTimer: 0,
      minMovementDistance: this.config.stuckDetector.minMovementDistance,
      stuckTime: 0
    };

    // Recovery (stan i parametry)
    this.recoveryMode = false;
    this.recoveryTimer = 0;
    this.recoveryPhase = 'reverse';
    this.recoveryAttempts = 0;
    this.maxRecoveryAttempts = this.config.recovery.maxRecoveryAttempts;

    // Danger zones (stan i parametry)
    this.dangerZones = [];
    this.maxDangerZones = this.config.dangerZones.maxDangerZones;
    this.dangerZoneRadius = this.config.dangerZones.dangerZoneRadius;
    this.dangerZoneAvoidTime = this.config.dangerZones.dangerZoneAvoidTime;

    // Desperate mode
    this.desperateMode = false;
    this.desperateModeTimer = 0;
    this.desperateSkipDistance = this.config.desperateMode.skipDistance;

    // Debug
    this.debugTimer = 0;
    this.debugInterval = this.config.debugInterval;

    // Stabilizacja waypointa
    this.waypointStability = {
      lastChangeTime: 0,
      minChangeInterval: this.config.waypointStabilityMinChangeInterval
    };

    // Inicjalizacja modułów (przekazujemy referencję do this)
    this.aiDriving = new AIDriving(this);
    this.aiRecovery = new AIRecovery(this);
  }

  updateAI(dt, worldW, worldH) {
    const state = this.getFullState();

    // Debug
    // this._updateDebug(dt, state);

    // Aktualizuj tryb desperacki
    this._updateDesperateMode(dt);

    // Wyczyść stare strefy niebezpieczne
    this._cleanupDangerZones();

    // Wykryj utknięcie
    this._detectStuck(dt);

    // Tryb recovery
    if (this.recoveryMode) {
      const recoveryControl = this._handleSmarterRecovery(dt, state);
      this.update(dt, recoveryControl, worldW, worldH);
      return;
    }

    // Tryb desperacki - pomiń problematyczne obszary
    if (this.desperateMode) {
      const desperateControl = this._handleDesperateMode(dt, state);
      this.update(dt, desperateControl, worldW, worldH);
      return;
    }

    // Sprawdź obecny waypoint
    this._checkWaypointCompletion();

    // Wybierz cel - unikaj stref niebezpiecznych
    const targetWP = this._getSafeTarget();

    // Oblicz kierunek do celu
    const distToTarget = Math.hypot(
      targetWP.x - this.carX,
      targetWP.y - this.carY
    );

    const angleToTarget = Math.atan2(
      targetWP.y - this.carY,
      targetWP.x - this.carX
    );

    let angleDiff = this._normalizeAngle(angleToTarget - state.carAngle);
    this.debugAngle = Phaser.Math.RadToDeg(angleDiff);

    // Oblicz sterowanie z użyciem nowych parametrów konfiguracyjnych
    let steer = 0;
    let throttle = this.config.speed.baseThrottle;

    const absAngleDiff = Math.abs(angleDiff);

    if (absAngleDiff < this.deadZoneAngle) {
      steer = 0;
      throttle = this.config.speed.baseThrottle;
    } else {
      // Podstawowe sterowanie z uwzględnieniem czułości
      steer = angleDiff * this.config.steering.baseSensitivity;
      steer = Phaser.Math.Clamp(steer, -this.maxSteerInput, this.maxSteerInput);

      // Dostosowanie throttle na podstawie kąta
      const angleThresholds = this.config.waypointControl.angleThresholds;
      const throttleMultipliers = this.config.waypointControl.throttleMultipliers;

      if (absAngleDiff > angleThresholds.extreme) {
        throttle = throttleMultipliers.extreme;
      } else if (absAngleDiff > angleThresholds.high) {
        throttle = throttleMultipliers.high;
      } else if (absAngleDiff > angleThresholds.medium) {
        throttle = throttleMultipliers.medium;
      } else if (absAngleDiff > angleThresholds.small) {
        throttle = throttleMultipliers.small;
      } else {
        throttle = throttleMultipliers.optimal;
      }
    }

    // Kontrola prędkości
    const speedThresholds = this.config.speed.speedThresholds;
    if (state.speed > speedThresholds.high) {
      throttle = Math.min(throttle, speedThresholds.highSpeedThrottle);
    } else if (state.speed > speedThresholds.medium) {
      throttle = Math.min(throttle, speedThresholds.mediumSpeedThrottle);
    }

    // Kontrola poślizgu bocznego
    const lateralControl = this.config.lateralControl;
    if (Math.abs(state.v_y) > lateralControl.severeSlipThreshold) {
      throttle *= lateralControl.severeSlipThrottleMultiplier;
      steer *= lateralControl.severeSlipSteerMultiplier;
    } else if (Math.abs(state.v_y) > lateralControl.moderateSlipThreshold) {
      throttle *= lateralControl.moderateSlipThrottleMultiplier;
      steer *= lateralControl.moderateSlipSteerMultiplier;
    }

    if (this._isInDangerZone()) {
      console.log('[AI] In danger zone - extra caution');
      throttle *= 0.3;
    }

    this.steerCommand = steer;

    const control = {
      left: steer < -0.005,
      right: steer > 0.005,
      up: throttle > 0,
      down: false
    };

    super.update(dt, control, worldW, worldH);
  }

  // --- Wrappery delegujące do modułów (metody mają te same nazwy jak oryginalnie) ---
  _getSafeTarget() { return this.aiDriving._getSafeTarget(); }
  _isWaypointInDangerZone(waypoint) { return this.aiDriving._isWaypointInDangerZone(waypoint); }
  _isInDangerZone() { return this.aiDriving._isInDangerZone(); }
  _addDangerZone(x, y) { return this.aiDriving._addDangerZone(x, y); }
  _cleanupDangerZones() { return this.aiDriving._cleanupDangerZones(); }
  _enterDesperateMode() { return this.aiDriving._enterDesperateMode(); }
  _updateDesperateMode(dt) { return this.aiDriving._updateDesperateMode(dt); }
  _handleDesperateMode(dt, state) { return this.aiDriving._handleDesperateMode(dt, state); }
  _checkWaypointCompletion() { return this.aiDriving._checkWaypointCompletion(); }
  _detectStuck(dt) { return this.aiDriving._detectStuck(dt); }

  _handleSmarterRecovery(dt, state) { return this.aiRecovery._handleSmarterRecovery(dt, state); }
  _startSmartRecovery() { return this.aiRecovery._startSmartRecovery(); }

  _normalizeAngle(angle) {
    while (angle > Math.PI) angle -= 2 * Math.PI;
    while (angle < -Math.PI) angle += 2 * Math.PI;
    return angle;
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
        mode: this.desperateMode ? 'DESPERATE' :
          this.recoveryMode ? `REC-${this.recoveryAttempts}-${this.recoveryPhase}` : 'DRIVE',
        steer: this.steerCommand.toFixed(2),
        stuck: this.stuckDetector.stuckTime.toFixed(1),
        dangers: this.dangerZones.length
      };

      console.log('[AI]', JSON.stringify(debugInfo));
      this.debugTimer = 0;
    }
  }

  handleCollision(prevX, prevY, worldW, worldH) {
    super.handleCollision(prevX, prevY, worldW, worldH);

    // Dodaj miejsce kolizji jako strefę niebezpieczną
    this._addDangerZone(this.carX, this.carY);

    // Sprawdź czy to powtarzająca się kolizja w tym samym obszarze
    const recentCollisionsInArea = this.dangerZones.filter(zone => {
      const dist = Math.hypot(this.carX - zone.x, this.carY - zone.y);
      const timeDiff = Date.now() - zone.time;
      return dist < this.dangerZoneRadius && timeDiff < 10000; // 10 sekund
    });

    if (recentCollisionsInArea.length >= 2) {
      console.log(`[AI] Repeated collisions in area! Entering desperate mode`);
      this._enterDesperateMode();

      // Ograniczony przeskok waypointów - tylko +2, nie więcej
      this.currentWaypointIndex = (this.currentWaypointIndex + 2) % this.waypoints.length;
    } else {
      console.log(`[AI] Collision! Starting recovery (${this.dangerZones.length} danger zones)`);
      this._startSmartRecovery();
    }
  }

  getDebugInfo() {
    const state = this.getFullState();
    return {
      wp: `${this.currentWaypointIndex}/${this.waypoints.length}`,
      angle: this.debugAngle.toFixed(0) + '°',
      speed: state.speed.toFixed(0),
      mode: this.desperateMode ? 'DESP' :
        this.recoveryMode ? `REC${this.recoveryAttempts}` : 'OK',
      stuck: this.stuckDetector.stuckTime > 0 ? `${this.stuckDetector.stuckTime.toFixed(0)}s` : '',
      zones: this.dangerZones.length > 0 ? `D${this.dangerZones.length}` : ''
    };
  }

  resetState(initialX, initialY) {
    super.resetState(initialX, initialY);

    this.currentWaypointIndex = 0;
    this.steerCommand = 0;
    this.debugAngle = 0;

    this.stuckDetector.stuckTime = 0;
    this.stuckDetector.positionTimer = 0;
    this.stuckDetector.lastPosition = { x: initialX, y: initialY };

    this.recoveryMode = false;
    this.recoveryTimer = 0;
    this.recoveryPhase = 'reverse';
    this.recoveryAttempts = 0;

    this.dangerZones = [];

    this.desperateMode = false;
    this.desperateModeTimer = 0;

    this.debugTimer = 0;
    this.waypointStability.lastChangeTime = 0;

    this.body.setVelocity(0, 0);
    this.body.setAngularVelocity(0);
  }
}