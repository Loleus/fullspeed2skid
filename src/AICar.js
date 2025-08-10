// // AICar.js
// import { Car } from "./car.js";
// import { carConfig } from "./carConfig.js";

// export class AICar extends Car {
//   constructor(scene, carSprite, worldData, waypoints) {
//     super(scene, carSprite, worldData);

//     // trasa i waypointy
//     this.waypoints            = waypoints;
//     this.currentWaypointIndex = 0;
//     this.reachedThreshold     = 1;

//     // Pure Pursuit – parametry bazowe
//     this.minLookAhead      = 1;
//     this.maxLookAhead      = 20;
//     this.lookAheadDistance = this.minLookAhead;
//     this.baseCurvatureGain = 10.0;         // podstawa, potem adaptujemy
//     this.alphaDeadzone     = Phaser.Math.DegToRad(4);

//     // sterowanie
//     this.baseSteerSmooth = 0.1;           // mniej tłumi przy ostrych manewrach
//     this.maxSteerRad     = Phaser.Math.DegToRad(carConfig.MAX_STEER_DEG);
//     this.steerInput      = 0;

//     // throttling
//     this.minThrottle = 0.1;
//     this.maxThrottle = 0.2;
//   }

//   updateAI(dt, worldW, worldH) {
//     const px = this.carX;
//     const py = this.carY;

//     // 0) DYNAMIC LOOK-AHEAD: zmniejsz przy ostrym skręcie
//     const speedFactor = this.carSpeed != null ? this.carSpeed : 0;
//     let lookAhead = Phaser.Math.Clamp(speedFactor * 1.2, this.minLookAhead, this.maxLookAhead);

//     // weź kąt do aktualnego point, jeśli ostry, skróć lookAhead
//     {
//       const wp = this.waypoints[this.currentWaypointIndex];
//       const angToWP = Phaser.Math.Angle.Between(px, py, wp.x, wp.y);
//       const alphaWP = Math.abs(Phaser.Math.Angle.Wrap(angToWP - this.carAngle));
//       if (alphaWP > Phaser.Math.DegToRad(20)) {
//         lookAhead = Math.max(this.minLookAhead, lookAhead * 0.6);
//       }
//     }
//     this.lookAheadDistance = lookAhead;

//     // 1) WYBÓR lookPoint (pomijamy offset=0)
//     let lookPoint = null;
//     let bestDelta = Infinity;
//     let bestWP    = null;

//     for (let off = 1; off < this.waypoints.length; off++) {
//       const idx   = (this.currentWaypointIndex + off) % this.waypoints.length;
//       const wp    = this.waypoints[idx];
//       const dx    = wp.x - px;
//       const dy    = wp.y - py;
//       const d     = Math.hypot(dx, dy);
//       const ang   = Math.atan2(dy, dx);
//       const alpha = Phaser.Math.Angle.Wrap(ang - this.carAngle);

//       if (Math.abs(alpha) > Math.PI/2) continue;

//       if (d >= lookAhead) {
//         lookPoint = wp;
//         break;
//       }
//       const delta = Math.abs(d - lookAhead);
//       if (delta < bestDelta) {
//         bestDelta = delta;
//         bestWP    = wp;
//       }
//     }
//     lookPoint = lookPoint || bestWP || this.waypoints[this.currentWaypointIndex];

//     // 2) PROSTE przełączanie, gdy minąłem segment (proj > 0)
//     {
//       const cur  = this.waypoints[this.currentWaypointIndex];
//       const next = this.waypoints[(this.currentWaypointIndex + 1) % this.waypoints.length];
//       const vx   = next.x - cur.x;
//       const vy   = next.y - cur.y;
//       const wx   = px      - cur.x;
//       const wy   = py      - cur.y;
//       const proj = (vx*wx + vy*wy)/(vx*vx + vy*vy);
//       if (proj > 0) {
//         this.currentWaypointIndex = (this.currentWaypointIndex + 1) % this.waypoints.length;
//       }
//     }

//     // 3) OBLICZENIE alpha i curvature
//     const targetAng = Phaser.Math.Angle.Between(px, py, lookPoint.x, lookPoint.y);
//     const alpha     = Phaser.Math.Angle.Wrap(targetAng - this.carAngle);
//     const curvature = (2 * Math.sin(alpha)) / lookAhead;

//     // dynamiczne wzmocnienie gainu przy ostrym skręcie
//     const cgain     = this.baseCurvatureGain * (1 + Math.min(Math.abs(alpha), Math.PI/2)/ (Math.PI/2));

//     // 4) RAW STEER
//     let rawSteer   = Phaser.Math.Clamp(curvature * cgain, -1, 1);

//     // 5) ADAPTACYJNE wygładzanie + natychmiast przy zmianie znaku
//     const steerSmooth = this.baseSteerSmooth * (1 - Math.min(Math.abs(alpha)/Math.PI, 0.7));
//     if (Math.sign(rawSteer) !== Math.sign(this.steerInput)) {
//       this.steerInput = rawSteer;
//     } else if (Math.abs(alpha) < this.alphaDeadzone) {
//       this.steerInput *= 0.4;
//       if (Math.abs(this.steerInput) < 0.01) this.steerInput = 0;
//     } else {
//       this.steerInput = Phaser.Math.Clamp(
//         this.steerInput * steerSmooth + rawSteer * (1 - steerSmooth),
//         -1, 1
//       );
//     }

//     // ostateczne ograniczenie w radianach
//     const steerRad = Phaser.Math.Clamp(
//       this.steerInput * this.maxSteerRad,
//       -this.maxSteerRad,
//       this.maxSteerRad
//     );

//     // 6) BRAKING CURVE: im ostrzejszy skręt, tym mniejszy throttle
//     let throttle = this.maxThrottle * Math.cos(Math.min(Math.abs(alpha), Math.PI/2));
//     throttle     = Phaser.Math.Clamp(throttle, this.minThrottle, this.maxThrottle);

//     // 7) emulacja zwolnienia po kolizji
//     if (this.throttleLock
//         && this.collisionImmunity <= 0
//         && !this.checkEllipseCollision()
//         && !this.checkWorldEdgeCollision(worldW, worldH)) {
//       this.updateInput({ up: false, down: false });
//     }

//     // 8) update fizyki
//     this.updatePhysics(
//       dt,
//       steerRad,
//       throttle,
//       this.worldData.getSurfaceTypeAt(px, py)
//     );

//     // 9) obsługa kolizji
//     if (this.collisionImmunity > 0) {
//       this.collisionImmunity = Math.max(0, this.collisionImmunity - dt);
//     } else if (this.checkEllipseCollision() || this.checkWorldEdgeCollision(worldW, worldH)) {
//       this.handleCollision(px, py, worldW, worldH);
//     }

//     // Debug wizualny
//     console.log(
//       `WP:${this.currentWaypointIndex}`,
//       `α:${alpha.toFixed(2)}`,
//       `LAD:${lookAhead.toFixed(1)}`,
//       `steer:${(this.steerInput).toFixed(2)}`,
//       `thr:${throttle.toFixed(2)}`
//     );
//   }
// }






// // src/AICar.js
// import { Car } from "./car.js";
// import { carConfig } from "./carConfig.js";

// export class AICar extends Car {
//   constructor(scene, carSprite, worldData, waypoints) {
//     super(scene, carSprite, worldData);

//     this.waypoints         = waypoints;
//     this.curIdx            = 0;
//     this.minLA             = 1.5;
//     this.maxLA             = 18;
//     this.baseCurvatureGain = 12.0;      // mocniejsze sterowanie
//     this.steerRateLimit    = 0.08;      // szybsze zmiany sterowania
//     this.alphaDeadzone     = Phaser.Math.DegToRad(4);
//     this.minThrottle       = 0.15;
//     this.maxThrottle       = 0.35;
//     this.steerSmooth       = 0.2;       // mniej wygładza, więcej reakcji
//     this.steerInput        = 0;
//   }

//   updateAI(dt, worldW, worldH) {
//     const px    = this.carX;
//     const py    = this.carY;
//     const theta = this.carAngle;
//     const v     = this.carSpeed || 0;
//     const n     = this.waypoints.length;
//     const idx   = this.curIdx;

//     // 1) Obliczmy kąty kolejnych dwóch segmentów (A→B i B→C)
//     const A       = this.waypoints[idx];
//     const B       = this.waypoints[(idx + 1) % n];
//     const C       = this.waypoints[(idx + 2) % n];
//     const angAB   = Phaser.Math.Angle.Between(A.x, A.y, B.x, B.y);
//     const angBC   = Phaser.Math.Angle.Between(B.x, B.y, C.x, C.y);
//     const turnDiff= Math.abs(Phaser.Math.Angle.Wrap(angBC - angAB));

//     // 2) dynamiczny look-ahead
//     let lookAhead = Phaser.Math.Clamp(v * 1.0 + this.minLA, this.minLA, this.maxLA);
//     // jeśli nadchodzi ostry zakręt, zwiększ look-ahead, by wejść w łuk wcześniej
//     if (turnDiff > Phaser.Math.DegToRad(20)) {
//       lookAhead = this.maxLA;
//     }

//     // 3) wybór lookPoint
//     let lookPoint = null;
//     for (let off = 1; off < n; off++) {
//       const wp = this.waypoints[(idx + off) % n];
//       if (Phaser.Math.Distance.Between(px, py, wp.x, wp.y) >= lookAhead) {
//         lookPoint = wp;
//         break;
//       }
//     }
//     if (!lookPoint) lookPoint = B;

//     // 4) przełączenie bieżącego segmentu
//     if (this._proj(px, py, A, B) > 1) {
//       this.curIdx = (idx + 1) % n;
//     }

//     // 5) pure-pursuit – kąt do lookPoint
//     const targetAng = Phaser.Math.Angle.Between(px, py, lookPoint.x, lookPoint.y);
//     const alpha     = Phaser.Math.Angle.Wrap(targetAng - theta);

//     // 6) curvature + feed-forward na nadchodzący zakręt
//     const curvature = (2 * Math.sin(alpha)) / lookAhead;
//     // wzmocnienie proporcjonalne do kąta zakrętu (maksymalnie x1.5)
//     const ffGain    = 1 + Math.min(turnDiff / Phaser.Math.DegToRad(90), 1) * 0.5;
//     const rawSteer  = Phaser.Math.Clamp(
//       curvature * this.baseCurvatureGain * ffGain,
//       -1, 1
//     );

//     // 7) rate limiter + deadzone + mniejsze wygładzanie
//     if (Math.abs(alpha) < this.alphaDeadzone) {
//       this.steerInput = 0;
//     } else {
//       let delta = rawSteer - this.steerInput;
//       delta = Phaser.Math.Clamp(delta, -this.steerRateLimit, this.steerRateLimit);
//       // minimalne wygładzenie – postaw na szybką reakcję
//       this.steerInput += delta * (1 - this.steerSmooth);
//     }

//     const steerRad = this.steerInput * Phaser.Math.DegToRad(carConfig.MAX_STEER_DEG);

//     // 8) throttle – więcej gazu przy małych kątach, hamowanie przy ostrych
//     const turnNorm = Phaser.Math.Clamp(Math.abs(this.steerInput), 0, 1);
//     let throttle   = Phaser.Math.Linear(
//       this.maxThrottle,
//       this.minThrottle,
//       Math.pow(turnNorm, 1.2)
//     );

//     // jeśli jedziemy bardzo wolno i zbliża się ostry zakręt – utrzymaj prędkość
//     if (v < 2 && turnDiff > Phaser.Math.DegToRad(15)) {
//       throttle = this.maxThrottle;
//     }

//     // 9) emulacja kolizji
//     if (this.throttleLock
//         && this.collisionImmunity <= 0
//         && !this.checkEllipseCollision()
//         && !this.checkWorldEdgeCollision(worldW, worldH)) {
//       this.updateInput({ up: false, down: false });
//     }

//     // 10) update fizyki
//     this.updatePhysics(
//       dt,
//       steerRad,
//       throttle,
//       this.worldData.getSurfaceTypeAt(px, py)
//     );

//     // 11) obsługa kolizji
//     if (this.collisionImmunity > 0) {
//       this.collisionImmunity = Math.max(0, this.collisionImmunity - dt);
//     } else if (this.checkEllipseCollision() || this.checkWorldEdgeCollision(worldW, worldH)) {
//       this.handleCollision(px, py, worldW, worldH);
//     }
//   }

//   // pomocnicza projekcja na odcinek AB
//   _proj(px, py, A, B) {
//     const vx = B.x - A.x, vy = B.y - A.y;
//     const wx = px - A.x,   wy = py - A.y;
//     return (vx * wx + vy * wy) / (vx*vx + vy*vy);
//   }
// }










// src/AICar.js
// import { Car } from "./car.js";
// import { carConfig } from "./carConfig.js";

// export class AICar extends Car {
//   constructor(scene, carSprite, worldData, waypoints) {
//     super(scene, carSprite, worldData);

//     this.waypoints            = waypoints;
//     this.curIdx               = 0;
//     this.reachedThreshold     = 1;

//     // Pure Pursuit – podbite parametry pod ostrzejsze i wcześniejsze skręty
//     this.minLookAhead         = 1;
//     this.maxLookAhead         = 25;           // patrzymy dalej przy ostrych łukach
//     this.baseCurvatureGain    = 15.0;         // mocniejszy gain
//     this.alphaDeadzone        = Phaser.Math.DegToRad(5);

//     // sterowanie
//     this.steerRateLimit       = 0.12;         // szybciej zmienia kierunek
//     this.steerSmooth          = 0.1;          // minimalne wygładzanie
//     this.steerInput           = 0;

//     // throttling
//     this.minThrottle          = 0.1;
//     this.maxThrottle          = 0.3;
//   }

//   updateAI(dt, worldW, worldH) {
//     const px    = this.carX;
//     const py    = this.carY;
//     const theta = this.carAngle;
//     const v     = this.carSpeed || 0;
//     const n     = this.waypoints.length;
//     const idx   = this.curIdx;

//     // 1) Oblicz kąt nadchodzącego zakrętu (między segmentami AB i BC)
//     const A      = this.waypoints[idx];
//     const B      = this.waypoints[(idx + 1) % n];
//     const C      = this.waypoints[(idx + 2) % n];
//     const angAB  = Phaser.Math.Angle.Between(A.x, A.y, B.x, B.y);
//     const angBC  = Phaser.Math.Angle.Between(B.x, B.y, C.x, C.y);
//     const turnDiff = Math.abs(Phaser.Math.Angle.Wrap(angBC - angAB));

//     // 2) dynamiczny look-ahead – dalej patrzymy przy ostrym zakręcie
//     let lookAhead = Phaser.Math.Clamp(v * 1.0 + this.minLookAhead,
//                                       this.minLookAhead,
//                                       this.maxLookAhead);
//     if (turnDiff > Phaser.Math.DegToRad(10)) {
//       lookAhead = this.maxLookAhead;
//     }
//     this.lookAheadDistance = lookAhead;

//     // 3) wybór lookPoint
//     let lookPoint = null;
//     for (let off = 1; off < n; off++) {
//       const wp = this.waypoints[(idx + off) % n];
//       const d  = Phaser.Math.Distance.Between(px, py, wp.x, wp.y);
//       if (d >= lookAhead) {
//         lookPoint = wp;
//         break;
//       }
//     }
//     if (!lookPoint) lookPoint = B;

//     // 4) przełączenie segmentu, gdy minęliśmy AB
//     if (this._proj(px, py, A, B) > this.reachedThreshold) {
//       this.curIdx = (idx + 1) % n;
//     }

//     // 5) pure pursuit – błąd kątowy
//     const targetAng = Phaser.Math.Angle.Between(px, py, lookPoint.x, lookPoint.y);
//     const alpha     = Phaser.Math.Angle.Wrap(targetAng - theta);

//     // 6) curvature + feed-forward
//     const curvature = (2 * Math.sin(alpha)) / lookAhead;
//     // ffGain: do x1.0 dodatkowo, proporcjonalnie do kąta zakrętu
//     const ffGain    = 1 + Math.min(turnDiff / (Math.PI/2), 1.0);
//     const rawSteer  = Phaser.Math.Clamp(curvature * this.baseCurvatureGain * ffGain,
//                                          -1, 1);

//     // 7) rate-limit + minimalne wygładzanie + deadzone
//     if (Math.abs(alpha) < this.alphaDeadzone) {
//       this.steerInput = 0;
//     } else {
//       let delta = rawSteer - this.steerInput;
//       delta     = Phaser.Math.Clamp(delta, -this.steerRateLimit, this.steerRateLimit);
//       // minimalne wygładzenie: stawiamy na szybką reakcję
//       this.steerInput += delta * (1 - this.steerSmooth);
//     }

//     const steerRad = this.steerInput * Phaser.Math.DegToRad(carConfig.MAX_STEER_DEG);

//     // 8) throttle – pełny gaz przy małym sterowaniu, hamujemy przy ostrych
//     const tNorm    = Math.pow(Math.abs(this.steerInput), 1.2);
//     let throttle   = Phaser.Math.Linear(this.maxThrottle,
//                                         this.minThrottle,
//                                         tNorm);
//     // jeśli jedziemy wolno (<2) i zbliża się ostry zakręt (>15°) – podtrzymaj gaz
//     if (v < 2 && turnDiff > Phaser.Math.DegToRad(15)) {
//       throttle = this.maxThrottle;
//     }

//     // 9) emulacja kolizji (Twoja oryginalna logika)
//     if (this.throttleLock
//         && this.collisionImmunity <= 0
//         && !this.checkEllipseCollision()
//         && !this.checkWorldEdgeCollision(worldW, worldH)) {
//       this.updateInput({ up: false, down: false });
//     }

//     // 10) update fizyki i kolizji
//     this.updatePhysics(
//       dt,
//       steerRad,
//       throttle,
//       this.worldData.getSurfaceTypeAt(px, py)
//     );
//     if (this.collisionImmunity > 0) {
//       this.collisionImmunity = Math.max(0, this.collisionImmunity - dt);
//     } else if (
//       this.checkEllipseCollision() ||
//       this.checkWorldEdgeCollision(worldW, worldH)
//     ) {
//       this.handleCollision(px, py, worldW, worldH);
//     }
//   }

//   /** Projekcja punktu (px,py) na odcinek AB – wartość >1 → minęliśmy AB */
//   _proj(px, py, A, B) {
//     const vx = B.x - A.x, vy = B.y - A.y;
//     const wx = px - A.x,   wy = py - A.y;
//     return (vx * wx + vy * wy) / (vx*vx + vy*vy);
//   }
// }










// src/AICar.js
// import { Car } from "./car.js";
// import { carConfig } from "./carConfig.js";

// export class AICar extends Car {
//   constructor(scene, carSprite, worldData, waypoints) {
//     super(scene, carSprite, worldData);

//     this.waypoints        = waypoints;
//     this.curIdx           = 0;
//     this.reachedThreshold = 0.5;

//     // Pure Pursuit – hardcoded, bo nie masz tych pól w carConfig
//     this.minLookAhead      = 10;
//     this.maxLookAhead      = 25;
//     this.baseCurvatureGain = 7.0;

//     // deadzone w radianach – bierze threshold z configu
//     this.alphaDeadzone     = Phaser.Math.DegToRad(carConfig.steerInputThreshold);

//     // sterowanie
//     this.steerRateLimit    = Phaser.Math.DegToRad(carConfig.STEER_SPEED_DEG);
//     this.steerSmooth       = carConfig.steerSmoothFactor;
//     this.steerInput        = 0;

//     // throttling – zostawione na sztywno, bo w configu nie masz MIN/MAX throttle
//     this.minThrottle       = 0.1;
//     this.maxThrottle       = 0.3;
//   }

//   updateAI(dt, worldW, worldH) {
//     const px    = this.carX;
//     const py    = this.carY;
//     const theta = this.carAngle;
//     const v     = this.carSpeed || 0;
//     const n     = this.waypoints.length;
//     const idx   = this.curIdx;

//     // 1) kąt nadchodzącego zakrętu
//     const A       = this.waypoints[idx];
//     const B       = this.waypoints[(idx + 1) % n];
//     const C       = this.waypoints[(idx + 2) % n];
//     const angAB   = Phaser.Math.Angle.Between(A.x, A.y, B.x, B.y);
//     const angBC   = Phaser.Math.Angle.Between(B.x, B.y, C.x, C.y);
//     const turnDiff= Math.abs(Phaser.Math.Angle.Wrap(angBC - angAB));

//     // 2) dynamiczny look-ahead
//     let lookAhead = Phaser.Math.Clamp(
//       v * 1.0 + this.minLookAhead,
//       this.minLookAhead,
//       this.maxLookAhead
//     );
//     if (turnDiff > Phaser.Math.DegToRad(10)) {
//       lookAhead = this.maxLookAhead;
//     }

//     // 3) wybór lookPoint
//     let lookPoint = null;
//     for (let off = 1; off < n; off++) {
//       const wp = this.waypoints[(idx + off) % n];
//       const d  = Phaser.Math.Distance.Between(px, py, wp.x, wp.y);
//       if (d >= lookAhead) {
//         lookPoint = wp;
//         break;
//       }
//     }
//     if (!lookPoint) lookPoint = B;

//     // 4) przejście segmentu
//     if (this._proj(px, py, A, B) > this.reachedThreshold) {
//       this.curIdx = (idx + 1) % n;
//     }

//     // 5) błąd kątowy
//     const targetAng = Phaser.Math.Angle.Between(px, py, lookPoint.x, lookPoint.y);
//     const alpha     = Phaser.Math.Angle.Wrap(targetAng - theta);

//     // 6) curvature + feed-forward
//     const curvature = (2 * Math.sin(alpha)) / lookAhead;
//     const ffGain    = 1 + Math.min(turnDiff / (Math.PI / 2), 1);
//     const rawSteer  = Phaser.Math.Clamp(
//       curvature * this.baseCurvatureGain * ffGain,
//       -1, 1
//     );

//     // 7) deadzone + rate-limit + wygładzanie
//     if (Math.abs(alpha) < this.alphaDeadzone) {
//       this.steerInput = 0;
//     } else {
//       let delta = rawSteer - this.steerInput;
//       delta     = Phaser.Math.Clamp(
//         delta,
//         -this.steerRateLimit,
//         this.steerRateLimit
//       );
//       this.steerInput += delta * (1 - this.steerSmooth);
//     }

//     const steerRad = this.steerInput * Phaser.Math.DegToRad(carConfig.MAX_STEER_DEG);

//     // 8) throttle
//     const tNorm  = Math.pow(Math.abs(this.steerInput), 1.2);
//     let throttle = Phaser.Math.Linear(
//       this.maxThrottle,
//       this.minThrottle,
//       tNorm
//     );
//     if (v < 2 && turnDiff > Phaser.Math.DegToRad(15)) {
//       throttle = this.maxThrottle;
//     }

//     // 9) kolizje & fizyka
//     if (
//       this.throttleLock &&
//       this.collisionImmunity <= 0 &&
//       !this.checkEllipseCollision() &&
//       !this.checkWorldEdgeCollision(worldW, worldH)
//     ) {
//       this.updateInput({ up: false, down: false });
//     }

//     this.updatePhysics(
//       dt,
//       steerRad,
//       throttle,
//       this.worldData.getSurfaceTypeAt(px, py)
//     );

//     if (this.collisionImmunity > 0) {
//       this.collisionImmunity = Math.max(0, this.collisionImmunity - dt);
//     } else if (
//       this.checkEllipseCollision() ||
//       this.checkWorldEdgeCollision(worldW, worldH)
//     ) {
//       this.handleCollision(px, py, worldW, worldH);
//     }
//   }

//   _proj(px, py, A, B) {
//     const vx = B.x - A.x, vy = B.y - A.y;
//     const wx = px  - A.x, wy = py  - A.y;
//     return (vx * wx + vy * wy) / (vx*vx + vy*vy);
//   }
// }






// src/AICar.js
// import { Car } from "./car.js";
// import { carConfig } from "./carConfig.js";

// export class AICar extends Car {
//   constructor(scene, carSprite, worldData, waypoints) {
//     super(scene, carSprite, worldData);

//     // waypointy i trasa
//     this.waypoints            = waypoints;
//     this.currentWaypointIndex = 0;
//     this.reachedThreshold     = 0.2;

//     // parametry Pure Pursuit
//     this.minLookAhead      = 1;
//     this.maxLookAhead      = 20;
//     this.lookAheadDistance = this.minLookAhead;
//     this.baseCurvatureGain = 6;

//     // deadzone i smoothing z configu
//     this.alphaDeadzone      = Phaser.Math.DegToRad(carConfig.steerInputThreshold * 180);
//     this.baseSteerSmooth    = carConfig.steerSmoothFactor;

//     // sterowanie
//     this.maxSteerRad         = Phaser.Math.DegToRad(carConfig.MAX_STEER_DEG);
//     this.steerRateLimit      = Phaser.Math.DegToRad(carConfig.STEER_SPEED_DEG);
//     this.steerReturnSpeedRad = Phaser.Math.DegToRad(carConfig.STEER_RETURN_SPEED_DEG);
//     this.steerInput          = 0;

//     // throttle
//     this.minThrottle         = 0.1;
//     this.maxThrottle         = 0.3;
//   }

//   updateAI(dt, worldW, worldH) {
//     const px = this.carX;
//     const py = this.carY;
//     const v  = this.carSpeed || 0;

//     // dynamiczne look-ahead
//     this.lookAheadDistance = Phaser.Math.Clamp(
//       v * 1.2,
//       this.minLookAhead,
//       this.maxLookAhead
//     );

//     // wybór punktu lookPoint
//     let lookPoint = null;
//     let bestDelta = Infinity;
//     let bestWP    = null;
//     for (let off = 1; off < this.waypoints.length; off++) {
//       const idx = (this.currentWaypointIndex + off) % this.waypoints.length;
//       const wp  = this.waypoints[idx];
//       const dx  = wp.x - px;
//       const dy  = wp.y - py;

//       // tu poprawka: używamy Math.sqrt zamiast Phaser.Math.Sqrt
//       const d   = Math.sqrt(dx * dx + dy * dy);

//       const ang = Phaser.Math.Angle.Between(px, py, wp.x, wp.y);
//       const rel = Phaser.Math.Angle.Wrap(ang - this.carAngle);

//       if (Math.abs(rel) > Math.PI / 2) continue;
//       if (d >= this.lookAheadDistance) {
//         lookPoint = wp;
//         break;
//       }

//       const delta = Math.abs(d - this.lookAheadDistance);
//       if (delta < bestDelta) {
//         bestDelta = delta;
//         bestWP    = wp;
//       }
//     }
//     lookPoint = lookPoint || bestWP || this.waypoints[this.currentWaypointIndex];

//     // przełączenie segmentu
//     {
//       const cur  = this.waypoints[this.currentWaypointIndex];
//       const next = this.waypoints[(this.currentWaypointIndex + 1) % this.waypoints.length];
//       const vx   = next.x - cur.x;
//       const vy   = next.y - cur.y;
//       const wx   = px    - cur.x;
//       const wy   = py    - cur.y;
//       const proj = (vx * wx + vy * wy) / (vx * vx + vy * vy);
//       if (proj > this.reachedThreshold) {
//         this.currentWaypointIndex =
//           (this.currentWaypointIndex + 1) % this.waypoints.length;
//       }
//     }

//     // feed-forward na nadchodzący zakręt
//     const i0       = this.currentWaypointIndex;
//     const i1       = (i0 + 1) % this.waypoints.length;
//     const i2       = (i0 + 2) % this.waypoints.length;
//     const ang1     = Phaser.Math.Angle.Between(
//                       this.waypoints[i0].x, this.waypoints[i0].y,
//                       this.waypoints[i1].x, this.waypoints[i1].y
//                     );
//     const ang2     = Phaser.Math.Angle.Between(
//                       this.waypoints[i1].x, this.waypoints[i1].y,
//                       this.waypoints[i2].x, this.waypoints[i2].y
//                     );
//     const turnDiff = Math.abs(Phaser.Math.Angle.Wrap(ang2 - ang1));
//     const ffGain   = 1 + Math.min(turnDiff / (Math.PI / 2), 1) * 0.5;

//     // obliczenie curvature i rawSteer
//     const targetAng = Phaser.Math.Angle.Between(px, py, lookPoint.x, lookPoint.y);
//     const alpha     = Phaser.Math.Angle.Wrap(targetAng - this.carAngle);
//     const curvature = (2 * Math.sin(alpha)) / this.lookAheadDistance;
//     let rawSteer    = Phaser.Math.Clamp(
//                         curvature * this.baseCurvatureGain * ffGain,
//                         -1,
//                         1
//                       );

//     // rate limiting zmiany układu sterowania
//     const maxDelta = this.steerRateLimit * dt;
//     let delta       = rawSteer - this.steerInput;
//     delta           = Phaser.Math.Clamp(delta, -maxDelta, maxDelta);
//     this.steerInput += delta;

//     // płynny powrót kierownicy w deadzone
//     if (Math.abs(alpha) < this.alphaDeadzone) {
//       const retDelta = this.steerReturnSpeedRad * dt;
//       if (Math.abs(this.steerInput) <= retDelta) {
//         this.steerInput = 0;
//       } else {
//         this.steerInput -= Math.sign(this.steerInput) * retDelta;
//       }
//     }

//     // konwersja na radiany
//     const steerRad = Phaser.Math.Clamp(
//       this.steerInput * this.maxSteerRad,
//       -this.maxSteerRad,
//       this.maxSteerRad
//     );

//     // throttle z interpolacją liniową
//     let throttle = this.maxThrottle
//       - (Math.min(Math.abs(alpha) / Math.PI, 1) * (this.maxThrottle - this.minThrottle));
//     throttle     = Phaser.Math.Clamp(throttle, this.minThrottle, this.maxThrottle);

//     // kolizje i fizyka
//     if (
//       this.throttleLock &&
//       this.collisionImmunity <= 0 &&
//       !this.checkEllipseCollision() &&
//       !this.checkWorldEdgeCollision(worldW, worldH)
//     ) {
//       this.updateInput({ up: false, down: false });
//     }

//     this.updatePhysics(
//       dt,
//       steerRad,
//       throttle,
//       this.worldData.getSurfaceTypeAt(px, py)
//     );

//     if (this.collisionImmunity > 0) {
//       this.collisionImmunity = Math.max(0, this.collisionImmunity - dt);
//     } else if (
//       this.checkEllipseCollision() ||
//       this.checkWorldEdgeCollision(worldW, worldH)
//     ) {
//       this.handleCollision(px, py, worldW, worldH);
//     }

//     // debug
//     console.log(
//       "WP idx:", this.currentWaypointIndex,
//       "α:", alpha.toFixed(2),
//       "turnDiff:", Phaser.Math.RadToDeg(turnDiff).toFixed(0),
//       "steer:", this.steerInput.toFixed(2),
//       "thr:", throttle.toFixed(2)
//     );
//   }
// }



// import { Car } from "./car.js";

// export class AICar extends Car {
//   constructor(scene, carSprite, worldData, waypoints) {
//     super(scene, carSprite, worldData);
//     this.waypoints = waypoints;
//     this.currentWaypointIndex = 0;
    
//     // Parametry sterowania
//     this.waypointZoneRadius = 80; // Większy promień dla łatwiejszego zaliczania
    
//     // Parametry skrętu - bardziej łagodne
//     this.steerP = 0.4; // Zmniejszono z 0.6
//     this.maxSteerInput = 0.2; // Zmniejszono z 0.25
//     this.deadZoneAngle = 0.1; // Zwiększono z 0.08
    
//     // Lookahead system - patrzenie na przyszłe waypoints
//     this.lookaheadDistance = 150; // Jak daleko patrzeć w przód
//     this.lookaheadWaypoints = 3; // Ile waypointów sprawdzać w przód
    
//     // Stan
//     this.steerCommand = 0;
//     this.debugAngle = 0;
    
//     // Wykrywanie utknięcia
//     this.stuckDetector = {
//       lastWaypoint: 0,
//       sameWaypointTime: 0,
//       maxStuckTime: 4.0 // Zwiększono z 3.0
//     };
    
//     // Recovery
//     this.recoveryMode = false;
//     this.recoveryTimer = 0;
    
//     // Debug
//     this.debugTimer = 0;
//     this.debugInterval = 1.0;
//   }

//   updateAI(dt, worldW, worldH) {
//     const state = this.getFullState();
    
//     // Debug
//     this._updateDebug(dt, state);
    
//     // Wykryj utknięcie na tym samym waypoint
//     this._detectStuck(dt);
    
//     // Tryb recovery
//     if (this.recoveryMode) {
//       this.recoveryTimer -= dt;
      
//       if (this.recoveryTimer <= 0) {
//         this.recoveryMode = false;
//         console.log('[AI] Recovery END');
//       } else {
//         // W recovery - cofaj i skręcaj łagodniej
//         const nextWP = this.waypoints[(this.currentWaypointIndex + 1) % this.waypoints.length];
//         const angleToNext = Math.atan2(nextWP.y - this.carY, nextWP.x - this.carX);
//         const angleDiff = this._normalizeAngle(angleToNext - state.carAngle);
        
//         const control = {
//           left: angleDiff < -0.5, // Zwiększono próg
//           right: angleDiff > 0.5,
//           up: false,
//           down: true // Cofaj
//         };
        
//         // Jeśli prędkość prawie zero, spróbuj jechać do przodu
//         if (Math.abs(state.v_x) < 30) {
//           control.up = true;
//           control.down = false;
//         }
        
//         this.update(dt, control, worldW, worldH);
//         return;
//       }
//     }
    
//     // Wykryj poślizg - bardziej agresywne działanie
//     if (Math.abs(state.v_y) > 100 && state.speed > 120) {
//       console.log(`[AI] SLIDE! v_y=${state.v_y.toFixed(0)}`);
//       // Wymuś zwolnienie i stabilizację
//     }

//     // Sprawdź waypoint
//     this._checkCurrentWaypoint();
    
//     // Pobierz cel z lookahead
//     const targetInfo = this._getLookaheadTarget();
    
//     // Odległość i kąt
//     const distToTarget = Math.hypot(
//       targetInfo.x - this.carX,
//       targetInfo.y - this.carY
//     );
    
//     const angleToTarget = Math.atan2(
//       targetInfo.y - this.carY,
//       targetInfo.x - this.carX
//     );
    
//     let angleDiff = this._normalizeAngle(angleToTarget - state.carAngle);
//     this.debugAngle = Phaser.Math.RadToDeg(angleDiff);
    
//     // Oblicz sterowanie - bardziej łagodne
//     let steer = 0;
//     let throttle = 0.4; // Zmniejszono domyślną prędkość
    
//     const absAngleDiff = Math.abs(angleDiff);
    
//     // Łagodniejsza logika sterowania
//     if (absAngleDiff < this.deadZoneAngle) {
//       // Jedź prosto
//       steer = 0;
//       throttle = 0.6;
      
//     } else {
//       // Sterowanie proporcjonalne - bardziej łagodne
//       steer = angleDiff * this.steerP;
      
//       // Ogranicz maksymalne sterowanie
//       steer = Phaser.Math.Clamp(steer, -this.maxSteerInput, this.maxSteerInput);
      
//       // Dostosuj prędkość do kąta skrętu - bardziej konserwatywnie
//       if (absAngleDiff > 1.2) { // > 69 stopni - bardzo ostry
//         throttle = 0.1;
//         steer = Math.sign(angleDiff) * 0.25; // Zmniejszono z 0.35
//       } else if (absAngleDiff > 0.8) { // > 46 stopni
//         throttle = 0.15;
//       } else if (absAngleDiff > 0.4) { // > 23 stopni
//         throttle = 0.25;
//       } else if (absAngleDiff > 0.2) { // > 11 stopni
//         throttle = 0.35;
//       } else {
//         throttle = 0.5;
//       }
//     }
    
//     // Dodatkowe ograniczenia prędkości
//     if (state.speed > 300) {
//       throttle = Math.min(throttle, 0.2);
//     } else if (state.speed > 250) {
//       throttle = Math.min(throttle, 0.3);
//     }
    
//     // Anty-poślizg - bardziej agresywne
//     if (Math.abs(state.v_y) > 60) {
//       throttle *= 0.3; // Zmniejszono z 0.5
//       steer *= 0.6; // Zmniejszono z 0.8
//     }
    
//     // Sprawdź czy następny waypoint wymaga ostrego skrętu
//     const upcomingTurnSharpness = this._getUpcomingTurnSharpness();
//     if (upcomingTurnSharpness > 1.0) { // Ostry zakręt
//       throttle *= 0.7;
//     }
    
//     this.steerCommand = steer;
    
//     // Kontrola
//     const control = {
//       left: steer < -0.01, // Zmniejszono próg
//       right: steer > 0.01,
//       up: throttle > 0,
//       down: false
//     };

//     this.update(dt, control, worldW, worldH);
//   }
  
//   _getLookaheadTarget() {
//     // Sprawdź czy należy patrzeć dalej w przód
//     const currentWP = this.waypoints[this.currentWaypointIndex];
//     const distToCurrent = Math.hypot(currentWP.x - this.carX, currentWP.y - this.carY);
    
//     // Jeśli jesteśmy blisko obecnego waypointa, patrz na następny
//     if (distToCurrent < this.lookaheadDistance) {
//       const nextIndex = (this.currentWaypointIndex + 1) % this.waypoints.length;
//       const nextWP = this.waypoints[nextIndex];
//       const distToNext = Math.hypot(nextWP.x - this.carX, nextWP.y - this.carY);
      
//       // Jeśli i następny jest blisko, patrz jeszcze dalej
//       if (distToNext < this.lookaheadDistance * 0.7) {
//         const furtherIndex = (this.currentWaypointIndex + 2) % this.waypoints.length;
//         return this.waypoints[furtherIndex];
//       }
      
//       return nextWP;
//     }
    
//     return currentWP;
//   }
  
//   _getUpcomingTurnSharpness() {
//     const currentIndex = this.currentWaypointIndex;
//     const nextIndex = (currentIndex + 1) % this.waypoints.length;
//     const afterNextIndex = (currentIndex + 2) % this.waypoints.length;
    
//     const current = this.waypoints[currentIndex];
//     const next = this.waypoints[nextIndex];
//     const afterNext = this.waypoints[afterNextIndex];
    
//     // Oblicz kąty między segmentami
//     const angle1 = Math.atan2(next.y - current.y, next.x - current.x);
//     const angle2 = Math.atan2(afterNext.y - next.y, afterNext.x - next.x);
    
//     const angleDiff = Math.abs(this._normalizeAngle(angle2 - angle1));
    
//     return angleDiff; // Zwraca ostrość zakrętu w radianach
//   }
  
//   _normalizeAngle(angle) {
//     while (angle > Math.PI) angle -= 2 * Math.PI;
//     while (angle < -Math.PI) angle += 2 * Math.PI;
//     return angle;
//   }
  
//   _detectStuck(dt) {
//     // Sprawdź czy nadal na tym samym waypoint
//     if (this.currentWaypointIndex === this.stuckDetector.lastWaypoint) {
//       this.stuckDetector.sameWaypointTime += dt;
      
//       // Jeśli za długo na tym samym waypoint
//       if (this.stuckDetector.sameWaypointTime > this.stuckDetector.maxStuckTime) {
//         console.log(`[AI] STUCK on WP ${this.currentWaypointIndex}! Forcing skip`);
        
//         // Przesuń się do następnego waypointa
//         this.currentWaypointIndex = (this.currentWaypointIndex + 1) % this.waypoints.length;
        
//         // Włącz recovery mode
//         this.recoveryMode = true;
//         this.recoveryTimer = 2.0; // Zwiększono z 1.5
        
//         // Reset licznika
//         this.stuckDetector.sameWaypointTime = 0;
//         this.stuckDetector.lastWaypoint = this.currentWaypointIndex;
//       }
//     } else {
//       // Zmienił się waypoint - reset
//       this.stuckDetector.lastWaypoint = this.currentWaypointIndex;
//       this.stuckDetector.sameWaypointTime = 0;
//     }
//   }
  
//   _checkCurrentWaypoint() {
//     const currentWP = this.waypoints[this.currentWaypointIndex];
//     const dist = Math.hypot(
//       currentWP.x - this.carX,
//       currentWP.y - this.carY
//     );
    
//     // Zalicz waypoint - większy promień
//     if (dist < this.waypointZoneRadius) {
//       const prevIndex = this.currentWaypointIndex;
//       this.currentWaypointIndex = (this.currentWaypointIndex + 1) % this.waypoints.length;
//       console.log(`[AI] WP ${prevIndex} -> ${this.currentWaypointIndex}`);
//       return;
//     }
    
//     // Sprawdź czy waypoint jest bardzo daleko za nami
//     const angleToWP = Math.atan2(
//       currentWP.y - this.carY,
//       currentWP.x - this.carX
//     );
//     const angleDiff = Math.abs(this._normalizeAngle(angleToWP - this.getAngle()));
    
//     // Pomiń jeśli waypoint jest bardzo z tyłu i daleko
//     if (angleDiff > 2.5 && dist > 200) { // Zmniejszono progi
//       console.log(`[AI] WP ${this.currentWaypointIndex} far behind, skipping`);
//       this.currentWaypointIndex = (this.currentWaypointIndex + 1) % this.waypoints.length;
//     }
//   }
  
//   _updateDebug(dt, state) {
//     this.debugTimer += dt;
    
//     if (this.debugTimer >= this.debugInterval) {
//       const targetWP = this.waypoints[this.currentWaypointIndex];
//       const distToTarget = Math.hypot(targetWP.x - this.carX, targetWP.y - this.carY);
      
//       const debugInfo = {
//         wp: this.currentWaypointIndex,
//         dist: distToTarget.toFixed(0),
//         angle: this.debugAngle.toFixed(1) + '°',
//         speed: state.speed.toFixed(0),
//         v_y: state.v_y.toFixed(0),
//         mode: this.recoveryMode ? 'RECOVERY' : 'DRIVE',
//         steer: this.steerCommand.toFixed(2),
//         stuck: this.stuckDetector.sameWaypointTime.toFixed(1)
//       };
      
//       console.log('[AI]', JSON.stringify(debugInfo));
//       this.debugTimer = 0;
//     }
//   }

//   handleCollision(prevX, prevY, worldW, worldH) {
//     super.handleCollision(prevX, prevY, worldW, worldH);
    
//     // Po kolizji przesuń do następnego waypointa
//     console.log(`[AI] Collision! Skip to next WP`);
//     this.currentWaypointIndex = (this.currentWaypointIndex + 1) % this.waypoints.length;
    
//     // Włącz recovery
//     this.recoveryMode = true;
//     this.recoveryTimer = 2.5; // Zwiększono
    
//     // Reset stuck detector
//     this.stuckDetector.sameWaypointTime = 0;
//   }

//   getDebugInfo() {
//     const state = this.getFullState();
//     return {
//       wp: `${this.currentWaypointIndex}/${this.waypoints.length}`,
//       angle: this.debugAngle.toFixed(0) + '°',
//       speed: state.speed.toFixed(0),
//       mode: this.recoveryMode ? 'REC' : 'OK',
//       stuck: this.stuckDetector.sameWaypointTime > 1 ? 
//         `${this.stuckDetector.sameWaypointTime.toFixed(1)}s` : ''
//     };
//   }
// }

// import { Car } from "./car.js";

// export class AICar extends Car {
//   constructor(scene, carSprite, worldData, waypoints) {
//     super(scene, carSprite, worldData);
//     this.waypoints = waypoints;
//     this.currentWaypointIndex = 0;
    
//     // Parametry sterowania - bardzo konserwatywne
//     this.waypointZoneRadius = 120;
//     this.steerP = 0.25;
//     this.maxSteerInput = 0.15;
//     this.deadZoneAngle = 0.1;
    
//     // Lookahead - prostszy
//     this.lookaheadDistance = 100;
    
//     // Stan
//     this.steerCommand = 0;
//     this.debugAngle = 0;
    
//     // Wykrywanie utknięcia - uproszczone
//     this.stuckDetector = {
//       lastPosition: { x: 0, y: 0 },
//       positionTimer: 0,
//       minMovementDistance: 25,
//       stuckTime: 0
//     };
    
//     // Recovery - bardzo prosty
//     this.recoveryMode = false;
//     this.recoveryTimer = 0;
//     this.recoveryPhase = 'reverse'; // 'reverse' lub 'forward'
    
//     // Debug
//     this.debugTimer = 0;
//     this.debugInterval = 1.0;
    
//     // Stabilizacja waypointa - zapobiega skakaniu
//     this.waypointStability = {
//       lastChangeTime: 0,
//       minChangeInterval: 0.5 // Minimum 0.5s między zmianami waypointa
//     };
//   }

//   updateAI(dt, worldW, worldH) {
//     const state = this.getFullState();
    
//     // Debug
//     this._updateDebug(dt, state);
    
//     // Wykryj utknięcie
//     this._detectStuck(dt);
    
//     // Tryb recovery
//     if (this.recoveryMode) {
//       const recoveryControl = this._handleRecovery(dt, state);
//       this.update(dt, recoveryControl, worldW, worldH);
//       return;
//     }
    
//     // Sprawdź obecny waypoint - czy można go zaliczyć
//     this._checkWaypointCompletion();
    
//     // Wybierz cel - stabilny wybór
//     const targetWP = this._getStableTarget();
    
//     // Oblicz kierunek do celu
//     const distToTarget = Math.hypot(
//       targetWP.x - this.carX,
//       targetWP.y - this.carY
//     );
    
//     const angleToTarget = Math.atan2(
//       targetWP.y - this.carY,
//       targetWP.x - this.carX
//     );
    
//     let angleDiff = this._normalizeAngle(angleToTarget - state.carAngle);
//     this.debugAngle = Phaser.Math.RadToDeg(angleDiff);
    
//     // Oblicz sterowanie
//     let steer = 0;
//     let throttle = 0.3;
    
//     const absAngleDiff = Math.abs(angleDiff);
    
//     if (absAngleDiff < this.deadZoneAngle) {
//       // Jedź prosto
//       steer = 0;
//       throttle = 0.5;
//     } else {
//       // Sterowanie proporcjonalne
//       steer = angleDiff * this.steerP;
//       steer = Phaser.Math.Clamp(steer, -this.maxSteerInput, this.maxSteerInput);
      
//       // Dostosuj prędkość do kąta
//       if (absAngleDiff > 1.5) { // > 86 stopni
//         throttle = 0.05;
//       } else if (absAngleDiff > 1.0) { // > 57 stopni
//         throttle = 0.1;
//       } else if (absAngleDiff > 0.7) { // > 40 stopni
//         throttle = 0.15;
//       } else if (absAngleDiff > 0.4) { // > 23 stopni
//         throttle = 0.25;
//       } else {
//         throttle = 0.4;
//       }
//     }
    
//     // Ograniczenia prędkości
//     if (state.speed > 250) {
//       throttle = Math.min(throttle, 0.1);
//     } else if (state.speed > 180) {
//       throttle = Math.min(throttle, 0.2);
//     }
    
//     // Anty-poślizg
//     if (Math.abs(state.v_y) > 80) {
//       console.log(`[AI] SLIDE! v_y=${state.v_y.toFixed(0)}`);
//       throttle *= 0.3;
//       steer *= 0.5;
//     } else if (Math.abs(state.v_y) > 50) {
//       throttle *= 0.6;
//       steer *= 0.8;
//     }
    
//     this.steerCommand = steer;
    
//     const control = {
//       left: steer < -0.01,
//       right: steer > 0.01,
//       up: throttle > 0,
//       down: false
//     };

//     this.update(dt, control, worldW, worldH);
//   }
  
//   _getStableTarget() {
//     // Sprawdź czy można użyć lookahead
//     const currentWP = this.waypoints[this.currentWaypointIndex];
//     const distToCurrent = Math.hypot(currentWP.x - this.carX, currentWP.y - this.carY);
    
//     // Jeśli jesteśmy blisko obecnego waypointa, spróbuj następny
//     if (distToCurrent < this.lookaheadDistance) {
//       const nextIndex = (this.currentWaypointIndex + 1) % this.waypoints.length;
//       const nextWP = this.waypoints[nextIndex];
      
//       // Sprawdź czy następny waypoint jest dostępny (nie za bardzo z tyłu)
//       const angleToNext = Math.atan2(nextWP.y - this.carY, nextWP.x - this.carX);
//       const angleDiffToNext = Math.abs(this._normalizeAngle(angleToNext - this.getAngle()));
      
//       if (angleDiffToNext < 2.0) { // < 115 stopni
//         return nextWP;
//       }
//     }
    
//     // Sprawdź czy obecny waypoint nie jest za bardzo z tyłu
//     const angleToCurrent = Math.atan2(currentWP.y - this.carY, currentWP.x - this.carX);
//     const angleDiffToCurrent = Math.abs(this._normalizeAngle(angleToCurrent - this.getAngle()));
    
//     // Jeśli obecny waypoint jest bardzo z tyłu, przesuń się do następnego
//     // ale tylko jeśli minął odpowiedni czas od ostatniej zmiany
//     if (angleDiffToCurrent > 2.2 && // > 126 stopni
//         (Date.now() - this.waypointStability.lastChangeTime) > this.waypointStability.minChangeInterval * 1000) {
      
//       console.log(`[AI] Current WP behind (${Phaser.Math.RadToDeg(angleDiffToCurrent).toFixed(0)}°), advancing`);
//       this.currentWaypointIndex = (this.currentWaypointIndex + 1) % this.waypoints.length;
//       this.waypointStability.lastChangeTime = Date.now();
      
//       return this.waypoints[this.currentWaypointIndex];
//     }
    
//     return currentWP;
//   }
  
//   _checkWaypointCompletion() {
//     const currentWP = this.waypoints[this.currentWaypointIndex];
//     const dist = Math.hypot(
//       currentWP.x - this.carX,
//       currentWP.y - this.carY
//     );
    
//     // Zalicz waypoint jeśli jesteśmy blisko
//     if (dist < this.waypointZoneRadius) {
//       const prevIndex = this.currentWaypointIndex;
//       this.currentWaypointIndex = (this.currentWaypointIndex + 1) % this.waypoints.length;
//       this.waypointStability.lastChangeTime = Date.now();
//       console.log(`[AI] WP ${prevIndex} -> ${this.currentWaypointIndex}`);
//     }
//   }
  
//   _handleRecovery(dt, state) {
//     this.recoveryTimer -= dt;
    
//     if (this.recoveryTimer <= 0) {
//       this.recoveryMode = false;
//       console.log('[AI] Recovery END');
      
//       // Po recovery, przesuń się do następnego waypointa
//       this.currentWaypointIndex = (this.currentWaypointIndex + 1) % this.waypoints.length;
//       this.waypointStability.lastChangeTime = Date.now();
      
//       return { left: false, right: false, up: false, down: false };
//     }
    
//     if (this.recoveryPhase === 'reverse') {
//       // Cofaj przez pierwszą połowę czasu
//       if (this.recoveryTimer > 1.0) {
//         return {
//           left: false,
//           right: false,
//           up: false,
//           down: true
//         };
//       } else {
//         this.recoveryPhase = 'forward';
//         console.log('[AI] Recovery: reverse -> forward');
//       }
//     }
    
//     // Faza forward - jedź do przodu z lekkim skrętem
//     const nextWP = this.waypoints[(this.currentWaypointIndex + 1) % this.waypoints.length];
//     const angleToNext = Math.atan2(nextWP.y - this.carY, nextWP.x - this.carX);
//     const angleDiff = this._normalizeAngle(angleToNext - state.carAngle);
    
//     return {
//       left: angleDiff < -0.3,
//       right: angleDiff > 0.3,
//       up: true,
//       down: false
//     };
//   }
  
//   _detectStuck(dt) {
//     const currentPos = { x: this.carX, y: this.carY };
//     this.stuckDetector.positionTimer += dt;
    
//     if (this.stuckDetector.positionTimer >= 2.0) { // Sprawdzaj co 2 sekundy
//       const distMoved = Math.hypot(
//         currentPos.x - this.stuckDetector.lastPosition.x,
//         currentPos.y - this.stuckDetector.lastPosition.y
//       );
      
//       if (distMoved < this.stuckDetector.minMovementDistance) {
//         this.stuckDetector.stuckTime += 2.0;
//         console.log(`[AI] STUCK! Moved ${distMoved.toFixed(0)}px, stuck for ${this.stuckDetector.stuckTime}s`);
        
//         if (this.stuckDetector.stuckTime >= 4.0) { // Po 4 sekundach
//           this._startRecovery();
//         }
//       } else {
//         this.stuckDetector.stuckTime = 0; // Reset jeśli się rusza
//       }
      
//       this.stuckDetector.lastPosition = { ...currentPos };
//       this.stuckDetector.positionTimer = 0;
//     }
//   }
  
//   _startRecovery() {
//     this.recoveryMode = true;
//     this.recoveryTimer = 2.0;
//     this.recoveryPhase = 'reverse';
    
//     // Reset detektorów
//     this.stuckDetector.stuckTime = 0;
//     this.stuckDetector.positionTimer = 0;
//     this.stuckDetector.lastPosition = { x: this.carX, y: this.carY };
    
//     console.log(`[AI] Recovery started`);
//   }
  
//   _normalizeAngle(angle) {
//     while (angle > Math.PI) angle -= 2 * Math.PI;
//     while (angle < -Math.PI) angle += 2 * Math.PI;
//     return angle;
//   }
  
//   _updateDebug(dt, state) {
//     this.debugTimer += dt;
    
//     if (this.debugTimer >= this.debugInterval) {
//       const targetWP = this.waypoints[this.currentWaypointIndex];
//       const distToTarget = Math.hypot(targetWP.x - this.carX, targetWP.y - this.carY);
      
//       const debugInfo = {
//         wp: this.currentWaypointIndex,
//         dist: distToTarget.toFixed(0),
//         angle: this.debugAngle.toFixed(1) + '°',
//         speed: state.speed.toFixed(0),
//         v_y: state.v_y.toFixed(0),
//         mode: this.recoveryMode ? `REC-${this.recoveryPhase}` : 'DRIVE',
//         steer: this.steerCommand.toFixed(2),
//         stuck: this.stuckDetector.stuckTime.toFixed(1)
//       };
      
//       console.log('[AI]', JSON.stringify(debugInfo));
//       this.debugTimer = 0;
//     }
//   }

//   handleCollision(prevX, prevY, worldW, worldH) {
//     super.handleCollision(prevX, prevY, worldW, worldH);
//     console.log(`[AI] Collision! Starting recovery`);
//     this._startRecovery();
//   }

//   getDebugInfo() {
//     const state = this.getFullState();
//     return {
//       wp: `${this.currentWaypointIndex}/${this.waypoints.length}`,
//       angle: this.debugAngle.toFixed(0) + '°',
//       speed: state.speed.toFixed(0),
//       mode: this.recoveryMode ? `REC` : 'OK',
//       stuck: this.stuckDetector.stuckTime > 0 ? `${this.stuckDetector.stuckTime.toFixed(0)}s` : ''
//     };
//   }
// }



import { Car } from "./car.js";

export class AICar extends Car {
  constructor(scene, carSprite, worldData, waypoints) {
    super(scene, carSprite, worldData);
    this.waypoints = waypoints;
    this.currentWaypointIndex = 0;
    
    // Parametry sterowania - jeszcze bardziej konserwatywne
    this.waypointZoneRadius = 150; // Zwiększono
    this.steerP = 0.2; // Zmniejszono
    this.maxSteerInput = 0.12; // Zmniejszono
    this.deadZoneAngle = 0.15;
    
    // Lookahead
    this.lookaheadDistance = 120;
    
    // Stan
    this.steerCommand = 0;
    this.debugAngle = 0;
    
    // Wykrywanie utknięcia
    this.stuckDetector = {
      lastPosition: { x: 0, y: 0 },
      positionTimer: 0,
      minMovementDistance: 30,
      stuckTime: 0
    };
    
    // Recovery - znacznie ulepszony
    this.recoveryMode = false;
    this.recoveryTimer = 0;
    this.recoveryPhase = 'reverse';
    this.recoveryAttempts = 0;
    this.maxRecoveryAttempts = 2; // Zmniejszono
    
    // Obszary kolizji - nowy system
    this.dangerZones = []; // Lista niebezpiecznych obszarów
    this.maxDangerZones = 10;
    this.dangerZoneRadius = 150;
    this.dangerZoneAvoidTime = 15000; // 15 sekund unikania
    
    // Desperacki tryb
    this.desperateMode = false;
    this.desperateModeTimer = 0;
    this.desperateSkipDistance = 5; // Ile waypointów pomijać w trybie desperackim
    
    // Debug
    this.debugTimer = 0;
    this.debugInterval = 1.0;
    
    // Stabilizacja waypointa
    this.waypointStability = {
      lastChangeTime: 0,
      minChangeInterval: 0.3 // Zmniejszono
    };
  }

  updateAI(dt, worldW, worldH) {
    const state = this.getFullState();
    
    // Debug
    this._updateDebug(dt, state);
    
    // Aktualizuj tryb desperacki
    this._updateDesperateMode(dt);
    
    // Wyczyść stare strefy niebezpieczne
    this._cleanupDangerZones();
    
    // Wykryj utknięcie
    this._detectStuck(dt);
    
    // Tryb recovery
    if (this.recoveryMode) {
      const recoveryControl = this._handleSmartRecovery(dt, state);
      this.update(dt, recoveryControl, worldW, worldH);
      return;
    }
    
    // Tryb desperacki - pomiń problematyczne obszary
    if (this.desperateMode) {
      const desperateControl = this._handleDesperateMode(dt, state);
      this.update(dt, desperateControl, worldW, worldH);
      return;
    }
    
    // Sprawdź obecny waypoint
    this._checkWaypointCompletion();
    
    // Wybierz cel - unikaj stref niebezpiecznych
    const targetWP = this._getSafeTarget();
    
    // Oblicz kierunek do celu
    const distToTarget = Math.hypot(
      targetWP.x - this.carX,
      targetWP.y - this.carY
    );
    
    const angleToTarget = Math.atan2(
      targetWP.y - this.carY,
      targetWP.x - this.carX
    );
    
    let angleDiff = this._normalizeAngle(angleToTarget - state.carAngle);
    this.debugAngle = Phaser.Math.RadToDeg(angleDiff);
    
    // Oblicz sterowanie - bardzo ostrożne
    let steer = 0;
    let throttle = 0.2; // Zmniejszono domyślną prędkość
    
    const absAngleDiff = Math.abs(angleDiff);
    
    if (absAngleDiff < this.deadZoneAngle) {
      steer = 0;
      throttle = 0.4;
    } else {
      steer = angleDiff * this.steerP;
      steer = Phaser.Math.Clamp(steer, -this.maxSteerInput, this.maxSteerInput);
      
      // Bardzo konserwatywne dostosowanie prędkości
      if (absAngleDiff > 1.5) {
        throttle = 0.03; // Bardzo wolno
      } else if (absAngleDiff > 1.0) {
        throttle = 0.06;
      } else if (absAngleDiff > 0.7) {
        throttle = 0.1;
      } else if (absAngleDiff > 0.4) {
        throttle = 0.15;
      } else {
        throttle = 0.25;
      }
    }
    
    // Ograniczenia prędkości - bardzo agresywne
    if (state.speed > 180) {
      throttle = Math.min(throttle, 0.05);
    } else if (state.speed > 120) {
      throttle = Math.min(throttle, 0.1);
    }
    
    // Anty-poślizg - bardzo agresywny
    if (Math.abs(state.v_y) > 60) {
      console.log(`[AI] SLIDE! v_y=${state.v_y.toFixed(0)}`);
      throttle *= 0.2;
      steer *= 0.3;
    } else if (Math.abs(state.v_y) > 40) {
      throttle *= 0.5;
      steer *= 0.6;
    }
    
    // Sprawdź czy jesteśmy w strefie niebezpiecznej
    if (this._isInDangerZone()) {
      console.log('[AI] In danger zone - extra caution');
      throttle *= 0.3;
    }
    
    this.steerCommand = steer;
    
    const control = {
      left: steer < -0.005,
      right: steer > 0.005,
      up: throttle > 0,
      down: false
    };

    this.update(dt, control, worldW, worldH);
  }
  
  _getSafeTarget() {
    // Sprawdź kilka waypointów w przód i znajdź bezpieczny
    for (let i = 0; i < 8; i++) {
      const index = (this.currentWaypointIndex + i) % this.waypoints.length;
      const wp = this.waypoints[index];
      
      // Sprawdź czy waypoint nie jest w strefie niebezpiecznej
      if (!this._isWaypointInDangerZone(wp)) {
        // Sprawdź czy waypoint jest dostępny (nie za bardzo z tyłu)
        const angleToWP = Math.atan2(wp.y - this.carY, wp.x - this.carX);
        const angleDiff = Math.abs(this._normalizeAngle(angleToWP - this.getAngle()));
        
        if (angleDiff < 2.0 || i === 0) { // Zawsze akceptuj obecny waypoint
          if (i > 0) {
            console.log(`[AI] Skipping to safe WP ${index} (${i} ahead)`);
            this.currentWaypointIndex = index;
            this.waypointStability.lastChangeTime = Date.now();
          }
          return wp;
        }
      }
    }
    
    // Jeśli wszystkie waypoints są niebezpieczne, włącz tryb desperacki
    console.log('[AI] All waypoints dangerous - entering desperate mode');
    this._enterDesperateMode();
    
    return this.waypoints[this.currentWaypointIndex];
  }
  
  _isWaypointInDangerZone(waypoint) {
    for (const zone of this.dangerZones) {
      const dist = Math.hypot(waypoint.x - zone.x, waypoint.y - zone.y);
      if (dist < this.dangerZoneRadius) {
        return true;
      }
    }
    return false;
  }
  
  _isInDangerZone() {
    for (const zone of this.dangerZones) {
      const dist = Math.hypot(this.carX - zone.x, this.carY - zone.y);
      if (dist < this.dangerZoneRadius) {
        return true;
      }
    }
    return false;
  }
  
  _addDangerZone(x, y) {
    const zone = { 
      x, 
      y, 
      time: Date.now(),
      collisions: 1
    };
    
    // Sprawdź czy już istnieje podobna strefa
    for (const existingZone of this.dangerZones) {
      const dist = Math.hypot(x - existingZone.x, y - existingZone.y);
      if (dist < this.dangerZoneRadius) {
        existingZone.collisions++;
        existingZone.time = Date.now(); // Odśwież czas
        console.log(`[AI] Updated danger zone (${existingZone.collisions} collisions)`);
        return;
      }
    }
    
    // Dodaj nową strefę
    this.dangerZones.push(zone);
    console.log(`[AI] Added danger zone at (${x.toFixed(0)}, ${y.toFixed(0)})`);
    
    // Ogranicz liczbę stref
    if (this.dangerZones.length > this.maxDangerZones) {
      this.dangerZones.shift();
    }
  }
  
  _cleanupDangerZones() {
    const now = Date.now();
    this.dangerZones = this.dangerZones.filter(zone => {
      return (now - zone.time) < this.dangerZoneAvoidTime;
    });
  }
  
  _enterDesperateMode() {
    this.desperateMode = true;
    this.desperateModeTimer = 5.0; // 5 sekund trybu desperackiego
    console.log('[AI] DESPERATE MODE ACTIVATED');
  }
  
  _updateDesperateMode(dt) {
    if (this.desperateMode) {
      this.desperateModeTimer -= dt;
      if (this.desperateModeTimer <= 0) {
        this.desperateMode = false;
        console.log('[AI] Desperate mode ended');
      }
    }
  }
  
  _handleDesperateMode(dt, state) {
    // W trybie desperackim - pomiń kilka waypointów i jedź powoli
    const targetIndex = (this.currentWaypointIndex + this.desperateSkipDistance) % this.waypoints.length;
    const targetWP = this.waypoints[targetIndex];
    
    const angleToTarget = Math.atan2(targetWP.y - this.carY, targetWP.x - this.carX);
    const angleDiff = this._normalizeAngle(angleToTarget - state.carAngle);
    
    // Bardzo ostrożna jazda
    const steer = Phaser.Math.Clamp(angleDiff * 0.15, -0.1, 0.1);
    
    return {
      left: steer < -0.01,
      right: steer > 0.01,
      up: true, // Zawsze jedź do przodu w trybie desperackim
      down: false
    };
  }
  
  _handleSmartRecovery(dt, state) {
    this.recoveryTimer -= dt;
    
    if (this.recoveryTimer <= 0 || this.recoveryAttempts > this.maxRecoveryAttempts) {
      this.recoveryMode = false;
      this.recoveryAttempts = 0;
      console.log('[AI] Recovery END - entering desperate mode');
      
      // Po nieudanym recovery, włącz tryb desperacki
      this._enterDesperateMode();
      this.currentWaypointIndex = (this.currentWaypointIndex + this.desperateSkipDistance) % this.waypoints.length;
      
      return { left: false, right: false, up: false, down: false };
    }
    
    // Prosta strategia recovery - tylko cofanie i jazda do przodu
    if (this.recoveryPhase === 'reverse') {
      if (this.recoveryTimer > 1.0) {
        return {
          left: false,
          right: false,
          up: false,
          down: true
        };
      } else {
        this.recoveryPhase = 'forward';
        console.log('[AI] Recovery: reverse -> forward');
      }
    }
    
    // Jedź do przodu
    return {
      left: false,
      right: false,
      up: true,
      down: false
    };
  }
  
  _startSmartRecovery() {
    this.recoveryMode = true;
    this.recoveryTimer = 2.0;
    this.recoveryPhase = 'reverse';
    this.recoveryAttempts++;
    
    console.log(`[AI] Recovery started (attempt ${this.recoveryAttempts})`);
    
    // Reset detektorów
    this.stuckDetector.stuckTime = 0;
    this.stuckDetector.positionTimer = 0;
    this.stuckDetector.lastPosition = { x: this.carX, y: this.carY };
  }
  
  // Pozostałe metody...
  _checkWaypointCompletion() {
    const currentWP = this.waypoints[this.currentWaypointIndex];
    const dist = Math.hypot(
      currentWP.x - this.carX,
      currentWP.y - this.carY
    );
    
    if (dist < this.waypointZoneRadius) {
      const prevIndex = this.currentWaypointIndex;
      this.currentWaypointIndex = (this.currentWaypointIndex + 1) % this.waypoints.length;
      this.waypointStability.lastChangeTime = Date.now();
      console.log(`[AI] WP ${prevIndex} -> ${this.currentWaypointIndex}`);
    }
  }
  
  _detectStuck(dt) {
    const currentPos = { x: this.carX, y: this.carY };
    this.stuckDetector.positionTimer += dt;
    
    if (this.stuckDetector.positionTimer >= 3.0) { // Zwiększono czas
      const distMoved = Math.hypot(
        currentPos.x - this.stuckDetector.lastPosition.x,
        currentPos.y - this.stuckDetector.lastPosition.y
      );
      
      if (distMoved < this.stuckDetector.minMovementDistance) {
        this.stuckDetector.stuckTime += 3.0;
        console.log(`[AI] STUCK! Moved ${distMoved.toFixed(0)}px, stuck for ${this.stuckDetector.stuckTime}s`);
        
        if (this.stuckDetector.stuckTime >= 6.0) { // Po 6 sekundach
          // Dodaj obecne miejsce jako strefę niebezpieczną
          this._addDangerZone(this.carX, this.carY);
          this._enterDesperateMode();
          this.stuckDetector.stuckTime = 0; // Reset
        }
      } else {
        this.stuckDetector.stuckTime = 0; // Reset jeśli się rusza
      }
      
      this.stuckDetector.lastPosition = { ...currentPos };
      this.stuckDetector.positionTimer = 0;
    }
  }
  
  _normalizeAngle(angle) {
    while (angle > Math.PI) angle -= 2 * Math.PI;
    while (angle < -Math.PI) angle += 2 * Math.PI;
    return angle;
  }
  
  _updateDebug(dt, state) {
    this.debugTimer += dt;
    
    if (this.debugTimer >= this.debugInterval) {
      const targetWP = this.waypoints[this.currentWaypointIndex];
      const distToTarget = Math.hypot(targetWP.x - this.carX, targetWP.y - this.carY);
      
      const debugInfo = {
        wp: this.currentWaypointIndex,
        dist: distToTarget.toFixed(0),
        angle: this.debugAngle.toFixed(1) + '°',
        speed: state.speed.toFixed(0),
        v_y: state.v_y.toFixed(0),
        mode: this.desperateMode ? 'DESPERATE' : 
              this.recoveryMode ? `REC-${this.recoveryAttempts}-${this.recoveryPhase}` : 'DRIVE',
        steer: this.steerCommand.toFixed(2),
        stuck: this.stuckDetector.stuckTime.toFixed(1),
        dangers: this.dangerZones.length
      };
      
      console.log('[AI]', JSON.stringify(debugInfo));
      this.debugTimer = 0;
    }
  }

  handleCollision(prevX, prevY, worldW, worldH) {
    super.handleCollision(prevX, prevY, worldW, worldH);
    
    // Dodaj miejsce kolizji jako strefę niebezpieczną
    this._addDangerZone(this.carX, this.carY);
    
    // Sprawdź czy to powtarzająca się kolizja w tym samym obszarze
    const recentCollisionsInArea = this.dangerZones.filter(zone => {
      const dist = Math.hypot(this.carX - zone.x, this.carY - zone.y);
      const timeDiff = Date.now() - zone.time;
      return dist < this.dangerZoneRadius && timeDiff < 10000; // 10 sekund
    });
    
    if (recentCollisionsInArea.length >= 2) {
      console.log(`[AI] Repeated collisions in area! Entering desperate mode`);
      this._enterDesperateMode();
      // Pomiń więcej waypointów przy powtarzających się kolizjach
      this.currentWaypointIndex = (this.currentWaypointIndex + this.desperateSkipDistance * 2) % this.waypoints.length;
    } else {
      console.log(`[AI] Collision! Starting recovery (${this.dangerZones.length} danger zones)`);
      this._startSmartRecovery();
    }
  }

  getDebugInfo() {
    const state = this.getFullState();
    return {
      wp: `${this.currentWaypointIndex}/${this.waypoints.length}`,
      angle: this.debugAngle.toFixed(0) + '°',
      speed: state.speed.toFixed(0),
      mode: this.desperateMode ? 'DESP' : 
            this.recoveryMode ? `REC${this.recoveryAttempts}` : 'OK',
      stuck: this.stuckDetector.stuckTime > 0 ? `${this.stuckDetector.stuckTime.toFixed(0)}s` : '',
      zones: this.dangerZones.length > 0 ? `D${this.dangerZones.length}` : ''
    };
  }
}