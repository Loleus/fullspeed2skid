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
    this.carSprite.setDisplaySize(this.CAR_WIDTH, this.CAR_HEIGHT);
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
    const corners = this.getCarCorners(
      this.carX, this.carY, this.carAngle,
      this.CAR_HEIGHT, this.CAR_WIDTH
    );

    for (const c of corners) {

      // Lewa ściana
      if (c.x < 0) {
        return {
          px: c.x,
          py: c.y,
          normal: { x: 1, y: 0 },
          penetrationDepth: -c.x
        };
      }

      // Prawa ściana
      if (c.x > worldW) {
        return {
          px: c.x,
          py: c.y,
          normal: { x: -1, y: 0 },
          penetrationDepth: c.x - worldW
        };
      }

      // Górna ściana
      if (c.y < 0) {
        return {
          px: c.x,
          py: c.y,
          normal: { x: 0, y: 1 },
          penetrationDepth: -c.y
        };
      }

      // Dolna ściana
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



  checkEllipseCollision() {
    
    const a = this.COLLISION_HALF_WIDTH;
    const b = this.COLLISION_HALF_HEIGHT;

    const cx = this.carX;
    const cy = this.carY;

    const cosA = Math.cos(this.carAngle);
    const sinA = Math.sin(this.carAngle);

    for (let i = 0; i < this.collisionSteps; i++) {
      const angle = this.collisionAngleStep * i;

      const ex = a * Math.cos(angle);
      const ey = b * Math.sin(angle);

      const px = cx + ex * cosA - ey * sinA;
      const py = cy + ex * sinA + ey * cosA;

      if (this.worldData.getSurfaceTypeAt(px, py) === 'obstacle') {
        let nx = cx - px;
        let ny = cy - py;
        const nlen = Math.hypot(nx, ny) || 1;
        return {
          px, py,
          normal: { x: nx / nlen, y: ny / nlen },
          penetrationDepth: 5
        };
      }
    }

    if (this.worldData.getSurfaceTypeAt(cx, cy) === 'obstacle') {
      return {
        px: cx,
        py: cy,
        normal: { x: 0, y: -1 },
        penetrationDepth: Math.min(a, b)
      };
    }

    return null;
  }

  handleCollision(col) {
    if (!col || !col.normal) return;
    this.collisionCount++;
    const n = col.normal;
    const penetration = col.penetrationDepth || 5;

    const cosA = Math.cos(this.carAngle);
    const sinA = Math.sin(this.carAngle);

    let gVx = this.v_x * cosA - this.v_y * sinA;
    let gVy = this.v_x * sinA + this.v_y * cosA;

    const dot = gVx * n.x + gVy * n.y;

    if (dot < 0) {
      let rx = gVx - 2 * dot * n.x;
      let ry = gVy - 2 * dot * n.y;

      const speed = Math.hypot(rx, ry);
      const bounceF = speed < this.bounceSpeedThreshold ? this.bounceStrengthWeak : this.obstacleBounce;

      rx *= bounceF;
      ry *= bounceF;

      const minBounce = 80;
      const rMag = Math.hypot(rx, ry);
      if (rMag < minBounce) {
        const ang = Math.atan2(ry, rx);
        rx = Math.cos(ang) * minBounce;
        ry = Math.sin(ang) * minBounce;
      }

      this.v_x = rx * cosA + ry * sinA;
      this.v_y = -rx * sinA + ry * cosA;
    }

    const sep = penetration + 5;
    this.carX += n.x * sep;
    this.carY += n.y * sep;
    this.carSprite.x = this.carX;
    this.carSprite.y = this.carY;

    for (let i = 0; i < 40; i++) {
      if (!this.checkEllipseCollision() && !this.checkWorldEdgeCollision(this.worldW, this.worldH)) break;
      this.carX += n.x * 2;
      this.carY += n.y * 2;
      this.carSprite.x = this.carX;
      this.carSprite.y = this.carY;
    }

    this.throttleLock = true;
    this.collisionImmunity = 0.2;
  }


  updateInput(control) {
    throw new Error('updateInput must be implemented in derived class');
  }

  checkCarCollision() {
    
    const opponent = this.isAI ? this.scene.carController : this.scene.aiController;
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
    const { throttle, steerInput } = this.updateInput(control);

    // 🔥 PRZYWRACAMY ROZPOZNAWANIE NAWIERZCHNI
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

    this.updatePhysics(dt, steerInput, throttle, this.lastSurfaceType);

    if (this.collisionImmunity > 0) {
      this.collisionImmunity -= dt;
      if (this.collisionImmunity < 0) this.collisionImmunity = 0;
    }

    if (this.collisionImmunity <= 0) {

      let col = this.checkEllipseCollision();
      if (!col) col = this.checkWorldEdgeCollision(worldW, worldH);
      if (!col) col = this.checkCarCollision();

      if (col) {
        this.carX = prevX;
        this.carY = prevY;
        this.carSprite.x = prevX;
        this.carSprite.y = prevY;
        this.handleCollision(col);
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
    const xOff = halfH - 12;
    const yOff = halfW - 9;
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