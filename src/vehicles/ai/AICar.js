import { Car } from "../Car.js";
import { aiConfig } from "./aiConfig.js";
import { AIDriving } from "./aiDriving.js";
import { CollisionManager } from "./CollisionManager.js";

// Klasa przeciwnika AI
export class AICar extends Car {
  constructor(scene, carSprite, worldData, waypoints) {
    super(scene, carSprite, worldData);
    this.isAI = true; // Ustawiamy flagę AI
    this.config = aiConfig;
    this.waypoints = waypoints;
    this.currentWaypointIndex = 0;

    // Parametry sterowania
    this.waypointZoneRadius = this.config.waypointZoneRadius;
    this.steerP = this.config.steerP;
    this.maxSteerInput = this.config.maxSteerInput;
    this.deadZoneAngle = this.config.deadZoneAngle;

    // Stan
    this.steerCommand = 0;
    this.debugTimer = 0;
    this.debugInterval = this.config.debugInterval;

    // Stan wykrywania utknięcia
    this.stuckDetector = {
      lastPosition: { x: 0, y: 0 },
      positionTimer: 0,
      stuckTime: 0,
      minMovementDistance: this.config.stuckDetector.minMovementDistance
    };

    // Stan po kolizji
    this.postCollision = {
      active: false,
      steerHoldTimer: 0,
      throttleCooldown: 0,
      totalTimer: 0
    };

    // Parametry kolizji z graczem
    this.collisionWithPlayer = {
      isReversing: false,
      reverseStartTime: 0,
      reverseDuration: 0
    };

    // Inicjalizacja menedżera kolizji
    this.collisionManager = new CollisionManager();

    // Inicjalizacja modułu AI driving
    this.aiDriving = new AIDriving(this);
  }

  // Implementacja fizyki dla AI
  updatePhysics(dt, steerInput, throttle, surface) {
    // Pobierz parametry nawierzchni
    this.throttle = throttle;
    let grip = this.worldData.surfaceParams?.[surface]?.grip ?? 1.0;
    let localMaxSpeed = this.maxSpeed * grip;
    let localMaxRevSpeed = this.maxRevSpeed * grip;
    let localSlipStartSpeed = this.SLIP_START_SPEED_RATIO * localMaxSpeed;
    let localSlipBase = this.slipBase;

    // Dynamiczne tłumienie boczne
    this.sideFrictionMultiplier = grip < 0.5 ? 0.2 : 3;

    // Sterowanie skrętem - zawsze standardowe dla AI
    if (Math.abs(steerInput) > this.steerInputThreshold) {
      this.steerAngle += steerInput * this.steerSpeed * dt;
      this.steerAngle = Phaser.Math.Clamp(this.steerAngle, -this.maxSteer, this.maxSteer);
    } else if (this.steerAngle !== 0) {
      let speedAbs = Math.abs(this.v_x);
      if (speedAbs > this.speedThresholdForSteerReturn) {
        let factor = speedAbs / localMaxSpeed;
        let steerReturn = this.steerReturnSpeed * factor;
        if (this.steerAngle > 0) {
          this.steerAngle -= steerReturn * dt;
          if (this.steerAngle < 0) this.steerAngle = 0;
        } else {
          this.steerAngle += steerReturn * dt;
          if (this.steerAngle > 0) this.steerAngle = 0;
        }
      }
    }

    // Przyspieszenie i opory
    let force;
    if (throttle >= 0) {
      force = throttle * this.accel;
    } else {
      force = throttle * this.revAccel;
    }
    this.v_x += force * dt;

    // Ograniczanie prędkości
    if (this.v_x >= 0) {
      this.v_x = Phaser.Math.Clamp(this.v_x, 0, localMaxSpeed);
    } else {
      this.v_x = Phaser.Math.Clamp(this.v_x, -localMaxRevSpeed, 0);
    }

    // Model poślizgu dla AI
    let steerAbs = Math.abs(this.steerAngle);
    let speedAbs = Math.abs(this.v_x);
    if (
      speedAbs > localSlipStartSpeed &&
      steerAbs > this._slipSteerThreshold
    ) {
      let slipSteerRatio = (steerAbs - this._slipSteerThreshold) / (this.maxSteer - this._slipSteerThreshold);
      slipSteerRatio = Phaser.Math.Clamp(slipSteerRatio, 0, 1);
      let slipSign = -Math.sign(this.steerAngle);
      let slipStrength = localSlipBase * (speedAbs / localMaxSpeed) * slipSteerRatio * slipSign;
      this.v_y += slipStrength * dt;
      const maxVy = localMaxSpeed * this.maxVyRatio;
      if (Math.abs(this.v_y) > maxVy) this.v_y = maxVy * Math.sign(this.v_y);
    }

    // Tłumienie boczne
    this.v_y += -this.v_y * this.sideFrictionMultiplier * dt;

    // Efekt skrętu
    let cosA = Math.cos(this.carAngle);
    let sinA = Math.sin(this.carAngle);
    let angularVel = (this.v_x / this.wheelBase) * Math.tan(this.steerAngle);
    this.carAngle += angularVel * dt;

    // Aktualizacja pozycji
    this.carX += (this.v_x * cosA - this.v_y * sinA) * dt;
    this.carY += (this.v_x * sinA + this.v_y * cosA) * dt;

    // Opory toczenia i aerodynamiczne
    let F_drag = this._dragConst * this.v_x * Math.abs(this.v_x);
    let F_roll = this.rollingResistance * this.carMass * this.gravity * Math.sign(this.v_x);
    let F_total = F_drag + F_roll;
    this.v_x -= (F_total / this.carMass) * dt;

    // Aktualizuj sprite
    this.carSprite.x = this.carX;
    this.carSprite.y = this.carY;
    this.carSprite.rotation = this.carAngle + Math.PI / 2;
    this.carSprite.steerAngle = this.steerAngle;
  }

  // Implementacja sterowania dla AI
  updateInput(control) {
    // Reset licznika kolizji
    this.collisionCount = 0;

    // AI automatycznie odblokowuje gaz po czasie
    let throttle = 0;
    if (!this.throttleLock) {
      throttle = control.up ? 1 : control.down ? -1 : 0;
    } else if (this.collisionImmunity <= 0) {
      this.throttleLock = false;
      throttle = control.up ? 1 : control.down ? -1 : 0;
    }

    // Skręt
    const steerRaw = control.left ? -1 : control.right ? 1 : 0;

    // Wygładzanie sterowania
    this.steerInput = this.steerInput * this.steerSmoothFactor + steerRaw * (1 - this.steerSmoothFactor);

    return { throttle, steerInput: this.steerInput };
  }

  updateAI(dt, worldW, worldH) {

    const state = this.getFullState();

    // Wykryj utknięcie
    this._detectStuck(dt);

    // Post-collision grace handling (on-road): don't turn, wait bounce, then go
    if (this.postCollision.active) {
      this.postCollision.steerHoldTimer -= dt;
      this.postCollision.throttleCooldown -= dt;
      this.postCollision.totalTimer -= dt;
      if (this.postCollision.steerHoldTimer < 0) this.postCollision.steerHoldTimer = 0;
      if (this.postCollision.throttleCooldown < 0) this.postCollision.throttleCooldown = 0;

      const control = {
        left: false,
        right: false,
        up: this.postCollision.throttleCooldown <= 0,
        down: false
      };

      // Exit conditions: timer elapsed or clearly moving forward again
      if (this.postCollision.totalTimer <= 0 || state.v_x > 10) {
        this.postCollision.active = false;
      }

      this.update(dt, control, worldW, worldH);
      return;
    }

    // Sprawdź obecny waypoint
    this._checkWaypointCompletion();

    // Wybierz cel
    let targetWP = this._getSafeTarget();

    // Oblicz kierunek do celu
    let distToTarget = Math.hypot(
      targetWP.x - this.carX,
      targetWP.y - this.carY
    );

    let angleToTarget = Math.atan2(
      targetWP.y - this.carY,
      targetWP.x - this.carX
    );

    let angleDiff = this._normalizeAngle(angleToTarget - state.carAngle);
    this.debugAngle = Phaser.Math.RadToDeg(angleDiff);

    // Oblicz sterowanie z użyciem nowych parametrów konfiguracyjnych
    let steer = 0;
    let throttle = this.config.speed.baseThrottle;

    let absAngleDiff = Math.abs(angleDiff);

    // Sterowanie z parametrami z konfiguracji
    if (absAngleDiff < this.deadZoneAngle) {
      steer = 0;
      throttle = this.config.speed.baseThrottle;
    } else {
      steer = angleDiff * this.config.steering.baseSensitivity;

      // Zmniejsz czułość skrętu przy dużej prędkości
      if (state.speed > this.config.speed.speedThresholds.high) {
        steer *= this.config.steering.speedReductionFactor;
      }

      // Dostosuj throttle na podstawie kąta
      const angleThresholds = this.config.waypointControl.angleThresholds;
      const throttleMultipliers = this.config.waypointControl.throttleMultipliers;

      if (absAngleDiff > angleThresholds.extreme) {
        throttle *= throttleMultipliers.extreme;
      } else if (absAngleDiff > angleThresholds.high) {
        throttle *= throttleMultipliers.high;
      } else if (absAngleDiff > angleThresholds.medium) {
        throttle *= throttleMultipliers.medium;
      } else if (absAngleDiff > angleThresholds.small) {
        throttle *= throttleMultipliers.small;
      } else {
        throttle *= throttleMultipliers.optimal;
      }
    }

    // Kontrola prędkości
    let speedThresholds = this.config.speed.speedThresholds;
    if (state.speed > speedThresholds.high) {
      throttle = Math.min(throttle, speedThresholds.highSpeedThrottle);
    } else if (state.speed > speedThresholds.medium) {
      throttle = Math.min(throttle, speedThresholds.mediumSpeedThrottle);
    }

    // Redukcja gazu przy poślizgu bocznym
    let lateralControl = this.config.lateralControl;
    if (Math.abs(state.v_y) > lateralControl.severeSlipThreshold) {
      throttle *= lateralControl.severeSlipThrottleMultiplier;
      steer *= lateralControl.severeSlipSteerMultiplier;
    } else if (Math.abs(state.v_y) > lateralControl.moderateSlipThreshold) {
      throttle *= lateralControl.moderateSlipThrottleMultiplier;
      steer *= lateralControl.moderateSlipSteerMultiplier;
    }

    this.steerCommand = steer;

    // Sprawdź czy jesteśmy w trybie unikania gracza
    if (this.collisionWithPlayer.isReversing) {
      const now = Date.now();
      const reverseElapsed = now - this.collisionWithPlayer.reverseStartTime;

      if (reverseElapsed >= this.collisionWithPlayer.reverseDuration) {
        // Zakończ manewr unikania
        this.collisionWithPlayer.isReversing = false;
        this.collisionManager.reset();
      } else {
        // Cofaj w kierunku poprzedniego waypointa
        const prevWaypoint = this.waypoints[this.currentWaypointIndex];
        const angleToWaypoint = Math.atan2(
          prevWaypoint.y - this.carY,
          prevWaypoint.x - this.carX
        );
        
        const angleDiff = this._normalizeAngle(angleToWaypoint - state.carAngle);

        control = {
          left: angleDiff < -0.1,
          right: angleDiff > 0.1,
          up: false,
          down: true
        };

        super.update(dt, control, worldW, worldH);
        return;
      }
    }

    // Standardowe sterowanie
    let control = {
      left: steer < -0.005,
      right: steer > 0.005,
      up: throttle > 0 && !this.throttleLock, // Sprawdź throttleLock
      down: false
    };

    super.update(dt, control, worldW, worldH);
  }

  // --- Wrappery delegujące do modułów  ---
  _getSafeTarget() { return this.aiDriving._getSafeTarget(); }
  _checkWaypointCompletion() { return this.aiDriving._checkWaypointCompletion(); }
  _detectStuck(dt) { return this.aiDriving._detectStuck(dt); }

  // Normalizuj kąt (w radianach) do przedziału (-Math.PI, Math.PI)
  _normalizeAngle(angle) {
    while (angle > Math.PI) angle -= 2 * Math.PI;
    while (angle < -Math.PI) angle += 2 * Math.PI;
    return angle;
  }

  // Pełny debug
  _updateDebug(dt, state) {

    // dodaj upływ czasu do wewnętrznego licznika debugowego
    this.debugTimer += dt;

    // jeśli minął interwał debugowania, wykonaj logowanie
    if (this.debugTimer >= this.debugInterval) {
      // pobierz aktualny waypoint z listy (uwaga: może być undefined jeśli indeks poza zakresem)
      let targetWP = this.waypoints[this.currentWaypointIndex];

      // oblicz odległość do celu; zakłada się, że targetWP, carX i carY są zainicjowane
      let distToTarget = Math.hypot(targetWP.x - this.carX, targetWP.y - this.carY);

      // zbiór sformatowanych informacji debugowych
      let debugInfo = {
        // indeks docelowego waypointa
        wp: this.currentWaypointIndex,
        // dystans zaokrąglony do najbliższej jedności (string z toFixed)
        dist: distToTarget.toFixed(0),
        // kąt debugowy sformatowany z jedną cyfrą i symbolem stopnia
        angle: this.debugAngle.toFixed(1) + '°',
        // prędkość i prędkość poprzeczna zaokrąglone do całek
        speed: state.speed.toFixed(0),
        v_y: state.v_y.toFixed(0),
        // komenda kierownicy z dwoma miejscami po przecinku
        steer: this.steerCommand.toFixed(2),
        // czas "utkwienia" z detektora utkwienia (jedna cyfra po przecinku)
        stuck: this.stuckDetector.stuckTime.toFixed(1)
      };

      // wypisz JSON do konsoli; przy dużej częstotliwości warto kontrolować poziom logów
      console.log('[AI]', JSON.stringify(debugInfo));

      // zresetuj licznik aby zacząć odliczanie od nowa
      this.debugTimer = 0;
    }
  }


  handleCollision(prevX, prevY, worldW, worldH, collidedObject) {
    super.handleCollision(prevX, prevY, worldW, worldH);

    // Sprawdzamy czy kolizja była z graczem
    if (collidedObject?.isPlayer) {

      // Użyj menedżera kolizji do sprawdzenia czy powinniśmy rozpocząć unikanie
      if (!this.collisionManager) {
        this.collisionManager = new CollisionManager();
      }

      if (this.collisionManager.handlePlayerCollision(this, collidedObject)) {

        // Rozpocznij manewr unikania
        this.collisionWithPlayer.isReversing = true;
        this.collisionWithPlayer.reverseStartTime = Date.now();
        this.collisionWithPlayer.reverseDuration = this.collisionManager.getAvoidanceDuration();

        // Zmniejszamy index waypointa o 1, aby cofnąć się do poprzedniego punktu
        this.currentWaypointIndex = Math.max(0, this.currentWaypointIndex - 1);

        console.log('[AI] Rozpoczynam manewr unikania gracza');
        return;
      }
    }

    // Standardowa logika dla innych kolizji
    let surfaceHere = this.worldData.getSurfaceTypeAt(this.carX, this.carY);
    let onRoad = surfaceHere !== 'obstacle';

    if (onRoad) {
      console.log('[AI] Collision on road – applying post-collision grace');
      this.postCollision.active = true;
      this.postCollision.steerHoldTimer = 0.4;
      this.postCollision.throttleCooldown = 0.25;
      this.postCollision.totalTimer = 0.8;
    }
  }
  // Prosty debug
  getDebugInfo() {
    const state = this.getFullState();
    return {
      wp: `${this.currentWaypointIndex}/${this.waypoints.length}`,
      speed: state.speed.toFixed(0)
    };
  }

  resetState(initialX, initialY) {
    super.resetState(initialX, initialY);
    this.currentWaypointIndex = 0;
    this.steerCommand = 0;
    this.body.setVelocity(0, 0);
    this.body.setAngularVelocity(0);
  }
}