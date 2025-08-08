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
//     const wx = px - A.x, wy = py - A.y;
//     return (vx * wx + vy * wy) / (vx * vx + vy * vy);
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
//     } else if (this.checkEllipseCollision()
//                || this.checkWorldEdgeCollision(worldW, worldH)) {
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









// // src/AICar.js
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
//     this.minLookAhead      = 10;
//     this.maxLookAhead      = 20;
//     this.lookAheadDistance = this.minLookAhead;
//     this.baseCurvatureGain = 10.0;

//     // deadzone i smoothing z configu
//     this.alphaDeadzone   = Phaser.Math.DegToRad(carConfig.steerInputThreshold);
//     this.baseSteerSmooth = carConfig.steerSmoothFactor;

//     // sterowanie
//     this.maxSteerRad         = Phaser.Math.DegToRad(carConfig.MAX_STEER_DEG);
//     this.steerRateLimit      = Phaser.Math.DegToRad(carConfig.STEER_SPEED_DEG);
//     this.steerReturnSpeedRad = Phaser.Math.DegToRad(carConfig.STEER_RETURN_SPEED_DEG);
//     this.steerInput          = 0;

//     // throttle
//     this.minThrottle = 0.1;
//     this.maxThrottle = 0.3;

//     //  — NOWE: szybkie obracanie samochodu w kierunku lookPoint
//     // ile razy mnożymy błąd kąta, by uzyskać angularVelocity:
//     this.rotateResponse    = 3.0;                  // tuning: większe = szybsze obracanie
//     // ograniczenie prędkości obrotu (radiany na sekundę):
//     this.maxAngularSpeed   = Phaser.Math.DegToRad(180);
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
//       const d   = Math.hypot(dx, dy);

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

//     // — NOWE: szybkie obracanie samochodu
//     // wyliczamy docelową prędkość kątową [rad/s]
//     const angleError    = Phaser.Math.Angle.Wrap(targetAng - this.carAngle);
//     const angularVel    = Phaser.Math.Clamp(
//                              angleError * this.rotateResponse,
//                              -this.maxAngularSpeed,
//                              this.maxAngularSpeed
//                            );
//     // Phaser Arcade Body angularVelocity jest w stopniach/s
//     this.carSprite.angularVelocity = Phaser.Math.RadToDeg(angularVel);

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
//       "steerIn:", this.steerInput.toFixed(2),
//       "thr:", throttle.toFixed(2)
//     );
//   }
// }











import { Car } from "./car.js";
import { carConfig } from "./carConfig.js";

export class AICar extends Car {
  constructor(scene, carSprite, worldData, waypoints) {
    super(scene, carSprite, worldData);
    this.waypoints = waypoints;
    this.currentSegmentIndex = 0;
    this.isLoop = true;

    this._buildPathMetrics();

    this.minLookAhead = 12;
    this.maxLookAhead = 45;
    this.lookAheadDistance = this.minLookAhead;
    this.LdLPAlpha = 0.3;

    this.baseCurvatureGain = 2.6;
    this.kStanley = 1.1;
    this.stanleyV0 = 2.0;

    this.steerInput = 0;
    this.steerVelocity = 0;
    this.steerVelocityLimit = Phaser.Math.DegToRad(130);
    this.steerSpringFactor = 10.0;
    this.steerDampingFactor = 4.0;
    this.maxSteerRad = Phaser.Math.DegToRad(carConfig.MAX_STEER_DEG);

    this.alphaDeadzone = Phaser.Math.DegToRad(2.5);
    this.steerReturnSpeedRad = Phaser.Math.DegToRad(80);

    this.minThrottle = 0.2;
    this.maxThrottle = 0.8;

    this.prevAlpha = 0;
    this.switchDist = 18;

    this.alphaAvgSamples = 3;
    this.alphaSampleSpacing = 16;
    this.alphaMinRad = Phaser.Math.DegToRad(10);
    this.lookScanStep = 6;
    this.kAlphaRate = 0.16;

    this.throttleLock = false;

    this.hairpinVisibilityRatio = 0.65;
    this.tangentForwardThresh = 0.2;
    this.hairpinAngleDeg = 120;
    this.hairpinClampLd = 18;
    this.hairpinWindow = 60;
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
    const v = this.carSpeed || 0;

    const LdTarget = Phaser.Math.Clamp(14 + v * 0.7, this.minLookAhead, this.maxLookAhead);
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
    const turnDeg = Math.abs(Phaser.Math.RadToDeg(Math.acos(Phaser.Math.Clamp(dot, -1, 1))));
    const distToNext = Math.hypot(px - b.x, py - b.y);
    if (turnDeg >= this.hairpinAngleDeg && distToNext < this.hairpinWindow) {
      const LdTargetHard = Math.min(this.lookAheadDistance, this.hairpinClampLd);
      this.lookAheadDistance = Phaser.Math.Linear(this.lookAheadDistance, LdTargetHard, 0.7);
    }

    const sLA = this._wrapS(nearest.s + this.lookAheadDistance);
    const lookP = this._findLookPointForward(px, py, this.carAngle, nearest.s, sLA, this.lookAheadDistance * 1.6);

    let sumAlpha = 0, cnt = 0;
    const fx = Math.cos(this.carAngle), fy = Math.sin(this.carAngle);
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
      const a = Phaser.Math.Angle.Wrap(ang - this.carAngle);
      sumAlpha += a; cnt++;
    }

    const alphaMean = cnt > 0
      ? sumAlpha / cnt
      : Phaser.Math.Angle.Wrap(Phaser.Math.Angle.Between(px, py, lookP.x, lookP.y) - this.carAngle);

    const stanley = Math.atan2(-this.kStanley * nearest.crossTrack, this.stanleyV0 + Math.abs(v));
    const alphaRate = (alphaMean - this.prevAlpha) / Math.max(dt, 1e-3);
    const alphaEff = Phaser.Math.Angle.Wrap(alphaMean + stanley + this.kAlphaRate * alphaRate);

    const curvature = (2 * Math.sin(alphaEff)) / Math.max(this.lookAheadDistance, 1e-3);
    const vSteerScale = 1 / (1 + 0.015 * Math.max(0, v));
    const rawSteer = Phaser.Math.Clamp(curvature * this.baseCurvatureGain * vSteerScale, -1, 1);

    if (alphaRate < 0 && Math.abs(alphaEff) < Phaser.Math.DegToRad(15)) {
      this.steerVelocity *= 0.7;
      this.steerInput *= 0.85;
    }
    if (Math.abs(alphaEff) < this.alphaDeadzone * 0.8 && Math.abs(this.steerInput) > 0.3) {
      const steerRelease = 1.8 * dt;
      this.steerInput -= Math.sign(this.steerInput) * steerRelease;
    }

    const steerForce = (rawSteer - this.steerInput) * this.steerSpringFactor;
    const steerDamping = -this.steerVelocity * this.steerDampingFactor;
    const steerAccel = steerForce + steerDamping;

    this.steerVelocity += steerAccel * dt;
    this.steerVelocity = Phaser.Math.Clamp(this.steerVelocity, -this.steerVelocityLimit, this.steerVelocityLimit);
    this.steerInput += this.steerVelocity * dt;

    if (Math.abs(alphaEff) < this.alphaDeadzone * 0.7) {
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

    let throttle = this.maxThrottle - (Math.min(Math.abs(alphaEff) / (Math.PI * 0.5), 1) * (this.maxThrottle - this.minThrottle));
    if (v < 20) throttle = Math.max(throttle, this.minThrottle + 0.4 * (this.maxThrottle - this.minThrottle));
    throttle = Phaser.Math.Clamp(throttle, this.minThrottle, this.maxThrottle);

    const tx = b.x - a.x, ty = b.y - a.y;
    const forwardToNext = tx * fx + ty * fy;

    if ((distToNext <= this.switchDist || nearest.t >= 0.98) && forwardToNext > 0) {
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
}
