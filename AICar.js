// AICar.js
import { Car } from "./car.js";
import { carConfig } from "./carConfig.js";

export class AICar extends Car {
  constructor(scene, carSprite, worldData, waypoints) {
    super(scene, carSprite, worldData);

    // Trasa i waypointy
    this.waypoints = waypoints;
    this.currentWaypointIndex = 0;
    this.reachedThreshold = 25; // Zmniejszony próg dla szybszego przełączania

    // Pure Pursuit – parametry ZWIĘKSZONE dla wcześniejszego reagowania
    this.minLookAhead = 15; // Zwiększone z 8
    this.maxLookAhead = 40; // Zwiększone z 25
    this.lookAheadDistance = this.minLookAhead;
    this.baseCurvatureGain = 5.0; // Zmniejszone dla łagodniejszego sterowania
    this.alphaDeadzone = Phaser.Math.DegToRad(5); // Mniejsza martwa strefa

    // Sterowanie - PŁYNNIEJSZE
    this.baseSteerSmooth = 0.25; // Zwiększone dla płynności
    this.steerInput = 0;
    
    // Throttle - ZBALANSOWANY
    this.minThrottle = 0.4;
    this.maxThrottle = 0.9;

    // Parametry trasy - WCZEŚNIEJSZE REAGOWANIE
    this.straightLineThreshold = Phaser.Math.DegToRad(15); // Zmniejszone
    this.steerPredictionFactor = 0.8; // Zwiększone przewidywanie
    
    // Konfiguracja z carConfig.js
    this.wheelBase = carConfig.wheelBase;
    this.maxSteer = Phaser.Math.DegToRad(carConfig.MAX_STEER_DEG);

    // AI control state
    this.aiControl = {
      up: false,
      down: false,
      left: false,
      right: false
    };

    // Stan kolizji - POPRAWIONY MECHANIZM
    this.collisionRecoveryTime = 0;
    this.maxCollisionRecovery = 0.8; // Krótszy czas odzyskiwania
    this.collisionRecoveryPhase = 'none'; // 'backing', 'turning', 'accelerating'
    this.recoveryDirection = 0; // Kierunek ucieczki od przeszkody
  }

  updateAI(dt, worldW, worldH) {
    // Sprawdź czy odzyskujemy się po kolizji
    if (this.collisionRecoveryTime > 0) {
      this.handleCollisionRecovery(dt);
      this.update(dt, this.aiControl, worldW, worldH);
      return;
    }

    const px = this.carX;
    const py = this.carY;

    // 1) Sprawdź czy jesteśmy na prostej
    const isStraightSection = this.detectStraightSection();

    // 2) Dynamiczny look-ahead - AGRESYWNIEJSZY
    const speed = Math.hypot(this.v_x, this.v_y);
    let lookAhead = Phaser.Math.Clamp(
      speed * 0.15 + this.minLookAhead, // Zwiększone z 0.08
      this.minLookAhead, 
      this.maxLookAhead
    );

    // Na prostych patrz znacznie dalej
    if (isStraightSection) {
      lookAhead = Math.min(lookAhead * 2.0, this.maxLookAhead);
    } else {
      // Na zakrętach też patrz dalej dla wcześniejszego reagowania
      lookAhead = Math.min(lookAhead * 1.3, this.maxLookAhead);
    }
    
    this.lookAheadDistance = lookAhead;

    // 3) Najpierw aktualizuj waypoint
    this.updateWaypointIndex(px, py);

    // 4) Znajdź punkt docelowy - ULEPSZONA LOGIKA
    let lookPoint = this.selectLookPointImproved(px, py, lookAhead);

    // 5) Oblicz kąty - używamy kierunku auta
    const targetAng = Phaser.Math.Angle.Between(px, py, lookPoint.x, lookPoint.y);
    const alpha = Phaser.Math.Angle.Wrap(targetAng - this.carAngle);

    // 6) Oblicz sterowanie - ULEPSZONE
    const steerCommand = this.calculateImprovedSteering(alpha, isStraightSection, dt, speed);

    // 7) Oblicz przyspieszenie - LEPSZE ZBALANSOWANIE
    const throttle = this.calculateImprovedThrottle(alpha, isStraightSection, speed);

    // 8) Konwertuj na kontrolki
    this.aiControl.up = throttle > 0.1;
    this.aiControl.down = false;
    
    // Zmniejszony próg sterowania
    if (Math.abs(steerCommand) > 0.05) {
      this.aiControl.left = steerCommand < 0;
      this.aiControl.right = steerCommand > 0;
    } else {
      this.aiControl.left = false;
      this.aiControl.right = false;
    }

    // 9) Wywołaj update z Car
    this.update(dt, this.aiControl, worldW, worldH);

    // 10) Sprawdź kolizję i uruchom odzyskiwanie
    if (this.checkEllipseCollision() || this.checkWorldEdgeCollision(worldW, worldH)) {
      if (this.collisionImmunity <= 0) {
        this.startCollisionRecovery();
      }
    }
  }

  detectStraightSection() {
    if (this.waypoints.length < 3) return true;
    
    const current = this.waypoints[this.currentWaypointIndex];
    const next = this.waypoints[(this.currentWaypointIndex + 1) % this.waypoints.length];
    const nextNext = this.waypoints[(this.currentWaypointIndex + 2) % this.waypoints.length];

    const angle1 = Math.atan2(next.y - current.y, next.x - current.x);
    const angle2 = Math.atan2(nextNext.y - next.y, nextNext.x - next.x);
    const angleDiff = Math.abs(Phaser.Math.Angle.Wrap(angle2 - angle1));

    return angleDiff < this.straightLineThreshold;
  }

  selectLookPointImproved(px, py, lookAhead) {
    // Szukaj punktu w odległości lookAhead, ale inteligentniej
    let totalDistance = 0;
    let currentIdx = this.currentWaypointIndex;
    
    // Sprawdź więcej waypointów dla lepszego przewidywania
    const checkCount = Math.min(12, this.waypoints.length);
    
    for (let i = 0; i < checkCount; i++) {
      const idx = (currentIdx + i) % this.waypoints.length;
      const nextIdx = (currentIdx + i + 1) % this.waypoints.length;
      
      const wp = this.waypoints[idx];
      const nextWp = this.waypoints[nextIdx];
      
      if (i === 0) {
        // Odległość do pierwszego waypointa
        totalDistance = Phaser.Math.Distance.Between(px, py, wp.x, wp.y);
      } else {
        // Dodaj odległość między waypointami
        const prevWp = this.waypoints[(currentIdx + i - 1) % this.waypoints.length];
        totalDistance += Phaser.Math.Distance.Between(prevWp.x, prevWp.y, wp.x, wp.y);
      }
      
      // Jeśli osiągnęliśmy lub przekroczyliśmy lookAhead
      if (totalDistance >= lookAhead) {
        // Interpoluj między tym a poprzednim punktem
        if (i > 0) {
          const prevWp = this.waypoints[(currentIdx + i - 1) % this.waypoints.length];
          const excess = totalDistance - lookAhead;
          const segmentLength = Phaser.Math.Distance.Between(prevWp.x, prevWp.y, wp.x, wp.y);
          
          if (segmentLength > 0) {
            const ratio = 1 - (excess / segmentLength);
            return {
              x: prevWp.x + (wp.x - prevWp.x) * ratio,
              y: prevWp.y + (wp.y - prevWp.y) * ratio
            };
          }
        }
        return wp;
      }
    }
    
    // Jeśli nie znaleziono, użyj najdalszego punktu
    return this.waypoints[(currentIdx + checkCount - 1) % this.waypoints.length];
  }

  updateWaypointIndex(px, py) {
    const current = this.waypoints[this.currentWaypointIndex];
    const next = this.waypoints[(this.currentWaypointIndex + 1) % this.waypoints.length];
    
    const distToNext = Phaser.Math.Distance.Between(px, py, next.x, next.y);
    const distToCurrent = Phaser.Math.Distance.Between(px, py, current.x, current.y);
    
    // Bardziej agresywne przełączanie waypointów
    if (distToNext < this.reachedThreshold || 
        (distToNext < distToCurrent && distToNext < this.reachedThreshold * 1.5)) {
      this.currentWaypointIndex = (this.currentWaypointIndex + 1) % this.waypoints.length;
    }
  }

  calculateImprovedSteering(alpha, isStraightSection, dt, speed) {
    let targetSteer = 0;
    
    // Mniejsza martwa strefa
    if (Math.abs(alpha) < this.alphaDeadzone) {
      targetSteer = 0;
    } else {
      // Bardziej responsywne sterowanie
      const normalizedAlpha = alpha / (Math.PI / 3); // Użyj 60 stopni zamiast 45
      targetSteer = Phaser.Math.Clamp(normalizedAlpha, -1, 1);
      
      // Zmniejsz agresywność tylko na długich prostych
      if (isStraightSection && Math.abs(alpha) < Phaser.Math.DegToRad(10)) {
        targetSteer *= 0.6;
      }
      
      // Wzmocnienie zależne od prędkości
      const speedFactor = Math.max(0.5, 1 - (speed / (this.maxSpeed * 0.8)));
      targetSteer *= this.baseCurvatureGain * 0.15 * speedFactor;
    }
    
    // Adaptacyjne wygładzanie
    const smoothFactor = isStraightSection ? 0.3 : 0.2;
    this.steerInput = this.steerInput * (1 - smoothFactor) + targetSteer * smoothFactor;
    
    // Ograniczenie
    this.steerInput = Phaser.Math.Clamp(this.steerInput, -1, 1);
    
    // Zerowanie małych wartości
    if (Math.abs(this.steerInput) < 0.03) {
      this.steerInput = 0;
    }
    
    return this.steerInput;
  }

  calculateImprovedThrottle(alpha, isStraightSection, speed) {
    let throttle = this.maxThrottle;
    
    // Bardziej inteligentne zwalnianie na zakrętach
    if (!isStraightSection) {
      const angleFactor = Math.abs(alpha) / Math.PI;
      const reductionFactor = Math.pow(angleFactor, 0.7) * 0.6; // Łagodniejsza krzywa
      throttle *= (1 - reductionFactor);
    }
    
    // Kontrola prędkości
    const speedRatio = speed / (this.maxSpeed * 0.9);
    if (speedRatio > 0.6) {
      throttle *= (1 - (speedRatio - 0.6) * 0.4);
    }
    
    // Zapewnij minimum gazu
    throttle = Math.max(throttle, this.minThrottle);
    
    return Phaser.Math.Clamp(throttle, this.minThrottle, this.maxThrottle);
  }

  startCollisionRecovery() {
    this.collisionRecoveryTime = this.maxCollisionRecovery;
    this.collisionRecoveryPhase = 'backing';
    
    // Określ kierunek ucieczki - przeciwny do obecnego kierunku
    this.recoveryDirection = Phaser.Math.Angle.Wrap(this.carAngle + Math.PI);
  }

  handleCollisionRecovery(dt) {
    this.collisionRecoveryTime -= dt;
    
    const recoveryProgress = 1 - (this.collisionRecoveryTime / this.maxCollisionRecovery);
    
    if (recoveryProgress < 0.3) {
      // Faza 1: Krótkie cofanie
      this.collisionRecoveryPhase = 'backing';
      this.aiControl.up = false;
      this.aiControl.down = true;
      this.aiControl.left = false;
      this.aiControl.right = false;
      
    } else if (recoveryProgress < 0.6) {
      // Faza 2: Skręcanie w stronę ucieczki
      this.collisionRecoveryPhase = 'turning';
      this.aiControl.up = false;
      this.aiControl.down = false;
      
      const angleDiff = Phaser.Math.Angle.Wrap(this.recoveryDirection - this.carAngle);
      this.aiControl.left = angleDiff < 0;
      this.aiControl.right = angleDiff > 0;
      
    } else {
      // Faza 3: Przyspieszanie w nowym kierunku
      this.collisionRecoveryPhase = 'accelerating';
      this.aiControl.up = true;
      this.aiControl.down = false;
      
      // Delikatne korygowanie kierunku w stronę najbliższego waypointa
      const nextWp = this.waypoints[(this.currentWaypointIndex + 1) % this.waypoints.length];
      const targetAngle = Phaser.Math.Angle.Between(this.carX, this.carY, nextWp.x, nextWp.y);
      const angleDiff = Phaser.Math.Angle.Wrap(targetAngle - this.carAngle);
      
      if (Math.abs(angleDiff) > Phaser.Math.DegToRad(10)) {
        this.aiControl.left = angleDiff < 0;
        this.aiControl.right = angleDiff > 0;
      } else {
        this.aiControl.left = false;
        this.aiControl.right = false;
      }
    }
  }
}