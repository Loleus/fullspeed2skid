import { Car } from "./car.js";
import { carConfig } from "./carConfig.js";

export class AICar extends Car {
    constructor(scene, carSprite, worldData, waypoints) {
        super(scene, carSprite, worldData);
        this.waypoints = waypoints;
        this.currentWaypointIndex = 0;
        this.reachedThreshold = 20;

        // Parametry z carConfig
        this.steerSmoothFactor = carConfig.steerSmoothFactor;
        this.steerInputThreshold = carConfig.steerInputThreshold;
        this.maxSteerRad = Phaser.Math.DegToRad(carConfig.MAX_STEER_DEG);
        this.steerSpeedRad = Phaser.Math.DegToRad(carConfig.STEER_SPEED_DEG);
        this.steerReturnSpeedRad = Phaser.Math.DegToRad(carConfig.STEER_RETURN_SPEED_DEG);
        this.speedThresholdForSteerReturn = carConfig.speedThresholdForSteerReturn;
    }

    updateAI(dt, worldW, worldH) {
        // Reset kolizji
        this.collisionCount = 0;

        // Nawierzchnia
        let dx = Math.abs(this.carX - (this.lastSurfaceCheckX ?? this.carX));
        let dy = Math.abs(this.carY - (this.lastSurfaceCheckY ?? this.carY));
        if (dx > this.surfaceCheckThreshold || dy > this.surfaceCheckThreshold || this.lastSurfaceType === null) {
            this.lastSurfaceType = this.worldData.getSurfaceTypeAt(this.carX, this.carY);
            this.lastSurfaceCheckX = this.carX;
            this.lastSurfaceCheckY = this.carY;
        }

        // Zapamiętaj pozycję przed ruchem
        let prevCarX = this.carX;
        let prevCarY = this.carY;

        // Waypoint
        const target = this.waypoints[this.currentWaypointIndex];
        if (!target) return;

        const dxTarget = target.x - this.carX;
        const dyTarget = target.y - this.carY;
        const distance = Math.sqrt(dxTarget * dxTarget + dyTarget * dyTarget);

        if (distance < this.reachedThreshold) {
            this.currentWaypointIndex = (this.currentWaypointIndex + 1) % this.waypoints.length;
        }

        // Kierunek do celu
        const toTarget = new Phaser.Math.Vector2(dxTarget, dyTarget);
        const targetAngle = toTarget.angle();

        // Wektor ruchu
        const velocityVector = new Phaser.Math.Vector2(this.body.velocity.x, this.body.velocity.y);
        const movementAngle = velocityVector.length() > 0.1 ? velocityVector.angle() : this.carAngle;

        // Różnica kąta
        let angleDiff = Phaser.Math.Angle.Wrap(targetAngle - movementAngle);

        // Sterowanie AI
        let steerInput = 0;
        const steerStrength = 0.3;

        if (Math.abs(angleDiff) > this.steerInputThreshold) {
            const steerDirection = Math.sign(angleDiff);
            steerInput = steerDirection * steerStrength;
        }

        // Płynne przejście
        this.steerInput = this.steerInput * this.steerSmoothFactor + steerInput * (1 - this.steerSmoothFactor);

        // Ograniczenie kąta skrętu
        this.steerInput = Phaser.Math.Clamp(this.steerInput, -this.maxSteerRad, this.maxSteerRad);

        // Throttle
        const throttle = Math.abs(angleDiff) < Math.PI / 4 ? 1 : 0.5;

        // Aktualizacja fizyki
        this.updatePhysics(dt, this.steerInput, throttle, this.lastSurfaceType);

        // Kolizje
        if (this.collisionImmunity > 0) {
            this.collisionImmunity -= dt;
            if (this.collisionImmunity < 0) this.collisionImmunity = 0;
        }
        if (this.collisionImmunity <= 0) {
            if (this.checkEllipseCollision()) {
                this.handleCollision(prevCarX, prevCarY, worldW, worldH);
            }
            if (this.checkWorldEdgeCollision(worldW, worldH)) {
                this.handleCollision(prevCarX, prevCarY, worldW, worldH);
            }
        }
    }
}
