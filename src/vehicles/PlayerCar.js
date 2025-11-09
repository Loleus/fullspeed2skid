import { Car } from "./Car.js";

export class PlayerCar extends Car {
  constructor(scene, carSprite, worldData, playerIndex = 1) {
    super(scene, carSprite, worldData);
    this.isAI = false;
    this.isPlayer = true;
    this.playerIndex = playerIndex; // 1 lub 2

    // Dodatkowe właściwości specyficzne dla gracza
    this.playerControls = null;
    this.gyroEnabled = false;
    this.touchControls = false;
  }

  // Implementacja fizyki specyficzna dla gracza
  updatePhysics(dt, steerInput, throttle, surface) {
    // Pobierz parametry nawierzchni
    this.throttle = throttle;
    let grip = this.worldData.surfaceParams?.[surface]?.grip ?? 1.0;
    let localMaxSpeed = this.maxSpeed * grip;
    let localMaxRevSpeed = this.maxRevSpeed * grip;
    let localSlipStartSpeed = this.SLIP_START_SPEED_RATIO * localMaxSpeed;
    let localSlipBase = this.slipBase;

    // Dynamiczne tłumienie boczne: na bardzo śliskich nawierzchniach (grip < 0.5) auto praktycznie nie trzyma się drogi
    this.sideFrictionMultiplier = grip < 0.5 ? 0.2 : 3;

    // Sterowanie skrętem - specyficzne dla gracza z obsługą żyroskopu
    if (Math.abs(steerInput) > this.steerInputThreshold) {
      // Dla gracza używaj odpowiedniego sterowania (żyroskop/standardowe) - identycznie jak przed modularyzacją
      window._gyroTilt ? this.steerAngle = steerInput * Math.abs(window._gyroTilt.toFixed(1)) * dt : this.steerAngle += steerInput * this.steerSpeed * dt;
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

    // Ograniczanie prędkości zależnie od kierunku
    if (this.v_x >= 0) {
      this.v_x = Phaser.Math.Clamp(this.v_x, 0, localMaxSpeed);
    } else {
      this.v_x = Phaser.Math.Clamp(this.v_x, -localMaxRevSpeed, 0);
    }

    // Model poślizgu: siła boczna (drift) - specyficzny dla gracza
    let steerAbs = Math.abs(this.steerAngle);
    let speedAbs = Math.abs(this.v_x);
    if (speedAbs > localSlipStartSpeed && steerAbs > this._slipSteerThreshold) {
      let slipSteerRatio = (steerAbs - this._slipSteerThreshold) / (this.maxSteer - this._slipSteerThreshold);
      slipSteerRatio = Phaser.Math.Clamp(slipSteerRatio, 0, 1);
      let slipSign = -Math.sign(this.steerAngle);
      let slipStrength = localSlipBase * (speedAbs / localMaxSpeed) * slipSteerRatio * slipSign;
      this.v_y += slipStrength * dt;
      const maxVy = localMaxSpeed * this.maxVyRatio;
      if (Math.abs(this.v_y) > maxVy) this.v_y = maxVy * Math.sign(this.v_y);
      // przy poślizgu dodatkowo zdejmij część v_x (proporcjonalnie do slipSteerRatio)
      // const slipEnergyDrain = 0.08; // tunowalny (0.02..0.2)
      // this.v_x *= 1 - slipEnergyDrain * slipSteerRatio;
    }

    // Tłumienie boczne
    this.v_y += -this.v_y * this.sideFrictionMultiplier * dt;

    // Efekt skrętu: zmiana kierunku jazdy
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
    // Na końcu updatePhysics, po wszystkich zmianach this.v_x i this.v_y
    // Ogranicz prędkość wektorową do localMaxSpeed (dla przodu) oraz do localMaxRevSpeed (dla tyłu)
    let forwardSign = Math.sign(this.v_x) || 1; // jeśli v_x == 0, traktuj jako przód
    let allowedMax = forwardSign >= 0 ? localMaxSpeed : localMaxRevSpeed;

    // let speed = Math.hypot(this.v_x, this.v_y);
    // if (speed > allowedMax) {
    //   let scale = allowedMax / speed;
    //   this.v_x *= scale;
    //   this.v_y *= scale;
    // }

    let speed = Math.hypot(this.v_x, this.v_y);
    if (speed > allowedMax) {
      // obróć skalowanie żeby preferować zachowanie v_x: zmniejsz v_y bardziej niż v_x
      let excess = speed - allowedMax;
      // proporcja redukcji dla v_y większa niż dla v_x
      let reduceVy = Math.min(Math.abs(this.v_y), excess * 0.04);
      let reduceVx = Math.min(Math.abs(this.v_x), excess * 0.96);
      this.v_y -= Math.sign(this.v_y) * reduceVy;
      this.v_x -= Math.sign(this.v_x) * reduceVx;
    }


    // Aktualizuj sprite
    this.carSprite.x = this.carX;
    this.carSprite.y = this.carY;
    this.carSprite.rotation = this.carAngle + Math.PI / 2;
    this.carSprite.steerAngle = this.steerAngle;
  }

  // Implementacja sterowania specyficzna dla gracza
  updateInput(control) {
    // Reset licznika kolizji
    this.collisionCount = 0;

    // Gas - specyficzna logika dla gracza
    let throttle = 0;
    if (!this.throttleLock) {
      throttle = control.up ? 1 : control.down ? -1 : 0;
    } else {
      // Dla gracza wymagaj puszczenia gazu
      if (!control.up && !control.down) {
        this.throttleLock = false;
      }
    }

    // Skręt - specyficzny dla gracza
    const steerRaw = control.left ? -1 : control.right ? 1 : 0;

    // Wygładzanie sterowania
    this.steerInput = this.steerInput * this.steerSmoothFactor + steerRaw * (1 - this.steerSmoothFactor);

    return { throttle, steerInput: this.steerInput };
  }

  // Metody specyficzne dla gracza
  setPlayerControls(controls) {
    this.playerControls = controls;
  }

  enableGyro(enabled = true) {
    this.gyroEnabled = enabled;
  }

  enableTouchControls(enabled = true) {
    this.touchControls = enabled;
  }

  // Dodatkowe metody specyficzne dla gracza
  getPlayerStats() {
    return {
      playerIndex: this.playerIndex,
      gyroEnabled: this.gyroEnabled,
      touchControls: this.touchControls,
      ...this.getFullState()
    };
  }

  // Metoda do resetowania stanu gracza
  resetPlayerState(startX, startY, startAngle = -Math.PI / 2) {
    this.resetState(startX, startY, startAngle);
    this.throttleLock = false;
    this.collisionImmunity = 0;
  }
}


