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

    Object.assign(this, carConfig);

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

    // Maksymalny dystans pojedynczego podkroku dla CCD.
    // Im mniejszy, tym pewniej wykrywa bardzo cienkie/przypadkowe przeszkody.
    this.collisionSweepStep = 2;
  }

  resetState(startX, startY, startAngle = -Math.PI / 2) {
    this.carX = startX;
    this.carY = startY;

    const startFix = this.worldData?.startFix ?
      Phaser.Math.DegToRad(parseFloat(this.worldData.startFix)) : 0;

    this.carAngle = startAngle + startFix;

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

  getCarCorners(x, y, rot, width, height) {
    const hw = width / 2;
    const hh = height / 2;
    const cosA = Math.cos(rot);
    const sinA = Math.sin(rot);

    return [
      { x: x + (-hw) * cosA - (-hh) * sinA, y: y + (-hw) * sinA + (-hh) * cosA },
      { x: x + (hw) * cosA - (-hh) * sinA, y: y + (hw) * sinA + (-hh) * cosA },
      { x: x + (hw) * cosA - (hh) * sinA, y: y + (hw) * sinA + (hh) * cosA },
      { x: x + (-hw) * cosA - (hh) * sinA, y: y + (-hw) * sinA + (hh) * cosA }
    ];
  }

  updatePhysics(dt, steerInput, throttle, surface) {
    throw new Error('updatePhysics must be implemented in derived class');
  }

  checkWorldEdgeCollision(worldW, worldH) {
    const corners = this.getCarCorners(
      this.carX, this.carY, this.carAngle,
      this.CAR_HEIGHT, this.CAR_WIDTH
    );

    for (const c of corners) {
      if (c.x < 0) {
        return {
          px: c.x,
          py: c.y,
          normal: { x: 1, y: 0 },
          penetrationDepth: -c.x
        };
      }

      if (c.x > worldW) {
        return {
          px: c.x,
          py: c.y,
          normal: { x: -1, y: 0 },
          penetrationDepth: c.x - worldW
        };
      }

      if (c.y < 0) {
        return {
          px: c.x,
          py: c.y,
          normal: { x: 0, y: 1 },
          penetrationDepth: -c.y
        };
      }

      if (c.y > worldH) {
        return {
          px: c.x,
          py: c.y,
          normal: { x: 0, y: -1 },
          penetrationDepth: c.y - worldH
        };
      }
    }

    return null;
  }

  // Punkt jest w przeszkodzie?
  isObstacleAt(x, y) {
    return this.worldData.getSurfaceTypeAt(x, y) === 'obstacle';
  }

  // Stabilniejsza normalna z mapy przeszkód, działa dla wypukłych i wklęsłych kształtów.
  getObstacleNormalAt(px, py, fallbackX, fallbackY) {
    const r = 2;
    const sL = this.isObstacleAt(px - r, py) ? 1 : 0;
    const sR = this.isObstacleAt(px + r, py) ? 1 : 0;
    const sU = this.isObstacleAt(px, py - r) ? 1 : 0;
    const sD = this.isObstacleAt(px, py + r) ? 1 : 0;

    let nx = sL - sR;
    let ny = sU - sD;

    if (nx === 0 && ny === 0) {
      nx = fallbackX - px;
      ny = fallbackY - py;
    }

    const len = Math.hypot(nx, ny) || 1;
    return { x: nx / len, y: ny / len };
  }

  // Sprawdza pełny kształt auta w jednej pozycji:
  // elipsa + środek + narożniki prostokątnego obrysu
  checkObstacleCollisionAt(x, y, rot) {
    const a = this.COLLISION_HALF_WIDTH;
    const b = this.COLLISION_HALF_HEIGHT;
    const cosA = Math.cos(rot);
    const sinA = Math.sin(rot);

    // 1. Środek
    if (this.isObstacleAt(x, y)) {
      return {
        px: x,
        py: y,
        normal: this.getObstacleNormalAt(x, y, x, y - 1),
        penetrationDepth: Math.min(a, b)
      };
    }

    // 2. Narożniki auta
    const corners = this.getCarCorners(x, y, rot, this.CAR_HEIGHT, this.CAR_WIDTH);
    for (const c of corners) {
      if (this.isObstacleAt(c.x, c.y)) {
        const normal = this.getObstacleNormalAt(c.x, c.y, x, y);
        return {
          px: c.x,
          py: c.y,
          normal,
          penetrationDepth: Math.max(2, Math.hypot(c.x - x, c.y - y) * 0.15)
        };
      }
    }

    // 3. Obwód elipsy
    for (let i = 0; i < this.collisionSteps; i++) {
      const sample = this.collisionCircle[i];
      const ex = a * sample.cos;
      const ey = b * sample.sin;

      const px = x + ex * cosA - ey * sinA;
      const py = y + ex * sinA + ey * cosA;

      if (this.isObstacleAt(px, py)) {
        const normal = this.getObstacleNormalAt(px, py, x, y);
        return {
          px,
          py,
          normal,
          penetrationDepth: 4
        };
      }
    }

    return null;
  }

  // CCD: sprawdza cały tor ruchu od poprzedniej pozycji do nowej.
  // Dzięki temu nie da się "przeskoczyć" przez przeszkodę w jednym dt.
  checkObstacleCollisionSweep(fromX, fromY, fromRot, toX, toY, toRot) {
    const dx = toX - fromX;
    const dy = toY - fromY;
    const dist = Math.hypot(dx, dy);

    const steps = Math.max(1, Math.ceil(dist / this.collisionSweepStep));

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = Phaser.Math.Linear(fromX, toX, t);
      const y = Phaser.Math.Linear(fromY, toY, t);
      const rot = Phaser.Math.Angle.RotateTo(fromRot, toRot, Phaser.Math.Angle.Wrap(toRot - fromRot) * t);

      const col = this.checkObstacleCollisionAt(x, y, rot);
      if (col) {
        return {
          ...col,
          hitT: t,
          safeX: Phaser.Math.Linear(fromX, toX, Math.max(0, (i - 1) / steps)),
          safeY: Phaser.Math.Linear(fromY, toY, Math.max(0, (i - 1) / steps))
        };
      }
    }

    return null;
  }

  // Zachowane dla kompatybilności, ale teraz używa pełniejszego testu.
  checkEllipseCollision() {
    return this.checkObstacleCollisionAt(this.carX, this.carY, this.carAngle);
  }

  handleCollision(col, prevX, prevY) {
    if (!col || !col.normal) return;
    if (this.collisionCount >= this.MAX_COLLISIONS_PER_FRAME) return;

    this.collisionCount++;

    const n = col.normal;

    const cosA = Math.cos(this.carAngle);
    const sinA = Math.sin(this.carAngle);

    // lokalne -> globalne
    let gVx = this.v_x * cosA - this.v_y * sinA;
    let gVy = this.v_x * sinA + this.v_y * cosA;

    const speedMagnitude = Math.hypot(gVx, gVy);

    // odbicie względem normalnej
    const dot = gVx * n.x + gVy * n.y;

    let bounceVecX = gVx;
    let bounceVecY = gVy;

    if (dot < 0) {
      bounceVecX = gVx - 2 * dot * n.x;
      bounceVecY = gVy - 2 * dot * n.y;

      const bounceStrength =
        speedMagnitude < this.bounceSpeedThreshold
          ? this.bounceStrengthWeak
          : this.obstacleBounce;

      bounceVecX *= bounceStrength;
      bounceVecY *= bounceStrength;

      // dużo mniejszy minimalny bounce niż wcześniej
      const minBounce = speedMagnitude < 60 ? 0 : 30;
      const bounceMag = Math.hypot(bounceVecX, bounceVecY);

      if (bounceMag > 0 && bounceMag < minBounce) {
        const ang = Math.atan2(bounceVecY, bounceVecX);
        bounceVecX = Math.cos(ang) * minBounce;
        bounceVecY = Math.sin(ang) * minBounce;
      }
    } else {
      // gdy prędkość już nie wchodzi w przeszkodę, nie rób sztucznego odbicia
      bounceVecX *= 0.2;
      bounceVecY *= 0.2;
    }

    // globalne -> lokalne
    this.v_x = bounceVecX * cosA + bounceVecY * sinA;
    this.v_y = -bounceVecX * sinA + bounceVecY * cosA;

    // wróć do ostatniej bezpiecznej pozycji
    if (col.safeX !== undefined && col.safeY !== undefined) {
      this.carX = col.safeX;
      this.carY = col.safeY;
    } else {
      this.carX = prevX;
      this.carY = prevY;
    }

    this.carSprite.x = this.carX;
    this.carSprite.y = this.carY;

    // mały, miękki push-out jak w starej wersji
    for (let i = 0; i < 5; i++) {
      const stillObstacle = this.checkObstacleCollisionAt(this.carX, this.carY, this.carAngle);
      const stillEdge = this.checkWorldEdgeCollision(this.worldW, this.worldH);

      if (!stillObstacle && !stillEdge) break;

      this.carX += n.x * 2;
      this.carY += n.y * 2;
      this.carSprite.x = this.carX;
      this.carSprite.y = this.carY;
    }

    this.throttleLock = true;
    this.collisionImmunity = 0.12;
  }

  updateInput(control) {
    throw new Error('updateInput must be implemented in derived class');
  }

  checkCarCollision() {
    const opponent = this.opponentController;
    if (!opponent) return null;

    const dx = this.carX - opponent.carX;
    const dy = this.carY - opponent.carY;
    const dist = Math.hypot(dx, dy);

    const minDist = this.COLLISION_HALF_WIDTH + opponent.COLLISION_HALF_WIDTH;

    if (dist < minDist) {
      const nx = dx / (dist || 1);
      const ny = dy / (dist || 1);
      return {
        px: this.carX,
        py: this.carY,
        normal: { x: nx, y: ny },
        penetrationDepth: minDist - dist
      };
    }

    return null;
  }

  update(dt, control, worldW, worldH) {
    this.worldW = worldW;
    this.worldH = worldH;

    const { throttle, steerInput } = this.updateInput(control);

    {
      const dx = Math.abs(this.carX - (this.lastSurfaceCheckX ?? this.carX));
      const dy = Math.abs(this.carY - (this.lastSurfaceCheckY ?? this.carY));

      if (dx > this.surfaceCheckThreshold || dy > this.surfaceCheckThreshold || this.lastSurfaceType === null) {
        this.lastSurfaceType = this.worldData.getSurfaceTypeAt(this.carX, this.carY);
        this.lastSurfaceCheckX = this.carX;
        this.lastSurfaceCheckY = this.carY;
      }
    }

    const prevX = this.carX;
    const prevY = this.carY;
    const prevAngle = this.carAngle;

    this.updatePhysics(dt, steerInput, throttle, this.lastSurfaceType);

    if (this.collisionImmunity > 0) {
      this.collisionImmunity -= dt;
      if (this.collisionImmunity < 0) this.collisionImmunity = 0;
    }

    if (this.collisionImmunity <= 0) {
      // Najpierw przeszkody z CCD po całej trajektorii.
      let col = this.checkObstacleCollisionSweep(prevX, prevY, prevAngle, this.carX, this.carY, this.carAngle);

      // Reszta bez zmian.
      if (!col) col = this.checkWorldEdgeCollision(worldW, worldH);
      if (!col) col = this.checkCarCollision();

      if (col) {
        // Dla przeszkód cofamy do ostatniej bezpiecznej pozycji z trajektorii,
        // a nie tylko do prevX/prevY. To blokuje przypadek:
        // teleport -> ściana świata -> odbicie -> powrót przez przeszkodę.
        if (col.safeX !== undefined && col.safeY !== undefined) {
          this.carX = col.safeX;
          this.carY = col.safeY;
        } else {
          this.carX = prevX;
          this.carY = prevY;
        }

        this.carSprite.x = this.carX;
        this.carSprite.y = this.carY;

        if (col) {
          this.handleCollision(col, prevX, prevY);
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
    const halfW = (this.CAR_WIDTH / 2);
    const halfH = this.CAR_HEIGHT / 2;
    const xOff = halfH - 10;
    const yOff = halfW - 5;
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
      v_x: this.v_x,
      v_y: this.v_y,
      speed: Math.abs(this.v_x)
    };
  }

  updateVisualSpriteFromAngle(dt = 0) {
    const vs = this.visualSprite;
    const s = this.carSprite;
    if (!vs || !s || !vs.texture) return;

    vs.x = s.x;
    vs.y = s.y;

    const totalFrames = vs.texture.frameTotal || 1;
    if (totalFrames <= 1) {
      vs.rotation = s.rotation;
      return;
    }

    const dirFrames = totalFrames === 49 ? 48 : Math.min(totalFrames, 48);
    const stepDeg = 360 / dirFrames;
    const halfStep = stepDeg / 2;

    const normalizedAngleRad = this.carAngle + Math.PI / 2;
    const angleDeg = Phaser.Math.Wrap(Phaser.Math.RadToDeg(normalizedAngleRad), 0, 360);

    let frameIndex = Math.round(angleDeg / stepDeg);
    if (frameIndex >= dirFrames) frameIndex = 0;

    const frameAngleDeg = frameIndex * stepDeg;

    let micro = angleDeg - frameAngleDeg;
    micro = Phaser.Math.Wrap(micro + 180, 0, 360) - 180;

    if (micro > halfStep) micro -= stepDeg;
    if (micro < -halfStep) micro += stepDeg;

    micro = Math.round(micro);

    vs.setFrame(frameIndex);
    vs.rotation = Phaser.Math.DegToRad(micro);
  }
}