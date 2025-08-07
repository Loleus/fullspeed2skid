// AICar.js
import { Car } from "./car.js";
import { carConfig } from "./carConfig.js";

export class AICar extends Car {
  constructor(scene, carSprite, worldData, waypoints) {
    super(scene, carSprite, worldData);

    // trasa i waypointy
    this.waypoints            = waypoints;
    this.currentWaypointIndex = 0;
    this.reachedThreshold     = 20;

    // Pure Pursuit – parametry
    this.lookAheadDistance = 50;     // początkowa odległość look-ahead
    this.minLookAhead      = 30;
    this.maxLookAhead      = 80;
    this.curvatureGain     = 1.0;

    // sterowanie
    this.steerSmoothFactor = carConfig.steerSmoothFactor;
    this.maxSteerRad       = Phaser.Math.DegToRad(carConfig.MAX_STEER_DEG);
    this.steerInput        = 0;

    // throttling
    this.minThrottle = 0.2;
    this.maxThrottle = 1.0;
  }

  updateAI(dt, worldW, worldH) {
    const px = this.carX;
    const py = this.carY;

    // 0) dynamiczne dostosowanie lookAheadDistance do prędkości
    if (this.carSpeed != null) {
      this.lookAheadDistance = Phaser.Math.Clamp(
        this.carSpeed * 1.5,
        this.minLookAhead,
        this.maxLookAhead
      );
    }

    // 1) wybór look-ahead point spośród waypointów przed autem
    let lookPoint = null;
    for (let i = 0; i < this.waypoints.length; i++) {
      const idx = (this.currentWaypointIndex + i) % this.waypoints.length;
      const wp  = this.waypoints[idx];
      const d   = Phaser.Math.Distance.Between(px, py, wp.x, wp.y);
      if (d < this.lookAheadDistance) continue;

      const angToWP = Phaser.Math.Angle.Between(px, py, wp.x, wp.y);
      const alpha   = Phaser.Math.Angle.Wrap(angToWP - this.carAngle);
      // pomijamy punkty zza pleców
      if (Math.abs(alpha) > Math.PI / 2) continue;

      lookPoint = wp;
      break;
    }
    // fallback na kolejny waypoint
    if (!lookPoint) {
      lookPoint = this.waypoints[
        (this.currentWaypointIndex + 1) % this.waypoints.length
      ];
    }

    // 2) przełącz waypoint gdy jesteśmy blisko bieżącego
    const currentWP = this.waypoints[this.currentWaypointIndex];
    if (
      Phaser.Math.Distance.Between(px, py, currentWP.x, currentWP.y) <
      this.reachedThreshold
    ) {
      this.currentWaypointIndex =
        (this.currentWaypointIndex + 1) % this.waypoints.length;
    }

    // 3) obliczenie błędu kątowego (alpha)
    const targetAngle = Phaser.Math.Angle.Between(px, py, lookPoint.x, lookPoint.y);
    const heading     = this.carAngle;
    const alpha       = Phaser.Math.Angle.Wrap(targetAngle - heading);

    // 4) obliczenie krzywizny łuku
    const curvature = (2 * Math.sin(alpha)) / this.lookAheadDistance;

    // 5) sygnał sterowania
    let rawSteer = curvature * this.curvatureGain;
    // limit do zakresu [-1,1]
    rawSteer = Phaser.Math.Clamp(rawSteer, -1, 1);

    // 6) wygładzanie sterowania
    this.steerInput =
      this.steerInput * this.steerSmoothFactor +
      rawSteer * (1 - this.steerSmoothFactor);

    // 7) throttle zależny od kąta alpha
    let throttle = this.maxThrottle * (1 - Math.abs(alpha) / Math.PI);
    throttle     = Phaser.Math.Clamp(throttle, this.minThrottle, this.maxThrottle);

    // 8) update fizyki
    this.updatePhysics(
      dt,
      this.steerInput,
      throttle,
      this.worldData.getSurfaceTypeAt(px, py)
    );

    // 9) obsługa kolizji
    if (this.collisionImmunity > 0) {
      this.collisionImmunity -= dt;
      if (this.collisionImmunity < 0) this.collisionImmunity = 0;
    }
    if (this.collisionImmunity <= 0) {
      const collided =
        this.checkEllipseCollision() || this.checkWorldEdgeCollision(worldW, worldH);
      if (collided) {
        this.handleCollision(px, py, worldW, worldH);
      }
    }

    // Debug (opcjonalnie):
    // console.log(
    //   "WP idx:", this.currentWaypointIndex,
    //   "alpha:", alpha.toFixed(2),
    //   "lookDist:", this.lookAheadDistance.toFixed(0),
    //   "steer:", this.steerInput.toFixed(2),
    //   "thr:", throttle.toFixed(2)
    // );
  }
}
