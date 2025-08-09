import { Car } from "./car.js";
import { carConfig } from "./carConfig.js";

export class AICar extends Car {
  constructor(scene, carSprite, worldData, waypoints) {
    super(scene, carSprite, worldData);
    this.waypoints = waypoints;
    this.currentSegmentIndex = 1;
    this.isLoop = true;

    this._buildPathMetrics();

    // Much longer lookahead for very gentle anticipation
    this.minLookAhead = 15;
    this.maxLookAhead = 50;
    this.lookAheadDistance = this.minLookAhead;
    this.LdLPAlpha = 0.08; // Very slow adaptation

    // Very gentle gains for minimal steering response
    this.baseCurvatureGain = 0.8;
    this.kStanley = 0.15; // Much reduced cross-track correction
    this.stanleyV0 = 8.0; // Higher baseline for gentler correction

    // Much slower steering dynamics
    this.steerInput = 0;
    this.steerVelocity = 0;
    this.steerVelocityLimit = Phaser.Math.DegToRad(60); // Very slow steering speed
    this.steerSpringFactor = 2.0; // Much reduced spring force
    this.steerDampingFactor = 2.5; // Gentle damping
    this.maxSteerRad = Phaser.Math.DegToRad(carConfig.MAX_STEER_DEG);

    // Much larger deadzone for stable driving
    this.alphaDeadzone = Phaser.Math.DegToRad(4);
    this.steerReturnSpeedRad = Phaser.Math.DegToRad(45); // Slower return to center

    // Throttle settings
    this.minThrottle = 0.2;
    this.maxThrottle = 0.6; // Reduced max speed

    this.prevAlpha = 0;
    // Even closer to waypoints before switching
    this.switchDist = 5;

    // More averaging for stability
    this.alphaAvgSamples = 5;
    this.alphaSampleSpacing = 6;
    this.alphaMinRad = Phaser.Math.DegToRad(1);
    this.lookScanStep = 3;
    this.kAlphaRate = 0.0;

    // Very reduced slip compensation
    this.kVelHeadingMix = 0.3;
    this.kCounterSteer = 0.1;
    this.kSlipReduce = 1.0;
    this.betaRef = Phaser.Math.DegToRad(30);
    this.kThrottleSlip = 0.2;

    this.throttleLock = false;

    this.hairpinVisibilityRatio = 0.0;
    this.tangentForwardThresh = -0.3;
    this.hairpinAngleDeg = 90; // Detect gentler turns as hairpins
    this.hairpinClampLd = 20; // Longer lookahead even in hairpins
    this.hairpinWindow = 40;

    // Post-collision recovery
    this.postCollisionTimer = 0;
    this.postCollisionMax = 0.8; // Longer recovery time
    this.recoverTargetAngle = null;

    // Additional smoothing parameters
    this.steerSmoothing = 0.85; // Exponential smoothing factor
    this.lastSteerInput = 0;
  }

  _buildPathMetrics() {
    this.segLen = [];
    this.cumLen = [0];
    let total = 0;
    for (let i = 0; i < this.waypoints.length; i++) {
      const a = this.waypoints[i];
      const b = this.waypoints[(i + 1) % this.waypoints.length];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      this.segLen.push(len);
      total += len;
      this.cumLen.push(total);
    }
    this.totalLen = total;
  }

  _wrapIndex(i) {
    const n = this.waypoints.length;
    return ((i % n) + n) % n;
  }

  _pointOnSegment(ax, ay, bx, by, t) {
    return { x: ax + (bx - ax) * t, y: ay + (by - ay) * t };
  }

  _wrapS(s) {
    if (!this.isLoop) return Phaser.Math.Clamp(s, 0, this.totalLen);
    s %= this.totalLen;
    if (s < 0) s += this.totalLen;
    return s;
  }

  _pointAtS(s) {
    s = this._wrapS(s);
    let lo = 0, hi = this.cumLen.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.cumLen[mid] <= s) lo = mid + 1;
      else hi = mid;
    }
    const segIndex = Phaser.Math.Clamp(lo - 1, 0, this.segLen.length - 1);
    const s0 = this.cumLen[segIndex];
    const segL = this.segLen[segIndex] || 1e-6;
    const t = Phaser.Math.Clamp((s - s0) / segL, 0, 1);
    const a = this.waypoints[segIndex];
    const b = this.waypoints[(segIndex + 1) % this.waypoints.length];
    const p = this._pointOnSegment(a.x, a.y, b.x, b.y, t);
    return { x: p.x, y: p.y, segIndex, t };
  }

  _closestPointOnPath(px, py) {
    const n = this.waypoints.length;
    let best = { dist2: Infinity, x: 0, y: 0, segIndex: 0, t: 0, s: 0, crossTrack: 0 };
    for (let k = this.currentSegmentIndex - 2; k <= this.currentSegmentIndex + 2; k++) {
      const i = this._wrapIndex(k);
      const a = this.waypoints[i];
      const b = this.waypoints[(i + 1) % n];
      const vx = b.x - a.x;
      const vy = b.y - a.y;
      const wx = px - a.x;
      const wy = py - a.y;
      const segL2 = vx * vx + vy * vy || 1e-6;
      let t = (vx * wx + vy * wy) / segL2;
      t = Phaser.Math.Clamp(t, 0, 1);
      const cx = a.x + vx * t;
      const cy = a.y + vy * t;
      const dx = px - cx;
      const dy = py - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 < best.dist2) {
        const crossZ = vx * (py - a.y) - vy * (px - a.x);
        const sign = Math.sign(crossZ) || 0;
        const s = this.cumLen[i] + Math.hypot(vx * t, vy * t);
        best = { dist2: d2, x: cx, y: cy, segIndex: i, t, s, crossTrack: Math.sqrt(d2) * sign };
      }
    }
    return best;
  }

  _forwardDistance(s0, s1) {
    let d = s1 - s0;
    if (d < 0) d += this.totalLen;
    return d;
  }

  _tangentAtS(s) {
    const p = this._pointAtS(s);
    const a = this.waypoints[p.segIndex];
    const b = this.waypoints[(p.segIndex + 1) % this.waypoints.length];
    let tx = b.x - a.x, ty = b.y - a.y;
    const len = Math.hypot(tx, ty) || 1e-6;
    return { x: p.x, y: p.y, segIndex: p.segIndex, t: p.t, tx: tx / len, ty: ty / len };
  }

  _findLookPointForward(px, py, carAngle, nearestS, sStart, maxAhead) {
    const fx = Math.cos(carAngle);
    const fy = Math.sin(carAngle);
    const steps = Math.ceil(maxAhead / this.lookScanStep);

    for (let j = 0; j < steps; j++) {
      const s = this._wrapS(sStart + j * this.lookScanStep);
      const tp = this._tangentAtS(s);

      const dx = tp.x - px, dy = tp.y - py;
      const dotPos = dx * fx + dy * fy;
      if (dotPos <= 0) continue;

      const dotTan = tp.tx * fx + tp.ty * fy;
      if (dotTan < this.tangentForwardThresh) continue;

      const pathDist = this._forwardDistance(nearestS, s);
      const euclid = Math.hypot(dx, dy);
      if (pathDist > 1 && euclid / pathDist < this.hairpinVisibilityRatio) continue;

      const alpha = Phaser.Math.Angle.Wrap(Phaser.Math.Angle.Between(px, py, tp.x, tp.y) - carAngle);
      if (Math.abs(alpha) < this.alphaMinRad) continue;

      return { x: tp.x, y: tp.y, s };
    }

    const p0 = this._pointAtS(sStart);
    return { x: p0.x, y: p0.y, s: sStart };
  }

  updateAI(dt, worldW, worldH) {
    const px = this.carX;
    const py = this.carY;
    const v = Math.hypot(this.v_x, this.v_y);

    // Much more conservative adaptive lookahead
    const LdTarget = Phaser.Math.Clamp(20 + v * 0.5, this.minLookAhead, this.maxLookAhead);
    this.lookAheadDistance = Phaser.Math.Linear(this.lookAheadDistance, LdTarget, this.LdLPAlpha);

    const nearest = this._closestPointOnPath(px, py);
    this.currentSegmentIndex = nearest.segIndex;

    const a = this.waypoints[this.currentSegmentIndex];
    const b = this.waypoints[(this.currentSegmentIndex + 1) % this.waypoints.length];
    const c = this.waypoints[(this.currentSegmentIndex + 2) % this.waypoints.length];

    const abx = b.x - a.x, aby = b.y - a.y;
    const bcx = c.x - b.x, bcy = c.y - b.y;
    const lab = Math.hypot(abx, aby) || 1e-6;
    const lbc = Math.hypot(bcx, bcy) || 1e-6;
    const dot = (abx * bcx + aby * bcy) / (lab * lbc);
    const turnDeg = Math.abs(Phaser.Math.RadToDeg(Math.acos(Phaser.Math.Clamp(dot, -1, 1))))
    const distToNext = Math.hypot(px - b.x, py - b.y);
    if (turnDeg >= this.hairpinAngleDeg && distToNext < this.hairpinWindow) {
      const LdTargetHard = Math.min(this.lookAheadDistance, this.hairpinClampLd);
      this.lookAheadDistance = Phaser.Math.Linear(this.lookAheadDistance, LdTargetHard, 0.3);
    }

    // Very conservative slip compensation
    const beta = Math.atan2(this.v_y, Math.max(1e-3, this.v_x));
    const headingEff = this.carAngle + this.kVelHeadingMix * beta;

    // Recovery mode after collision
    if (this.postCollisionTimer > 0) {
      this.postCollisionTimer -= dt;

      const tan = this._tangentAtS(nearest.s);
      const pathAngle = Math.atan2(tan.ty, tan.tx);
      const targetAngle = this.recoverTargetAngle ?? pathAngle;
      const alphaRecover = Phaser.Math.Angle.Wrap(targetAngle - headingEff);

      // Very gentle recovery steering
      let deltaDesired = Math.atan2(2 * this.wheelBase * Math.sin(alphaRecover), Math.max(this.lookAheadDistance, 1e-3));
      deltaDesired -= this.kCounterSteer * beta;
      const slipFactor = Phaser.Math.Clamp(1 / (1 + this.kSlipReduce * Math.abs(beta) / this.betaRef), 0.7, 1.0);
      deltaDesired *= slipFactor;

      const rawSteer = Phaser.Math.Clamp(deltaDesired / this.maxSteerRad, -1, 1);

      // Much gentler steering forces
      const steerForce = (rawSteer - this.steerInput) * (this.steerSpringFactor * 0.5);
      const steerDamping = -this.steerVelocity * (this.steerDampingFactor * 1.5);
      const steerAccel = steerForce + steerDamping;
      this.steerVelocity += steerAccel * dt;
      this.steerVelocity = Phaser.Math.Clamp(this.steerVelocity, -this.steerVelocityLimit, this.steerVelocityLimit);
      this.steerInput += this.steerVelocity * dt;

      // Exponential smoothing for steering
      this.steerInput = this.steerSmoothing * this.lastSteerInput + (1 - this.steerSmoothing) * this.steerInput;
      this.lastSteerInput = this.steerInput;

      if (Math.abs(alphaRecover) < this.alphaDeadzone * 0.5) {
        const retDelta = this.steerReturnSpeedRad * dt;
        this.steerInput = Math.abs(this.steerInput) <= retDelta
          ? 0
          : this.steerInput - Math.sign(this.steerInput) * retDelta;
      }

      const steerRad = Phaser.Math.Clamp(
        this.steerInput * this.maxSteerRad,
        -this.maxSteerRad,
        this.maxSteerRad
      );

      const forwardDot = tan.tx * Math.cos(headingEff) + tan.ty * Math.sin(headingEff);
      let throttle = this.minThrottle + 0.3 * (this.maxThrottle - this.minThrottle);
      const slipCut = Phaser.Math.Clamp(Math.abs(beta) / this.betaRef, 0, 1);
      throttle *= (1 - this.kThrottleSlip * slipCut);
      if (forwardDot < 0 && Math.abs(v) > 8) {
        throttle = this.minThrottle;
      }
      throttle = Phaser.Math.Clamp(throttle, this.minThrottle, this.maxThrottle);

      if (this.throttleLock && this.collisionImmunity <= 0 && !this.checkEllipseCollision() && !this.checkWorldEdgeCollision(worldW, worldH)) {
        this.updateInput({ up: false, down: false });
      }

      this.updatePhysics(
        dt,
        steerRad,
        throttle,
        this.worldData.getSurfaceTypeAt(px, py)
      );

      if (this.collisionImmunity > 0) {
        this.collisionImmunity = Math.max(0, this.collisionImmunity - dt);
      } else if (this.checkEllipseCollision() || this.checkWorldEdgeCollision(worldW, worldH)) {
        this.handleCollision(px, py, worldW, worldH);
      }

      this.prevAlpha = alphaRecover;
      return;
    }

    const sLA = this._wrapS(nearest.s + this.lookAheadDistance);
    const lookP = this._findLookPointForward(px, py, this.carAngle, nearest.s, sLA, this.lookAheadDistance * 1.2);

    // Much more averaging for smoother control
    let sumAlpha = 0, cnt = 0;
    const fx = Math.cos(headingEff), fy = Math.sin(headingEff);
    for (let i = 0; i < this.alphaAvgSamples; i++) {
      const sSi = this._wrapS(sLA + i * this.alphaSampleSpacing);
      const tp = this._tangentAtS(sSi);
      const dx = tp.x - px, dy = tp.y - py;
      const dotPos = dx * fx + dy * fy;
      if (dotPos <= 0) break;
      const dotTan = tp.tx * fx + tp.ty * fy;
      if (dotTan < this.tangentForwardThresh) break;

      const pathDist = this._forwardDistance(nearest.s, sSi);
      const euclid = Math.hypot(dx, dy);
      if (pathDist > 1 && euclid / pathDist < this.hairpinVisibilityRatio) break;

      const ang = Phaser.Math.Angle.Between(px, py, tp.x, tp.y);
      const a = Phaser.Math.Angle.Wrap(ang - headingEff);
      sumAlpha += a; cnt++;
    }

    const alphaMean = cnt > 0
      ? sumAlpha / cnt
      : Phaser.Math.Angle.Wrap(Phaser.Math.Angle.Between(px, py, lookP.x, lookP.y) - headingEff);

    // Much gentler Stanley controller
    const stanley = Math.atan2(-this.kStanley * nearest.crossTrack, this.stanleyV0 + Math.abs(v));
    const alphaRate = (alphaMean - this.prevAlpha) / Math.max(dt, 1e-3);
    const alphaEff = Phaser.Math.Angle.Wrap(alphaMean + stanley + this.kAlphaRate * alphaRate);

    // Bicycle model with very conservative gains
    let deltaDesired = Math.atan2(2 * this.wheelBase * Math.sin(alphaEff), Math.max(this.lookAheadDistance, 1e-3));
    deltaDesired -= this.kCounterSteer * beta;
    const slipFactor = Phaser.Math.Clamp(1 / (1 + this.kSlipReduce * Math.abs(beta) / this.betaRef), 0.7, 1.0);
    deltaDesired *= slipFactor;

    // Limit maximum steering angle for gentler turns
    deltaDesired = Phaser.Math.Clamp(deltaDesired, -this.maxSteerRad * 0.6, this.maxSteerRad * 0.6);

    const rawSteer = Phaser.Math.Clamp(deltaDesired / this.maxSteerRad, -1, 1);

    // Very gentle steering dynamics
    const steerForce = (rawSteer - this.steerInput) * this.steerSpringFactor;
    const steerDamping = -this.steerVelocity * this.steerDampingFactor;
    const steerAccel = steerForce + steerDamping;

    this.steerVelocity += steerAccel * dt;
    this.steerVelocity = Phaser.Math.Clamp(this.steerVelocity, -this.steerVelocityLimit, this.steerVelocityLimit);
    this.steerInput += this.steerVelocity * dt;

    // Apply exponential smoothing to reduce jitter
    this.steerInput = this.steerSmoothing * this.lastSteerInput + (1 - this.steerSmoothing) * this.steerInput;
    this.lastSteerInput = this.steerInput;

    // Larger deadzone for center return
    if (Math.abs(alphaEff) < this.alphaDeadzone * 0.5) {
      const retDelta = this.steerReturnSpeedRad * dt;
      this.steerInput = Math.abs(this.steerInput) <= retDelta
        ? 0
        : this.steerInput - Math.sign(this.steerInput) * retDelta;
    }

    const steerRad = Phaser.Math.Clamp(
      this.steerInput * this.maxSteerRad,
      -this.maxSteerRad,
      this.maxSteerRad
    );

    // Very conservative throttle control
    let throttle = this.maxThrottle - (Math.min(Math.abs(alphaEff) / (Math.PI * 0.3), 1) * (this.maxThrottle - this.minThrottle));
    const slipCut = Phaser.Math.Clamp(Math.abs(beta) / this.betaRef, 0, 1);
    throttle *= (1 - this.kThrottleSlip * slipCut);
    if (v < 15) throttle = Math.max(throttle, this.minThrottle + 0.3 * (this.maxThrottle - this.minThrottle));
    throttle = Phaser.Math.Clamp(throttle, this.minThrottle, this.maxThrottle);

    const tx = b.x - a.x, ty = b.y - a.y;
    const forwardToNext = tx * fx + ty * fy;

    // Very strict waypoint switching
    if ((distToNext <= this.switchDist || nearest.t >= 0.98) && forwardToNext > 0.5) {
      this.currentSegmentIndex = (this.currentSegmentIndex + 1) % this.waypoints.length;
    }

    if (this.throttleLock && this.collisionImmunity <= 0 &&
      !this.checkEllipseCollision() && !this.checkWorldEdgeCollision(worldW, worldH)) {
      this.updateInput({ up: false, down: false });
    }

    this.updatePhysics(
      dt,
      steerRad,
      throttle,
      this.worldData.getSurfaceTypeAt(px, py)
    );

    if (this.collisionImmunity > 0) {
      this.collisionImmunity = Math.max(0, this.collisionImmunity - dt);
    } else if (this.checkEllipseCollision() || this.checkWorldEdgeCollision(worldW, worldH)) {
      this.handleCollision(px, py, worldW, worldH);
    }

    this.prevAlpha = alphaMean;
  }

  handleCollision(prevX, prevY, worldW, worldH) {
    super.handleCollision(prevX, prevY, worldW, worldH);
    this.postCollisionTimer = this.postCollisionMax;
    const nearest = this._closestPointOnPath(this.carX, this.carY);
    const tan = this._tangentAtS(nearest.s);
    this.recoverTargetAngle = Math.atan2(tan.ty, tan.tx);
  }
}