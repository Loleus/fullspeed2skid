// AICar.js
import { Car } from "./car.js";
import { carConfig } from "./carConfig.js";

export class AICar extends Car {
  constructor(scene, carSprite, worldData, waypoints) {
    super(scene, carSprite, worldData);

    // trasa i waypointy
    this.waypoints            = waypoints;
    this.currentWaypointIndex = 0;
    this.reachedThreshold     = 15;

    // Pure Pursuit – parametry
    this.lookAheadDistance = 5;     // początkowa odległość look-ahead
    this.minLookAhead      = 5;
    this.maxLookAhead      = 8;
    this.curvatureGain     = 1.0;
    this.alphaDeadzone     = Phaser.Math.DegToRad(3); // Delikatnie zwiększono martwą strefę dla alpha

    // sterowanie
    this.steerSmoothFactor = 0.4; // Zmniejszono współczynnik wygładzania sterowania dla AI, aby szybciej reagował
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
    let bestLookAheadPoint = null;
    let minDistanceToLookAheadTarget = Infinity;

    // Szukaj punktu docelowego od bieżącego waypointa
    for (let i = 0; i < this.waypoints.length; i++) {
        const idx = (this.currentWaypointIndex + i) % this.waypoints.length;
        const wp = this.waypoints[idx];

        const d = Phaser.Math.Distance.Between(px, py, wp.x, wp.y);
        const angToWP = Phaser.Math.Angle.Between(px, py, wp.x, wp.y);
        const alphaFromCar = Phaser.Math.Angle.Wrap(angToWP - this.carAngle);

        // Warunek: punkt musi być mniej więcej przed samochodem (w zakresie +/- 90 stopni od kierunku jazdy)
        if (Math.abs(alphaFromCar) < Math.PI / 2) {
            // Szukamy punktu, który jest co najmniej this.lookAheadDistance odległy,
            // ale jeśli takiego nie ma, to bierzemy najbliższy w tym przedziale.
            if (d >= this.lookAheadDistance) {
                lookPoint = wp;
                break; // Znaleziono dobry punkt, wybierz go i zakończ pętlę
            }

            // Jeśli nie znaleziono punktu >= lookAheadDistance, śledź najbliższy do lookAheadDistance
            const distanceToTarget = Math.abs(d - this.lookAheadDistance);
            if (distanceToTarget < minDistanceToLookAheadTarget) {
                minDistanceToLookAheadTarget = distanceToTarget;
                bestLookAheadPoint = wp;
            }
        }
    }

    // Jeśli nie znaleziono punktu >= lookAheadDistance, użyj najbliższego znalezionego
    if (!lookPoint && bestLookAheadPoint) {
        lookPoint = bestLookAheadPoint;
    }

    // Fallback: Jeśli nadal brak lookPoint (np. wszystkie waypointy za nami lub za blisko)
    // W takim przypadku, celuj w następny waypoint w sekwencji, ale tylko jeśli jest on przed samochodem.
    if (!lookPoint) {
        let nextWaypoint = this.waypoints[(this.currentWaypointIndex + 1) % this.waypoints.length];
        const angToFallbackWP = Phaser.Math.Angle.Between(px, py, nextWaypoint.x, nextWaypoint.y);
        const alphaToFallbackWP = Phaser.Math.Angle.Wrap(angToFallbackWP - this.carAngle);
        if (Math.abs(alphaToFallbackWP) < Math.PI / 2) { // Jeśli następny punkt jest przed autem
            lookPoint = nextWaypoint;
        } else {
            // Ostateczny fallback: użyj obecnego waypointa, aby uniknąć null
            lookPoint = this.waypoints[this.currentWaypointIndex];
        }
    }

    // Upewnij się, że lookPoint nie jest null (jeśli tablica waypointów jest pusta)
    if (!lookPoint) {
        console.error("AICar: Nie znaleziono prawidłowego lookPoint. Samochód AI nie może sterować.");
        return; // Zakończ aktualizację, jeśli nie ma celu
    }


    // 2) przełącz waypoint gdy jesteśmy blisko bieżącego
    // To zapewnia, że currentWaypointIndex jest aktualizowany.
    const currentWP = this.waypoints[this.currentWaypointIndex];
    if (Phaser.Math.Distance.Between(px, py, currentWP.x, currentWP.y) < this.reachedThreshold) {
        this.currentWaypointIndex = (this.currentWaypointIndex + 1) % this.waypoints.length;
    }

    // 3) obliczenie błędu kątowego (alpha)
    const targetAngle = Phaser.Math.Angle.Between(px, py, lookPoint.x, lookPoint.y);
    const heading     = this.carAngle;
    const alpha       = Phaser.Math.Angle.Wrap(targetAngle - heading);

    // 4) obliczenie krzywizny łuku
    const curvature = (2 * Math.sin(alpha)) / this.lookAheadDistance;

    // 5) sygnał sterowania
    let rawSteer = curvature * this.curvatureGain;
    rawSteer = Phaser.Math.Clamp(rawSteer, -1, 1);

    // 6) wygładzanie sterowania
    // Jeśli auto jest niemal prosto (w martwej strefie kąta), agresywnie prostuj kierownicę.
    if (Math.abs(alpha) < this.alphaDeadzone) {
        // Stopniowo redukuj steerInput do zera
        this.steerInput *= 0.8; // Szybkie tłumienie
        if (Math.abs(this.steerInput) < 0.01) { // Całkowicie zeruj, jeśli bardzo blisko zera
            this.steerInput = 0;
        }
    } else {
        // W przeciwnym razie, zastosuj standardowe wygładzanie
        this.steerInput =
          this.steerInput * this.steerSmoothFactor +
          rawSteer * (1 - this.steerSmoothFactor);
    }

    // 7) throttle zależny od kąta alpha
    let throttle = this.maxThrottle * (1 - Math.abs(alpha) / Math.PI);
    throttle     = Phaser.Math.Clamp(throttle, this.minThrottle, this.maxThrottle);

    // AI emuluje "zwolnienie" inputu gazu/hamulca, aby zwolnić throttleLock po kolizji.
    // Dzieje się to, gdy minie immunitet i samochód nie jest już w kolizji.
    if (this.throttleLock && this.collisionImmunity <= 0 && !this.checkEllipseCollision() && !this.checkWorldEdgeCollision(worldW, worldH)) {
      // Symuluj brak inputu gazu/hamulca. WAŻNE: Nie przekazuj inputów sterowania,
      // ponieważ AI ma własną logikę sterowania.
      this.updateInput({ up: false, down: false });
    }

    // 8) update fizyki
    this.updatePhysics(
      dt,
      this.steerInput,
      throttle,
      this.worldData.getSurfaceTypeAt(px, py)
    );

    // 9) obsługa kolizji (logika dziedziczona z Car.js)
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
    console.log(
      "WP idx:", this.currentWaypointIndex,
      "alpha:", alpha.toFixed(2),
      "lookDist:", this.lookAheadDistance.toFixed(0),
      "steer:", this.steerInput.toFixed(2),
      "thr:", throttle.toFixed(2),
      "lookPoint:", lookPoint ? `(${lookPoint.x.toFixed(2)}, ${lookPoint.y.toFixed(2)})` : "N/A"
    );
  }
}
