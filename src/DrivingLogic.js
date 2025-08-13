// ai_modules/DrivingLogic.js
import { normalizeAngle } from "./utils.js";

export class DrivingLogic {
  constructor(config) {
    this.config = config;
  }

  calculateControls(state, targetPoint, inDangerZone) {
    const angleToTarget = Math.atan2(targetPoint.y - state.carY, targetPoint.x - state.carX);
    const angleDiff = normalizeAngle(angleToTarget - state.carAngle);
    const absAngleDiff = Math.abs(angleDiff);

    let steer = 0;
    let throttle = 0.2; // Domyślna prędkość

    if (absAngleDiff < this.config.DEAD_ZONE_ANGLE) {
      steer = 0;
      throttle = 0.4;
    } else {
      steer = angleDiff * this.config.STEER_P;
      steer = Phaser.Math.Clamp(steer, -this.config.MAX_STEER_INPUT, this.config.MAX_STEER_INPUT);

      if (absAngleDiff > 1.5) throttle = 0.03;
      else if (absAngleDiff > 1.0) throttle = 0.06;
      else if (absAngleDiff > 0.7) throttle = 0.1;
      else if (absAngleDiff > 0.4) throttle = 0.15;
      else throttle = 0.25;
    }
    
    // Ograniczenia prędkości i anty-poślizg
    if (state.speed > 180) throttle = Math.min(throttle, 0.05);
    else if (state.speed > 120) throttle = Math.min(throttle, 0.1);

    if (Math.abs(state.v_y) > 60) {
      throttle *= 0.2;
      steer *= 0.3;
    } else if (Math.abs(state.v_y) > 40) {
      throttle *= 0.5;
      steer *= 0.6;
    }

    if (inDangerZone) {
      throttle *= 0.3;
    }

    return {
      left: steer < -0.005,
      right: steer > 0.005,
      up: throttle > 0,
      down: false,
    };
  }
}