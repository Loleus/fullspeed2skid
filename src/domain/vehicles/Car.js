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
    this.visualSprite = null;
    // this.carSprite.setDisplaySize(this.CAR_WIDTH, this.CAR_HEIGHT);
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
    this.updateVisualSpriteFromAngle();
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

    let baseSafetyMargin = 0;
    if (speedMagnitude > this.speedThresholdFast) baseSafetyMargin = this.safetyMarginFast;
    else if (speedMagnitude > this.speedThresholdSlow) baseSafetyMargin = this.safetyMarginSlow;

    const slideMargin = Math.abs(this.v_y) * 0.02;
    const a = this.COLLISION_HALF_WIDTH + baseSafetyMargin;
    const b = this.COLLISION_HALF_HEIGHT + baseSafetyMargin + slideMargin;

    // Sprawdź środek auta
    if (this.worldData.getSurfaceTypeAt(this.carX, this.carY) === 'obstacle') {
      // normala: wektor od punktu przeszkody do środka auta (przybliżenie)
      const nx = 0, ny = -1; // fallback
      return { px: this.carX, py: this.carY, normal: { x: nx, y: ny } };
    }

    // Sprawdź punkty na elipsie — zwróć pierwszy znaleziony punkt z aproksymowaną normalą
    for (let i = 0; i < this.collisionSteps; i++) {
      const { cos, sin } = this.collisionCircle[i];
      const px = this.carX + a * cos * Math.cos(this.carAngle) - b * sin * Math.sin(this.carAngle);
      const py = this.carY + a * cos * Math.sin(this.carAngle) + b * sin * Math.cos(this.carAngle);
      if (this.worldData.getSurfaceTypeAt(px, py) === 'obstacle') {
        let nx = this.carX - px;
        let ny = this.carY - py;
        const nlen = Math.hypot(nx, ny) || 1;
        nx /= nlen; ny /= nlen;
        return { px, py, normal: { x: nx, y: ny } };
      }
    }
    return null;
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
  // collisionInfo optionally from checkEllipseCollision: {px,py,normal:{x,y}}
  handleCollision(prevX, prevY, worldW, worldH, collisionInfo = null) {
    if (this.collisionCount >= this.MAX_COLLISIONS_PER_FRAME) {
      return;
    }
    this.collisionCount++;

    // Jeśli mamy normalę -> 2D reflect z separacją wzdłuż normalu
    if (collisionInfo && collisionInfo.normal) {
      const n = collisionInfo.normal;
      const cosA = Math.cos(this.carAngle);
      const sinA = Math.sin(this.carAngle);
      // prędkość globalna
      let Vx = this.v_x * cosA - this.v_y * sinA;
      let Vy = this.v_x * sinA + this.v_y * cosA;
      // odbicie: r = v - 2*(v·n)*n
      const dot = Vx * n.x + Vy * n.y;
      let rx = Vx - 2 * dot * n.x;
      let ry = Vy - 2 * dot * n.y;
      const speedMag = Math.hypot(Vx, Vy);
      const bounceF = speedMag < this.bounceSpeedThreshold ? this.bounceStrengthWeak : this.obstacleBounce;
      rx *= bounceF; ry *= bounceF;
      // minimalne odbicie
      let rMag = Math.hypot(rx, ry);
      const minBounce = 80;
      if (rMag < minBounce) {
        const ang = Math.atan2(ry, rx);
        rx = Math.cos(ang) * minBounce;
        ry = Math.sin(ang) * minBounce;
        rMag = minBounce;
      }
      // zapisz lokalne składowe
      this.v_x = rx * cosA + ry * sinA;
      this.v_y = -rx * sinA + ry * cosA;

      // Cofnij do prev i spróbuj separacji wzdłuż normalu (stopniowo powiększany krok)
      this.carX = prevX;
      this.carY = prevY;
      this.carSprite.x = this.carX;
      this.carSprite.y = this.carY;
      let separated = false;
      for (let i = 0; i < 12; i++) {
        const step = (i + 1) * 2; // rosnący krok
        this.carX = prevX + n.x * step;
        this.carY = prevY + n.y * step;
        this.carSprite.x = this.carX;
        this.carSprite.y = this.carY;
        if (!this.checkEllipseCollision()) { separated = true; break; }
      }
      // jeśli nadal w kolizji -> usuń składową prędkości w kierunku normalnym i lekko obniż energię
      if (!separated) {
        const vGlobal = (() => {
          const cx = this.v_x, cy = this.v_y;
          // transform local->global
          const gx = cx * cosA - cy * sinA;
          const gy = cx * sinA + cy * cosA;
          return { gx, gy };
        })();
        const vn = vGlobal.gx * n.x + vGlobal.gy * n.y;
        // odejmij składową normalną
        const newGx = vGlobal.gx - vn * n.x;
        const newGy = vGlobal.gy - vn * n.y;
        // zmniejsz energię
        this.v_x = (newGx * cosA + newGy * sinA) * 0.8;
        this.v_y = (-newGx * sinA + newGy * cosA) * 0.8;
      }

      // Zablokuj throttle krótko (jak wcześniej)
      this.throttleLock = true;
      this.collisionImmunity = 0.2;
      return;
    }

    // Fallback - oryginalne, proste odbicie jednowymiarowe
    // {
    //   let cosA = Math.cos(this.carAngle);
    //   let sinA = Math.sin(this.carAngle);
    //   let v_global_x = this.v_x * cosA - this.v_y * sinA;
    //   let v_global_y = this.v_x * sinA + this.v_y * cosA;

    //   const speedMagnitude = Math.sqrt(v_global_x * v_global_x + v_global_y * v_global_y);
    //   const bounceStrength = speedMagnitude < this.bounceSpeedThreshold ? this.bounceStrengthWeak : this.obstacleBounce;
    //   let minBounce = 80;
    //   let bounceVecX = -v_global_x * bounceStrength;
    //   let bounceVecY = -v_global_y * bounceStrength;
    //   let bounceMag = Math.sqrt(bounceVecX * bounceVecX + bounceVecY * bounceVecY);
    //   let angle = Math.atan2(bounceVecY, bounceVecX);
    //   if (bounceMag < minBounce) {
    //     bounceVecX = Math.cos(angle) * minBounce;
    //     bounceVecY = Math.sin(angle) * minBounce;
    //   }

    //   this.v_x = bounceVecX * cosA + bounceVecY * sinA;
    //   this.v_y = -bounceVecX * sinA + bounceVecY * cosA;

    //   this.carX = prevX;
    //   this.carY = prevY;
    //   this.carSprite.x = this.carX;
    //   this.carSprite.y = this.carY;

    //   for (let i = 0; i < 5; i++) {
    //     if (!this.checkEllipseCollision()) break;
    //     this.carX += Math.cos(angle) * 2;
    //     this.carY += Math.sin(angle) * 2;
    //     this.carSprite.x = this.carX;
    //     this.carSprite.y = this.carY;
    //   }

    //   this.throttleLock = true;
    //   this.collisionImmunity = 0.2;
    // }
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
      const ellipseCollisionInfo = this.checkEllipseCollision();
      if (ellipseCollisionInfo) {
        this.handleCollision(prevCarX, prevCarY, worldW, worldH, ellipseCollisionInfo);
      }
      // Sprawdź kolizje z krawędziami świata
      if (this.checkWorldEdgeCollision(worldW, worldH)) {
        // obliczemy normalę względem najbliższej krawędzi i przekażemy ją
        const clampX = Math.min(Math.max(this.carX, 0), worldW);
        const clampY = Math.min(Math.max(this.carY, 0), worldH);
        let nx = this.carX - clampX;
        let ny = this.carY - clampY;
        if (nx === 0 && ny === 0) { nx = this.carX - prevCarX; ny = this.carY - prevCarY; }
        const nlen = Math.hypot(nx, ny) || 1;
        const normal = { x: nx / nlen, y: ny / nlen };
        this.handleCollision(prevCarX, prevCarY, worldW, worldH, { px: this.carX, py: this.carY, normal });
      }
      // Kolizje między autami
      if (this.checkCarCollision()) {
        const opponent = this.isAI ? this.scene.carController : this.scene.aiController;
        if (opponent) {
          // normalna od przeciwnika do tego auta
          let nx = this.carX - opponent.carX;
          let ny = this.carY - opponent.carY;
          const nlen = Math.hypot(nx, ny) || 1;
          const normal = { x: nx / nlen, y: ny / nlen };

          // globalne prędkości obu aut
          const cosA1 = Math.cos(this.carAngle), sinA1 = Math.sin(this.carAngle);
          const g1x = this.v_x * cosA1 - this.v_y * sinA1;
          const g1y = this.v_x * sinA1 + this.v_y * cosA1;
          const cosA2 = Math.cos(opponent.carAngle), sinA2 = Math.sin(opponent.carAngle);
          const g2x = opponent.v_x * cosA2 - opponent.v_y * sinA2;
          const g2y = opponent.v_x * sinA2 + opponent.v_y * cosA2;

          // względna prędkość wzdłuż normalu
          const rel = (g1x - g2x) * normal.x + (g1y - g2y) * normal.y;
          if (rel < 0) {
            // masy i restitucja
            const m1 = this.carMass || 1200;
            const m2 = opponent.carMass || 1200;
            const e = 0.6; // restitucja dla zderzeń aut
            const j = -(1 + e) * rel / (1 / m1 + 1 / m2);

            // zastosuj impuls
            const impX = j * normal.x;
            const impY = j * normal.y;
            let ng1x = g1x + impX / m1;
            let ng1y = g1y + impY / m1;
            let ng2x = g2x - impX / m2;
            let ng2y = g2y - impY / m2;

            // zapisz z powrotem do lokalnych składowych
            this.v_x = ng1x * cosA1 + ng1y * sinA1;
            this.v_y = -ng1x * sinA1 + ng1y * cosA1;
            opponent.v_x = ng2x * cosA2 + ng2y * sinA2;
            opponent.v_y = -ng2x * sinA2 + ng2y * cosA2;

            // separacja pozycji aby uniknąć tunelowania (połowa przesunięcia na każde auto)
            const sep = 6;
            this.carX = prevCarX + normal.x * sep;
            this.carY = prevCarY + normal.y * sep;
            this.carSprite.x = this.carX; this.carSprite.y = this.carY;
            opponent.carX -= normal.x * sep;
            opponent.carY -= normal.y * sep;
            opponent.carSprite.x = opponent.carX; opponent.carSprite.y = opponent.carY;

            // zablokuj throttle na krótko i ustaw immunitet (dla obu)
            this.throttleLock = true;
            this.collisionImmunity = 0.2;
            opponent.throttleLock = true;
            opponent.collisionImmunity = 0.2;
          } else {
            // jeśli aut już się rozjechały -> fallback lokalnego odbicia (wywołaj handleCollision normalnie)
            this.handleCollision(prevCarX, prevCarY, worldW, worldH, { px: this.carX, py: this.carY, normal });
            opponent.handleCollision(opponent.carX, opponent.carY, worldW, worldH, { px: opponent.carX, py: opponent.carY, normal: { x: -normal.x, y: -normal.y } });
          }
        }
      }
    }

    this.updateVisualSpriteFromAngle();
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

  // Nakładka wizualna: sprite z arkusza kierunków, który siedzi na fizycznym aucie
  updateVisualSpriteFromAngle() {
    const vs = this.visualSprite;
    const s  = this.carSprite;
    if (!vs || !s || !vs.texture) return;
  
    // Pozycja taka sama jak fizycznego sprite’a
    vs.x = s.x;
    vs.y = s.y;
  
    const totalFrames = vs.texture.frameTotal || 1;
    if (totalFrames <= 1) {
      vs.rotation = s.rotation;
      return;
    }
  
    // 25 klatek: 0–23 unikalne, 24 == 0
    const dirFrames = totalFrames === 25 ? 24 : totalFrames;
  
    // KLUCZ: bierzemy kąt rysunku, nie kombinujemy ze startFix na piechotę.
    // s.rotation to radiany, dokładnie to, co Phaser używa do narysowania auta.
    let angleDeg = Phaser.Math.Wrap(Phaser.Math.RadToDeg(s.rotation), 0, 360);
  
    // Stały podział 360° na 24 sektory po 15°
    const stepDeg = 360 / dirFrames;
    let frameIndex = Math.round(angleDeg / stepDeg) % dirFrames;
  
    vs.setFrame(frameIndex);
    vs.rotation = 0;
  }
}
