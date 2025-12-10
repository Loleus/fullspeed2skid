import { carConfig } from './CarConfig.js';

// Główna klasa GRACZA (Player i AI)
export class Car {
  constructor(scene, carSprite, worldData) {
    this.scene = scene;
    this.carSprite = carSprite;
    this.worldData = worldData;
    this.body = carSprite.body;
    this.isAI = false; // Flaga określająca czy to samochód AI
    this.isPlayer = false; // Flaga określająca czy to samochód gracza

    // Importuj parametry z configa
    Object.assign(this, carConfig);

    // Przeliczenia
    this.maxSteer = Phaser.Math.DegToRad(this.MAX_STEER_DEG);
    this.steerSpeed = Phaser.Math.DegToRad(this.STEER_SPEED_DEG);
    this.steerReturnSpeed = Phaser.Math.DegToRad(this.STEER_RETURN_SPEED_DEG);
    this.maxRevSpeed = this.maxSpeed * this.maxRevSpeedRatio;
    this.revAccel = this.accel * this.revAccelRatio;
    this._dragConst = 0.5 * this.carDragCoefficient * this.carFrontalArea * this.airDensity;
    this._slipSteerThreshold = this.SLIP_STEER_THRESHOLD_RATIO * this.maxSteer;
    this._slipStartSpeed = this.SLIP_START_SPEED_RATIO * this.maxSpeed;
    this.COLLISION_WIDTH = this.CAR_HEIGHT * this.COLLISION_WIDTH_RATIO;
    this.COLLISION_HEIGHT = this.CAR_WIDTH * this.COLLISION_HEIGHT_RATIO;
    this.COLLISION_HALF_WIDTH = this.COLLISION_WIDTH / 2;
    this.COLLISION_HALF_HEIGHT = this.COLLISION_HEIGHT / 2;
    this.collisionAngleStep = (Math.PI * 2) / this.collisionSteps;

    // Stan gry
    this.throttle = 0;
    this.v_x = 0;
    this.v_y = 0;
    this.carAngle = 0;
    this.carX = 0;
    this.carY = 0;
    this.steerInput = 0;
    this.steerAngle = 0;
    this.throttleLock = false;
    this.collisionCount = 0;
    this.MAX_COLLISIONS_PER_FRAME = 1;
    this.collisionImmunity = 0;
    this.carSprite.setDisplaySize(this.CAR_WIDTH, this.CAR_HEIGHT);
    this.lastSurfaceType = null;
    this.lastSurfaceCheckX = null;
    this.lastSurfaceCheckY = null;
    this.surfaceCheckThreshold = 1;
    this.opponentController = null; // referencja do przeciwnika (AI lub drugi gracz)
    this.collisionCircle = Array(this.collisionSteps).fill().map((_, i) => {
      const angle = this.collisionAngleStep * i;
      return { cos: Math.cos(angle), sin: Math.sin(angle) };
    });
  }

  resetState(startX, startY, startAngle = -Math.PI / 2) {
    this.carX = startX;
    this.carY = startY;

    // Pobierz korektę rotacji z tracks.json przez worldData
    const startFix = this.worldData?.startFix ?
      Phaser.Math.DegToRad(parseFloat(this.worldData.startFix)) : 0;
    console.log('Start fix (radians):', startFix);

    // Zastosuj podstawową rotację + korektę
    this.carAngle = startAngle + startFix;

    this.v_x = 0;
    this.v_y = 0;
    this.steerAngle = 0;
    this.throttleLock = false;
    this.collisionCount = 0;

    // Ustaw pozycję i rotację sprite'a
    this.carSprite.x = this.carX;
    this.carSprite.y = this.carY;
    this.carSprite.rotation = this.carAngle + Math.PI / 2;
  }

  // Pobierz rogi auta dla kolizji
  getCarCorners(x, y, rot, width, height) {
    const hw = width / 2, hh = height / 2;
    const corners = [
      { x: -hw, y: -hh },
      { x: hw, y: -hh },
      { x: hw, y: hh },
      { x: -hw, y: hh }
    ];
    return corners.map(c => ({
      x: x + c.x * Math.cos(rot) - c.y * Math.sin(rot),
      y: y + c.x * Math.sin(rot) + c.y * Math.cos(rot)
    }));
  }

  // Aktualizuj fizykę auta - metoda bazowa do nadpisania
  updatePhysics(dt, steerInput, throttle, surface) {
    // Implementacja bazowa - do nadpisania w klasach pochodnych
    throw new Error('updatePhysics must be implemented in derived class');
  }

  // Sprawdź kolizje z przeszkodami (elipsa)
  checkEllipseCollision() {
    const speedMagnitude = Math.sqrt(this.v_x * this.v_x + this.v_y * this.v_y);

    // Safety margin zależny od prędkości i poślizgu
    let baseSafetyMargin = 0;
    if (speedMagnitude > this.speedThresholdFast) {
      baseSafetyMargin = this.safetyMarginFast;
    } else if (speedMagnitude > this.speedThresholdSlow) {
      baseSafetyMargin = this.safetyMarginSlow;
    }

    // Dodatkowy margines na szerokość, proporcjonalny do prędkości bocznej
    const slideMargin = Math.abs(this.v_y) * 0.02;

    // Półosie elipsy - DŁUGOŚĆ (a) i SZEROKOŚĆ (b)
    const a = this.COLLISION_HALF_WIDTH + baseSafetyMargin;
    const b = this.COLLISION_HALF_HEIGHT + baseSafetyMargin + slideMargin;

    // Sprawdź środek auta
    if (this.worldData.getSurfaceTypeAt(this.carX, this.carY) === 'obstacle') {
      return true;
    }

    // Sprawdź punkty na elipsie
    for (let i = 0; i < this.collisionSteps; i++) {
      const { cos, sin } = this.collisionCircle[i];
      const px = this.carX + a * cos * Math.cos(this.carAngle) - b * sin * Math.sin(this.carAngle);
      const py = this.carY + a * cos * Math.sin(this.carAngle) + b * sin * Math.cos(this.carAngle);
      // Kolizja z przeszkodą
      if (this.worldData.getSurfaceTypeAt(px, py) === 'obstacle') {
        return true;
      }
    }
    return false;
  }

  // Sprawdź kolizje z krawędziami świata
  checkWorldEdgeCollision(worldW, worldH) {
    const carCorners = this.getCarCorners(this.carX, this.carY, this.carAngle, this.CAR_HEIGHT, this.CAR_WIDTH);
    for (const corner of carCorners) {
      if (corner.x < 0 || corner.x > worldW || corner.y < 0 || corner.y > worldH) {
        return true;
      }
    }
    return false;
  }

  // Obsłuż kolizję - metoda bazowa
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

    // Akrualizacja współrzędnych auta po odbiciu
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

    // Krótka nieczułość na kolizje
    this.throttleLock = true;
    this.collisionImmunity = 0.2; // sekundy
  }

  // Aktualizuj sterowanie - metoda bazowa do nadpisania
  updateInput(control) {
    // Implementacja bazowa - do nadpisania w klasach pochodnych
    throw new Error('updateInput must be implemented in derived class');
  }

  // Sprawdź kolizje między autami
  checkCarCollision() {
    if (!this.scene.collisionsEnabled || !this.opponentController) {
      return false;
    }
    const opponent = this.opponentController || (this.isAI ? this.scene.carController : this.scene.aiController);
    if (!opponent) return false;
    const dx = this.carX - opponent.carX;
    const dy = this.carY - opponent.carY;
    const dist = Math.hypot(dx, dy);
    return dist < (this.COLLISION_WIDTH + opponent.COLLISION_WIDTH) / 2;
  }

  // Główna aktualizacja - metoda bazowa
  update(dt, control, worldW, worldH) {
    // Pobierz sterowanie
    const { throttle, steerInput } = this.updateInput(control);

    // Cache nawierzchni
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

    // Kolizje między autami sprawdzaj zawsze
    if (this.collisionImmunity <= 0) {
      if (this.checkEllipseCollision()) {
        this.handleCollision(prevCarX, prevCarY, worldW, worldH);
      }
      // Sprawdź kolizje z krawędziami świata
      if (this.checkWorldEdgeCollision(worldW, worldH)) {
        this.handleCollision(prevCarX, prevCarY, worldW, worldH);
      }
      // Kolizje między autami
      if (this.checkCarCollision()) {
        const opponent = this.isAI ? this.scene.carController : this.scene.aiController;
        if (opponent) {
          this.handleCollision(prevCarX, prevCarY, worldW, worldH);
          opponent.handleCollision(opponent.carX, opponent.carY, worldW, worldH);
        }
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
    const halfW = this.CAR_WIDTH / 2;
    const halfH = this.CAR_HEIGHT / 2;
    const xOff = halfH - 8;
    const yOff = halfW - 8;

    const offsets = [
      { x: -xOff, y: -yOff }, // FL (lewy przód)
      { x: xOff, y: -yOff }, // FR (prawy przód)
      { x: -xOff, y: yOff }, // RL (lewy tył)
      { x: xOff, y: yOff }, // RR (prawy tył)
    ];

    const off = offsets[i];
    const cosA = Math.cos(this.carAngle);
    const sinA = Math.sin(this.carAngle);

    return {
      x: this.carX + off.x * cosA - off.y * sinA,
      y: this.carY + off.x * sinA + off.y * cosA
    };
  }

  // Zwraca siłę poślizgu dla koła
  getWheelSlip(i) {
    return Math.min(1, Math.abs(this.v_y) / 200);
  }

  getLocalSpeed() {
    return this.v_x;
  }

  getThrottle() {
    return this.throttle;
  }
  
  setThrottleLock(lock) {
    this.throttleLock = lock;
  }

  // Getter pełnego stanu
  getFullState() {
    return {
      steerAngle: this.steerAngle,
      steerAngleDeg: Phaser.Math.RadToDeg(this.steerAngle),
      carAngle: this.carAngle,
      carAngleDeg: Phaser.Math.RadToDeg(this.carAngle),
      maxSteerDeg: this.MAX_STEER_DEG,
      v_x: this.v_x,
      v_y: this.v_y,
      speed: Math.abs(this.v_x)
    };
  }
}
