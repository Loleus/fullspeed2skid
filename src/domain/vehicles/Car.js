import { carConfig } from './CarConfig.js';
// Główna klasa GRACZA (Player i AI)
export class Car {
  constructor(scene, carSprite, worldData) {
    this.scene = scene;
    this.carSprite = carSprite;
    this.worldData = worldData;
    this.body = carSprite.body;
    this.isAI = false;
    this.isPlayer = false;

    this.renderAngle = 0;        // interpolowany kąt
    this.renderLerpSpeed = 30;   // szybkość doganiania (10–30)


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
    this.opponentController = null;
    this.collisionCircle = Array(this.collisionSteps).fill().map((_, i) => {
      const angle = this.collisionAngleStep * i;
      return { cos: Math.cos(angle), sin: Math.sin(angle) };
    });
  }

  resetState(startX, startY, startAngle = -Math.PI / 2) {
    this.carX = startX;
    this.carY = startY;

    const startFix = this.worldData?.startFix ?
      Phaser.Math.DegToRad(parseFloat(this.worldData.startFix)) : 0;

    this.carAngle = startAngle + startFix;
    this.renderAngle = this.carAngle;
    this.v_x = 0;
    this.v_y = 0;
    this.steerAngle = 0;
    this.throttleLock = false;
    this.collisionCount = 0;

    this.carSprite.x = this.carX;
    this.carSprite.y = this.carY;
    this.carSprite.rotation = this.carAngle + Math.PI / 2;

    this.frameTransitionProgress = 1;
    this.updateVisualSpriteFromAngle(0);
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

  updatePhysics(dt, steerInput, throttle, surface) {
    throw new Error('updatePhysics must be implemented in derived class');
  }

  checkWorldEdgeCollision(worldW, worldH) {
    const carCorners = this.getCarCorners(this.carX, this.carY, this.carAngle, this.CAR_HEIGHT, this.CAR_WIDTH);
    for (const corner of carCorners) {
      if (corner.x < 0 || corner.x > worldW || corner.y < 0 || corner.y > worldH) {
        return true;
      }
    }
    return false;
  }

  // POPRAWIONE: Nie cofa już "na siłę" do prevX (robi to update), tylko odbija i wypycha
  // handleCollision(worldW, worldH, collisionInfo = null) {
  //   if (this.collisionCount >= this.MAX_COLLISIONS_PER_FRAME) {
  //     return;
  //   }
  //   this.collisionCount++;

  //   if (collisionInfo && collisionInfo.normal) {
  //     const n = collisionInfo.normal;

  //     // 1. Oblicz prędkość w układzie globalnym
  //     const cosA = Math.cos(this.carAngle);
  //     const sinA = Math.sin(this.carAngle);
  //     let gVx = this.v_x * cosA - this.v_y * sinA;
  //     let gVy = this.v_x * sinA + this.v_y * cosA;

  //     // 2. Odbicie w układzie globalnym
  //     const dot = gVx * n.x + gVy * n.y;

  //     // Tylko jeśli jedziemy w stronę ściany
  //     if (dot < 0) {
  //         let rx = gVx - 2 * dot * n.x;
  //         let ry = gVy - 2 * dot * n.y;

  //         const speedMag = Math.hypot(rx, ry);
  //         const bounceF = speedMag < this.bounceSpeedThreshold ? this.bounceStrengthWeak : this.obstacleBounce;
  //         rx *= bounceF; ry *= bounceF;

  //         let rMag = Math.hypot(rx, ry);
  //         const minBounce = 80;
  //         if (rMag < minBounce) {
  //           const ang = Math.atan2(ry, rx);
  //           rx = Math.cos(ang) * minBounce;
  //           ry = Math.sin(ang) * minBounce;
  //         }

  //         // Konwersja z powrotem na lokalny układ auta
  //         this.v_x = rx * cosA + ry * sinA;
  //         this.v_y = -rx * sinA + ry * cosA;
  //     }

  //     // 3. Wypychanie (Separation) - jeśli nadal jesteśmy w kolizji
  //     // (Zabezpieczenie na wypadek gdyby update nie zdążył cofnąć idealnie)
  //     let separated = false;
  //     for (let i = 0; i < 12; i++) {
  //       const step = (i + 1) * 1.5; // Mniejsze kroki, częściej
  //       // Wypychamy w stronę normalnej (która wskazuje od przeszkody do auta)
  //       this.carX += n.x * step;
  //       this.carY += n.y * step;
  //       this.carSprite.x = this.carX;
  //       this.carSprite.y = this.carY;
  //       if (!this.checkEllipseCollision()) { separated = true; break; }
  //     }

  //     this.throttleLock = true;
  //     this.collisionImmunity = 0.2;
  //     return;
  //   }
  // }

  // Zmodyfikowana metoda checkEllipseCollision - uproszczona do sprawdzania tylko okręgu
  checkEllipseCollision() {
    // Używamy tylko okręgu kolizyjnego (bez elipsy) dla prostszej detekcji
    const radius = Math.max(this.COLLISION_HALF_WIDTH, this.COLLISION_HALF_HEIGHT);

    // Sprawdzamy kilka punktów na obwodzie koła
    for (let i = 0; i < this.collisionSteps; i++) {
      const angle = this.collisionAngleStep * i;
      const px = this.carX + radius * Math.cos(angle + this.carAngle);
      const py = this.carY + radius * Math.sin(angle + this.carAngle);

      if (this.worldData.getSurfaceTypeAt(px, py) === 'obstacle') {
        // Normalna zawsze wskazuje OD przeszkody DO auta
        let nx = this.carX - px;
        let ny = this.carY - py;
        const nlen = Math.hypot(nx, ny) || 1;
        return {
          px: px,
          py: py,
          normal: { x: nx / nlen, y: ny / nlen },
          penetrationDepth: radius - nlen
        };
      }
    }

    // Sprawdzamy też środek (na wypadek gdyby był wewnątrz przeszkody)
    if (this.worldData.getSurfaceTypeAt(this.carX, this.carY) === 'obstacle') {
      // Jeśli środek jest w przeszkodzie, szukamy najbliższego wolnego punktu
      const testRadius = radius * 2;
      let bestNormal = { x: 0, y: -1 };
      let bestDist = 0;

      for (let i = 0; i < this.collisionSteps; i++) {
        const angle = this.collisionAngleStep * i;
        const px = this.carX + testRadius * Math.cos(angle);
        const py = this.carY + testRadius * Math.sin(angle);

        if (this.worldData.getSurfaceTypeAt(px, py) !== 'obstacle') {
          const nx = this.carX - px;
          const ny = this.carY - py;
          const nlen = Math.hypot(nx, ny) || 1;
          if (nlen > bestDist) {
            bestDist = nlen;
            bestNormal = { x: nx / nlen, y: ny / nlen };
          }
        }
      }

      return {
        px: this.carX,
        py: this.carY,
        normal: bestNormal,
        penetrationDepth: radius
      };
    }

    return null;
  }

  // Poprawiona metoda handleCollision
  handleCollision(worldW, worldH, collisionInfo = null) {
    if (this.collisionCount >= this.MAX_COLLISIONS_PER_FRAME) {
      return;
    }
    this.collisionCount++;

    if (collisionInfo && collisionInfo.normal) {
      const n = collisionInfo.normal;
      const penetrationDepth = collisionInfo.penetrationDepth || 0;

      // 1. Oblicz prędkość w układzie globalnym
      const cosA = Math.cos(this.carAngle);
      const sinA = Math.sin(this.carAngle);
      let gVx = this.v_x * cosA - this.v_y * sinA;
      let gVy = this.v_x * sinA + this.v_y * cosA;

      // 2. Odbicie w układzie globalnym (tylko jeśli jedziemy w stronę ściany)
      const dot = gVx * n.x + gVy * n.y;
      if (dot < 0) {
        // Odbicie z zachowaniem energii
        let rx = gVx - 2 * dot * n.x;
        let ry = gVy - 2 * dot * n.y;

        // Skalowanie siły odbicia
        const speedMag = Math.hypot(rx, ry);
        const bounceF = speedMag < this.bounceSpeedThreshold ?
          this.bounceStrengthWeak : this.obstacleBounce;
        rx *= bounceF;
        ry *= bounceF;

        // Minimalna prędkość odbicia
        const minBounce = 80;
        let rMag = Math.hypot(rx, ry);
        if (rMag < minBounce) {
          const ang = Math.atan2(ry, rx);
          rx = Math.cos(ang) * minBounce;
          ry = Math.sin(ang) * minBounce;
        }

        // Konwersja z powrotem na lokalny układ auta
        this.v_x = rx * cosA + ry * sinA;
        this.v_y = -rx * sinA + ry * cosA;
      }

      // 3. Wypychanie (Separation) - ZAWSZE w kierunku normalnej
      // Upewniamy się, że wypychamy wystarczająco daleko, aby wyjść z kolizji
      const separationDistance = (penetrationDepth || 10) + 5; // Dodatkowy margines

      // Wypychamy w kierunku normalnej (od przeszkody)
      this.carX += n.x * separationDistance;
      this.carY += n.y * separationDistance;
      this.carSprite.x = this.carX;
      this.carSprite.y = this.carY;

      // Dodatkowa weryfikacja - jeśli nadal jesteśmy w kolizji, zwiększamy separację
      for (let i = 0; i < 5; i++) {
        if (!this.checkEllipseCollision()) break;

        this.carX += n.x * separationDistance;
        this.carY += n.y * separationDistance;
        this.carSprite.x = this.carX;
        this.carSprite.y = this.carY;
      }

      this.throttleLock = true;
      this.collisionImmunity = 0.2;
      return;
    }
  }

  updateInput(control) {
    throw new Error('updateInput must be implemented in derived class');
  }

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

  update(dt, control, worldW, worldH) {
    const { throttle, steerInput } = this.updateInput(control);

    // Surface check
    let dxSurf = Math.abs((this.carX - (this.lastSurfaceCheckX ?? this.carX)));
    let dySurf = Math.abs((this.carY - (this.lastSurfaceCheckY ?? this.carY)));
    if (dxSurf > this.surfaceCheckThreshold || dySurf > this.surfaceCheckThreshold || this.lastSurfaceType === null) {
      this.lastSurfaceType = this.worldData.getSurfaceTypeAt(this.carX, this.carY);
      this.lastSurfaceCheckX = this.carX;
      this.lastSurfaceCheckY = this.carY;
    }

    // Zapamiętaj stan przed fizyką
    const prevCarX = this.carX;
    const prevCarY = this.carY;

    // Fizyka (porusza this.carX/Y)
    this.updatePhysics(dt, steerInput, throttle, this.lastSurfaceType);

    if (this.collisionImmunity > 0) {
      this.collisionImmunity -= dt;
      if (this.collisionImmunity < 0) this.collisionImmunity = 0;
    }

    if (this.collisionImmunity <= 0) {
      // --- ANTY-TUNELOWANIE (Sub-stepping) ---
      const moveX = this.carX - prevCarX;
      const moveY = this.carY - prevCarY;
      const moveDist = Math.hypot(moveX, moveY);

      // Jeśli ruch był duży, dzielimy go na mniejsze kroki
      // Krok co około połowa szerokości kolizji, żeby nie przeskoczyć ściany
      const stepSize = this.COLLISION_HALF_WIDTH * 0.75;
      const steps = Math.max(1, Math.ceil(moveDist / stepSize));

      let collisionFound = null;
      let safeX = prevCarX;
      let safeY = prevCarY;

      // Sprawdzamy punkty po drodze
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const testX = prevCarX + moveX * t;
        const testY = prevCarY + moveY * t;

        // Tymczasowo ustaw pozycję do sprawdzenia
        const oldX = this.carX;
        const oldY = this.carY;
        this.carX = testX;
        this.carY = testY;

        const col = this.checkEllipseCollision();

        // Przywróć (sprawdzanie nie powinno zmieniać stanu na stałe)
        this.carX = oldX;
        this.carY = oldY;

        if (col) {
          collisionFound = col;
          // Jeśli wykryto kolizję, cofamy się do bezpiecznego punktu
          this.carX = safeX;
          this.carY = safeY;
          this.carSprite.x = this.carX;
          this.carSprite.y = this.carY;
          break; // Przerywamy sprawdzanie dalszej drogi
        } else {
          // Bezpieczny punkt
          safeX = testX;
          safeY = testY;
        }
      }

      // Jeśli nie znaleziono kolizji na ścieżce, upewnij się, że jesteśmy na końcu
      if (!collisionFound) {
        this.carX = prevCarX + moveX;
        this.carY = prevCarY + moveY;
      }

      // --- OBSŁUGA KOLIZJI ---
      if (collisionFound) {
        this.handleCollision(worldW, worldH, collisionFound);
      }
      else if (this.checkWorldEdgeCollision(worldW, worldH)) {
        // Krawędzie świata - prostsze odbicie
        const clampX = Math.min(Math.max(this.carX, 0), worldW);
        const clampY = Math.min(Math.max(this.carY, 0), worldH);
        let nx = this.carX - clampX;
        let ny = this.carY - clampY;
        if (nx === 0 && ny === 0) { nx = this.carX - prevCarX; ny = this.carY - prevCarY; }
        const nlen = Math.hypot(nx, ny) || 1;
        const normal = { x: nx / nlen, y: ny / nlen };

        // Cofnij do bezpiecznego (prev) przy krawędzi
        this.carX = prevCarX;
        this.carY = prevCarY;
        this.handleCollision(worldW, worldH, { px: this.carX, py: this.carY, normal });
      }
      else if (this.checkCarCollision()) {
        // Kolizja z autem - tu nie tunelujemy, bo auta są wolne, ale zostawiamy logikę
        // Jednak cofamy do prev, żeby konsekwentnie traktować fizykę
        this.carX = prevCarX;
        this.carY = prevCarY;

        const opponent = this.isAI ? this.scene.carController : this.scene.aiController;
        if (opponent) {
          let nx = this.carX - opponent.carX;
          let ny = this.carY - opponent.carY;
          const nlen = Math.hypot(nx, ny) || 1;
          const normal = { x: nx / nlen, y: ny / nlen };

          const cosA1 = Math.cos(this.carAngle), sinA1 = Math.sin(this.carAngle);
          const g1x = this.v_x * cosA1 - this.v_y * sinA1;
          const g1y = this.v_x * sinA1 + this.v_y * cosA1;
          const cosA2 = Math.cos(opponent.carAngle), sinA2 = Math.sin(opponent.carAngle);
          const g2x = opponent.v_x * cosA2 - opponent.v_y * sinA2;
          const g2y = opponent.v_x * sinA2 + opponent.v_y * cosA2;

          const rel = (g1x - g2x) * normal.x + (g1y - g2y) * normal.y;
          if (rel < 0) {
            const m1 = this.carMass || 1200;
            const m2 = opponent.carMass || 1200;
            const e = 0.6;
            const j = -(1 + e) * rel / (1 / m1 + 1 / m2);

            const impX = j * normal.x;
            const impY = j * normal.y;
            let ng1x = g1x + impX / m1;
            let ng1y = g1y + impY / m1;
            let ng2x = g2x - impX / m2;
            let ng2y = g2y - impY / m2;

            this.v_x = ng1x * cosA1 + ng1y * sinA1;
            this.v_y = -ng1x * sinA1 + ng1y * cosA1;
            opponent.v_x = ng2x * cosA2 + ng2y * sinA2;
            opponent.v_y = -ng2x * sinA2 + ng2y * cosA2;

            const sep = 6;
            this.carX += normal.x * sep; // Dodajemy sep do już cofniętego prev
            this.carY += normal.y * sep;
            this.carSprite.x = this.carX; this.carSprite.y = this.carY;
            opponent.carX -= normal.x * sep;
            opponent.carY -= normal.y * sep;
            opponent.carSprite.x = opponent.carX; opponent.carSprite.y = opponent.carY;

            this.throttleLock = true;
            this.collisionImmunity = 0.2;
            opponent.throttleLock = true;
            opponent.collisionImmunity = 0.2;
          } else {
            this.handleCollision(worldW, worldH, { px: this.carX, py: this.carY, normal });
            opponent.handleCollision(worldW, worldH, { px: opponent.carX, py: opponent.carY, normal: { x: -normal.x, y: -normal.y } });
          }
        }
      }
    }

    this.updateVisualSpriteFromAngle(dt);
  }

  getPosition() { return { x: this.carX, y: this.carY }; }
  getVelocity() { return { v_x: this.v_x, v_y: this.v_y }; }
  getAngle() { return this.carAngle; }
  getSteerAngle() { return this.steerAngle; }
  getSprite() { return this.carSprite; }

  getWheelWorldPosition(i) {
    const halfW = this.CAR_WIDTH / 2;
    const halfH = this.CAR_HEIGHT / 2;
    const xOff = halfH - 8;
    const yOff = halfW - 8;
    const offsets = [
      { x: -xOff, y: -yOff }, { x: xOff, y: -yOff },
      { x: -xOff, y: yOff }, { x: xOff, y: yOff },
    ];
    const off = offsets[i];
    const cosA = Math.cos(this.carAngle);
    const sinA = Math.sin(this.carAngle);
    return {
      x: this.carX + off.x * cosA - off.y * sinA,
      y: this.carY + off.x * sinA + off.y * cosA
    };
  }

  getWheelSlip(i) { return Math.min(1, Math.abs(this.v_y) / 200); }
  getLocalSpeed() { return this.v_x; }
  getThrottle() { return this.throttle; }
  setThrottleLock(lock) { this.throttleLock = lock; }

  getFullState() {
    return {
      steerAngle: this.steerAngle,
      steerAngleDeg: Phaser.Math.RadToDeg(this.steerAngle),
      carAngle: this.carAngle,
      carAngleDeg: Phaser.Math.RadToDeg(this.carAngle),
      maxSteerDeg: this.MAX_STEER_DEG,
      v_x: this.v_x, v_y: this.v_y,
      speed: Math.abs(this.v_x)
    };
  }

updateVisualSpriteFromAngle(dt = 0) {
  const vs = this.visualSprite;
  const s  = this.carSprite;
  if (!vs || !s || !vs.texture) return;

  // Pozycja sprite’a
  vs.x = s.x;
  vs.y = s.y;

  const totalFrames = vs.texture.frameTotal || 1;
  if (totalFrames <= 1) {
    vs.rotation = s.rotation;
    return;
  }

  // 🔥 1. Interpolacja KĄTA (najważniejsza część)
  this.renderAngle = Phaser.Math.Angle.RotateTo(
    this.renderAngle,
    this.carAngle,
    dt * this.renderLerpSpeed
  );

  // 🔥 2. Wyliczenie klatki z interpolowanego kąta
  const dirFrames = totalFrames === 49 ? 48 : Math.min(totalFrames, 48);
  const stepDeg   = 360 / dirFrames;
  const halfStep  = stepDeg / 2;

  const normalizedAngleRad = this.renderAngle + Math.PI / 2;
  const angleDeg = Phaser.Math.Wrap(Phaser.Math.RadToDeg(normalizedAngleRad), 0, 360);

  let frameIndex = Math.round(angleDeg / stepDeg) + 36;
  frameIndex = frameIndex % dirFrames;
  if (frameIndex < 0) frameIndex += dirFrames;

  vs.setFrame(frameIndex);

  // 🔥 3. Mikro‑rotacja (płynna, bez skoków)
  const frameAngleDeg = (frameIndex - 36) * stepDeg;
  let micro = angleDeg - frameAngleDeg;

  micro = Phaser.Math.Wrap(micro + 180, 0, 360) - 180;

  if (micro >  halfStep) micro -= stepDeg;
  if (micro < -halfStep) micro += stepDeg;

  vs.rotation = Phaser.Math.DegToRad(micro);
}





}