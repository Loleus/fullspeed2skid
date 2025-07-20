// car.js - moduł auta z fizyką, sterowaniem i kolizjami
export class Car {
  constructor(scene, carSprite, worldData) {
    this.scene = scene;
    this.carSprite = carSprite;
    this.worldData = worldData;
    
    // Parametry auta
    this.CAR_WIDTH = 48; // przywrócony oryginalny rozmiar auta
    this.CAR_HEIGHT = 88;
    this.wheelBase = 75; // rozstaw osi (px)
    this.carMass = 1200; // masa auta w kg
    this.carDragCoefficient = 0.42; // współczynnik oporu aerodynamicznego (Cx)
    this.carFrontalArea = 2.2; // powierzchnia czołowa auta w m^2
    this.airDensity = 1.225; // gęstość powietrza (kg/m^3)
    this.rollingResistance = 5; // współczynnik oporu toczenia
    // Parametry jazdy
    this.MAX_STEER_DEG = 17; // maksymalny kąt skrętu kół (stopnie)
    this.STEER_SPEED_DEG = 28 ; // szybkość skręcania kół (stopnie/sek)
    this.STEER_RETURN_SPEED_DEG = 80; // szybkość powrotu kół do zera (stopnie/sek)
    this.accel = 550; // przyspieszenie
    this.maxSpeed = 720; // maksymalna prędkość
    this.maxRevSpeed = this.maxSpeed * 0.7; // maksymalna prędkość wstecz (30% mniej)
    this.revAccel = this.accel * 0.9; // przyspieszenie wstecz (10% mniej)
    // Parametry driftu / poślizgu
    this.slipBase = 800; // bazowa siła poślizgu
    this.SLIP_START_SPEED_RATIO = 0.8; // próg prędkości jako procent maxSpeed
    this.SLIP_STEER_THRESHOLD_RATIO = 0.8; // próg skrętu (procent maxSteer)
    this.obstacleBounce = 0.5; // SIŁA odbicia od przeszkody/ściany
    // Przeliczone parametry
    this.maxSteer = Phaser.Math.DegToRad(this.MAX_STEER_DEG);
    this.steerSpeed = Phaser.Math.DegToRad(this.STEER_SPEED_DEG);
    this.steerReturnSpeed = Phaser.Math.DegToRad(this.STEER_RETURN_SPEED_DEG);
    // Prekalkulacja stałych do oporu powietrza
    this._dragConst = 0.5 * this.carDragCoefficient * this.carFrontalArea * this.airDensity;
    // Prekalkulacja progu poślizgu
    this._slipSteerThreshold = this.SLIP_STEER_THRESHOLD_RATIO * this.maxSteer;
    // Prekalkulacja progu prędkości poślizgu
    this._slipStartSpeed = this.SLIP_START_SPEED_RATIO * this.maxSpeed;
    // Prekalkulowane parametry kolizji
    this.COLLISION_WIDTH = this.CAR_WIDTH * 0.8;  // 44.8
    this.COLLISION_HEIGHT = this.CAR_HEIGHT * 0.8; // 76.8
    this.COLLISION_HALF_WIDTH = this.COLLISION_WIDTH / 2;  // 22.4
    this.COLLISION_HALF_HEIGHT = this.COLLISION_HEIGHT / 2; // 38.4
    // Prekalkulowane parametry elipsy kolizji
    this.collisionSteps = 64;
    this.collisionAngleStep = (Math.PI * 2) / this.collisionSteps;
    // Prekalkulowane safety margins
    this.safetyMarginFast = 1.5;
    this.safetyMarginSlow = 1;
    this.speedThresholdFast = 50;
    this.speedThresholdSlow = 20;
    // Prekalkulowane stałe fizyczne
    this.maxVyRatio = 0.7;  // maxVy = localMaxSpeed * 0.7
    this.steerSmoothFactor = 0.1;
    this.steerInputThreshold = 0.01;
    this.speedThresholdForSteerReturn = 1;
    this.bounceSpeedThreshold = 50;
    this.bounceStrengthWeak = 0.1;
    this.gravity = 9.81;
    
    // Stan auta
    this.v_x = 0; // prędkość wzdłuż auta (przód/tył)
    this.v_y = 0; // prędkość boczna (drift)
    this.carAngle = 0; // orientacja auta
    this.carX = 0;
    this.carY = 0;
    this.steerInput = 0; // wygładzony sygnał sterowania
    this.steerAngle = 0; // aktualny kąt skrętu
    
    // Kolizje
    this.throttleLock = false; // blokada gazu po kolizji
    this.collisionCount = 0; // licznik kolizji w jednej klatce
    this.MAX_COLLISIONS_PER_FRAME = 1; // maksymalna liczba kolizji na klatkę
    this.collisionImmunity = 0; // sekundy nieczułości na kolizje po odbiciu
    
    // Ustaw rozmiar sprite'a
    this.carSprite.setDisplaySize(this.CAR_WIDTH, this.CAR_HEIGHT);
    this.lastSurfaceType = null;
    this.lastSurfaceCheckX = null;
    this.lastSurfaceCheckY = null;
    this.surfaceCheckThreshold = 1; // px
    // Precaching sin/cos do elipsy kolizji
    this.collisionCircle = Array(this.collisionSteps).fill().map((_, i) => {
      const angle = this.collisionAngleStep * i;
      return { cos: Math.cos(angle), sin: Math.sin(angle) };
    });
  }
  
  // Resetuj stan auta
  resetState(startX, startY, startAngle = -Math.PI / 2) {
    this.carX = startX;
    this.carY = startY;
    this.carAngle = startAngle;
    this.v_x = 0;
    this.v_y = 0;
    this.steerAngle = 0;
    this.throttleLock = false;
    this.collisionCount = 0;
    
    // Ustaw pozycję sprite'a
    this.carSprite.x = this.carX;
    this.carSprite.y = this.carY;
    this.carSprite.rotation = this.carAngle + Math.PI / 2;
  }
  
  // Pobierz rogi auta dla kolizji
  getCarCorners(x, y, rot, width, height) {
    const hw = width / 2, hh = height / 2;
    const corners = [
      { x: -hw, y: -hh },
      { x: hw,  y: -hh },
      { x: hw,  y: hh },
      { x: -hw, y: hh }
    ];
    return corners.map(c => ({
      x: x + c.x * Math.cos(rot) - c.y * Math.sin(rot),
      y: y + c.x * Math.sin(rot) + c.y * Math.cos(rot)
    }));
  }
  
  // Aktualizuj fizykę auta
  updatePhysics(dt, steerInput, throttle, surface) {
    // Pobierz parametry nawierzchni
    let grip = this.worldData.surfaceParams?.[surface]?.grip ?? 1.0;
    let localMaxSpeed = this.maxSpeed * grip;
    let localMaxRevSpeed = this.maxRevSpeed * grip;
    let localSlipStartSpeed = this.SLIP_START_SPEED_RATIO * localMaxSpeed; // Próg poślizgu zależny od localMaxSpeed
    let localSlipBase = this.slipBase; // Siła poślizgu NIE zależy od gripu
    // Dynamiczne tłumienie boczne: na bardzo śliskich nawierzchniach (grip < 0.5) auto praktycznie nie trzyma się drogi
    this.sideFrictionMultiplier = grip < 0.5 ? 0.2 : 3;
    
    // Sterowanie skrętem
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
    // Ograniczanie prędkości zależnie od kierunku
    if (this.v_x >= 0) {
      this.v_x = Phaser.Math.Clamp(this.v_x, 0, localMaxSpeed);
    } else {
      this.v_x = Phaser.Math.Clamp(this.v_x, -localMaxRevSpeed, 0);
    }
    
    // Model poślizgu: siła boczna (drift)
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
    
    // Efekt skrętu: zmiana kierunku jazdy
    // Wylicz sin/cos tylko raz
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
  
  // Sprawdź kolizje z przeszkodami (elipsa)
  checkEllipseCollision() {
    const speedMagnitude = Math.sqrt(this.v_x * this.v_x + this.v_y * this.v_y);
    
    // Safety margin
    let safetyMargin = 0;
    if (speedMagnitude > this.speedThresholdFast) {
      safetyMargin = this.safetyMarginFast;
    } else if (speedMagnitude > this.speedThresholdSlow) {
      safetyMargin = this.safetyMarginSlow;
    }
    
    // Półosie elipsy - używaj prekalkulowanych
    const a = this.COLLISION_HALF_WIDTH + safetyMargin;
    const b = this.COLLISION_HALF_HEIGHT + safetyMargin;
    
    // Sprawdź środek auta
    if (this.worldData.getSurfaceTypeAt(this.carX, this.carY) === 'obstacle') {
      return true;
    }
    
    // Sprawdź punkty na elipsie
    for (let i = 0; i < this.collisionSteps; i++) {
      const { cos, sin } = this.collisionCircle[i];
      const px = this.carX + a * cos * Math.cos(this.carAngle) - b * sin * Math.sin(this.carAngle);
      const py = this.carY + a * cos * Math.sin(this.carAngle) + b * sin * Math.cos(this.carAngle);
      
      if (this.worldData.getSurfaceTypeAt(px, py) === 'obstacle') {
        return true;
      }
    }
    
    return false;
  }
  
  // Sprawdź kolizje z krawędziami świata
  checkWorldEdgeCollision(worldW, worldH) {
    const carCorners = this.getCarCorners(this.carX, this.carY, this.carAngle, this.CAR_WIDTH, this.CAR_HEIGHT);
    for (const corner of carCorners) {
      if (corner.x < 0 || corner.x > worldW || corner.y < 0 || corner.y > worldH) {
        return true;
      }
    }
    return false;
  }
  
  // Obsłuż kolizję
  handleCollision(prevX, prevY, worldW, worldH) {
    if (this.collisionCount >= this.MAX_COLLISIONS_PER_FRAME) {
      return;
    }
    this.collisionCount++;

    // Odbicie
    let cosA = Math.cos(this.carAngle);
    let sinA = Math.sin(this.carAngle);
    let v_global_x = this.v_x * cosA - this.v_y * sinA;
    let v_global_y = this.v_x * sinA + this.v_y * cosA;

    // Odbicie z minimalną siłą
    const speedMagnitude = Math.sqrt(v_global_x * v_global_x + v_global_y * v_global_y);
    const bounceStrength = speedMagnitude < this.bounceSpeedThreshold ? this.bounceStrengthWeak : this.obstacleBounce;
    let minBounce = 80; // minimalna prędkość odbicia
    let bounceVecX = -v_global_x * bounceStrength;
    let bounceVecY = -v_global_y * bounceStrength;
    let bounceMag = Math.sqrt(bounceVecX * bounceVecX + bounceVecY * bounceVecY);
    let angle = Math.atan2(bounceVecY, bounceVecX);
    if (bounceMag < minBounce) {
      bounceVecX = Math.cos(angle) * minBounce;
      bounceVecY = Math.sin(angle) * minBounce;
    }

    this.v_x = bounceVecX * cosA + bounceVecY * sinA;
    this.v_y = -bounceVecX * sinA + bounceVecY * cosA;

    // Cofnij auto do pozycji sprzed ruchu
    this.carX = prevX;
    this.carY = prevY;
    this.carSprite.x = this.carX;
    this.carSprite.y = this.carY;

    // Minimalny ruch odpychający, jeśli nadal w kolizji
    for (let i = 0; i < 5; i++) {
      if (!this.checkEllipseCollision()) break;
      this.carX += Math.cos(angle) * 2;
      this.carY += Math.sin(angle) * 2;
      this.carSprite.x = this.carX;
      this.carSprite.y = this.carY;
    }

    // Reset prędkości bocznej
    this.v_y = 0;

    // Krótka nieczułość na kolizje
    this.throttleLock = true;
    this.collisionImmunity = 0.2; // sekundy
  }
  
  // Aktualizuj sterowanie
  updateInput(control) {
    // Reset licznika kolizji
    this.collisionCount = 0;
    // Gas
    let throttle = 0;
    if (!this.throttleLock) {
      throttle = control.up ? 1 : control.down ? -1 : 0;
    } else {
      if (!control.up && !control.down) {
        this.throttleLock = false;
      }
    }
    // Skręt
    const steerRaw = control.left ? -1 : control.right ? 1 : 0;
    this.steerInput = this.steerInput * this.steerSmoothFactor + steerRaw * (1 - this.steerSmoothFactor);
    return { throttle, steerInput: this.steerInput };
  }
  
  // Główna aktualizacja
  update(dt, control, worldW, worldH) {
    // Pobierz sterowanie
    const { throttle, steerInput } = this.updateInput(control);
    // --- CACHE NAWIERZCHNI ---
    let dx = Math.abs((this.carX - (this.lastSurfaceCheckX ?? this.carX)));
    let dy = Math.abs((this.carY - (this.lastSurfaceCheckY ?? this.carY)));
    if (dx > this.surfaceCheckThreshold || dy > this.surfaceCheckThreshold || this.lastSurfaceType === null) {
      this.lastSurfaceType = this.worldData.getSurfaceTypeAt(this.carX, this.carY);
      this.lastSurfaceCheckX = this.carX;
      this.lastSurfaceCheckY = this.carY;
    }
    // Zapamiętaj pozycję przed ruchem
    let prevCarX = this.carX;
    let prevCarY = this.carY;
    // Aktualizuj fizykę
    this.updatePhysics(dt, steerInput, throttle, this.lastSurfaceType);
    // Sprawdź kolizje z przeszkodami
    if (this.collisionImmunity > 0) {
      this.collisionImmunity -= dt;
      if (this.collisionImmunity < 0) this.collisionImmunity = 0;
    }
    if (this.collisionImmunity <= 0) {
      if (this.checkEllipseCollision()) {
        this.handleCollision(prevCarX, prevCarY, worldW, worldH);
      }
      // Sprawdź kolizje z krawędziami świata
      if (this.checkWorldEdgeCollision(worldW, worldH)) {
        this.handleCollision(prevCarX, prevCarY, worldW, worldH);
      }
    }
  }
  
  // Gettery dla pozycji i stanu
  getPosition() {
    return { x: this.carX, y: this.carY };
  }
  
  getVelocity() {
    return { v_x: this.v_x, v_y: this.v_y };
  }
  
  getAngle() {
    return this.carAngle;
  }
  
  getSteerAngle() {
    return this.steerAngle;
  }
  
  getSprite() {
    return this.carSprite;
  }

  // Zwraca pozycję środka koła (0: FL, 1: FR, 2: RL, 3: RR)
  getWheelWorldPosition(i) {
    // Szerokość auta to oś Y (przód-tył), długość auta to oś X (lewo-prawo)
    const halfW = this.CAR_WIDTH / 2;   // 24
    const halfH = this.CAR_HEIGHT / 2;  // 44
    // Korekta: koła cofnięte do środka auta
    const xOff = halfH - 8;
    const yOff = halfW - 8;
    // 0: FL, 1: FR, 2: RL, 3: RR
    const offsets = [
      { x: -xOff, y: -yOff }, // FL (lewy przód)
      { x:  xOff, y: -yOff }, // FR (prawy przód)
      { x: -xOff, y:  yOff }, // RL (lewy tył)
      { x:  xOff, y:  yOff }, // RR (prawy tył)
    ];
    const off = offsets[i];
    const cosA = Math.cos(this.carAngle);
    const sinA = Math.sin(this.carAngle);
    return {
      x: this.carX + off.x * cosA - off.y * sinA,
      y: this.carY + off.x * sinA + off.y * cosA
    };
  }

  // Zwraca siłę poślizgu dla koła (na razie uproszczona: v_y dla wszystkich)
  getWheelSlip(i) {
    // Można rozbudować o indywidualne koła, na razie v_y jako proxy poślizgu
    return Math.min(1, Math.abs(this.v_y) / 200); // normalizacja do 0-1
  }

  getLocalSpeed() {
    // Zwraca prędkość wzdłużną auta względem osi przód-tył (v_x)
    return this.v_x;
  }
} 