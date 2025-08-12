// import { Car } from "./car.js";

// export class AICar extends Car {
//   constructor(scene, carSprite, worldData, waypoints) {
//     super(scene, carSprite, worldData);
//     this.waypoints = waypoints;
//     this.currentWaypointIndex = 0;

//     // Parametry sterowania - jeszcze bardziej konserwatywne
//     this.waypointZoneRadius = 150; // Zwiększono
//     this.steerP = 0.2; // Zmniejszono
//     this.maxSteerInput = 0.12; // Zmniejszono
//     this.deadZoneAngle = 0.15;

//     // Lookahead
//     this.lookaheadDistance = 120;

//     // Stan
//     this.steerCommand = 0;
//     this.debugAngle = 0;

//     // Wykrywanie utknięcia
//     this.stuckDetector = {
//       lastPosition: { x: 0, y: 0 },
//       positionTimer: 0,
//       minMovementDistance: 30,
//       stuckTime: 0
//     };

//     // Recovery - znacznie ulepszony
//     this.recoveryMode = false;
//     this.recoveryTimer = 0;
//     this.recoveryPhase = 'reverse';
//     this.recoveryAttempts = 0;
//     this.maxRecoveryAttempts = 2; // Zmniejszono

//     // Obszary kolizji - nowy system
//     this.dangerZones = []; // Lista niebezpiecznych obszarów
//     this.maxDangerZones = 10;
//     this.dangerZoneRadius = 150;
//     this.dangerZoneAvoidTime = 15000; // 15 sekund unikania

//     // Desperacki tryb
//     this.desperateMode = false;
//     this.desperateModeTimer = 0;
//     this.desperateSkipDistance = 5; // Ile waypointów pomijać w trybie desperackim

//     // Debug
//     this.debugTimer = 0;
//     this.debugInterval = 1.0;

//     // Stabilizacja waypointa
//     this.waypointStability = {
//       lastChangeTime: 0,
//       minChangeInterval: 0.3 // Zmniejszono
//     };
//   }

//   updateAI(dt, worldW, worldH) {
//     const state = this.getFullState();

//     // Debug
//     // this._updateDebug(dt, state);

//     // Aktualizuj tryb desperacki
//     this._updateDesperateMode(dt);

//     // Wyczyść stare strefy niebezpieczne
//     this._cleanupDangerZones();

//     // Wykryj utknięcie
//     this._detectStuck(dt);

//     // Tryb recovery
//     if (this.recoveryMode) {
//       const recoveryControl = this._handleSmartRecovery(dt, state);
//       this.update(dt, recoveryControl, worldW, worldH);
//       return;
//     }

//     // Tryb desperacki - pomiń problematyczne obszary
//     if (this.desperateMode) {
//       const desperateControl = this._handleDesperateMode(dt, state);
//       this.update(dt, desperateControl, worldW, worldH);
//       return;
//     }

//     // Sprawdź obecny waypoint
//     this._checkWaypointCompletion();

//     // Wybierz cel - unikaj stref niebezpiecznych
//     const targetWP = this._getSafeTarget();

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

//     // Oblicz sterowanie - bardzo ostrożne
//     let steer = 0;
//     let throttle = 0.2; // Zmniejszono domyślną prędkość

//     const absAngleDiff = Math.abs(angleDiff);

//     if (absAngleDiff < this.deadZoneAngle) {
//       steer = 0;
//       throttle = 0.4;
//     } else {
//       steer = angleDiff * this.steerP;
//       steer = Phaser.Math.Clamp(steer, -this.maxSteerInput, this.maxSteerInput);

//       // Bardzo konserwatywne dostosowanie prędkości
//       if (absAngleDiff > 1.5) {
//         throttle = 0.03; // Bardzo wolno
//       } else if (absAngleDiff > 1.0) {
//         throttle = 0.06;
//       } else if (absAngleDiff > 0.7) {
//         throttle = 0.1;
//       } else if (absAngleDiff > 0.4) {
//         throttle = 0.15;
//       } else {
//         throttle = 0.25;
//       }
//     }

//     // Ograniczenia prędkości - bardzo agresywne
//     if (state.speed > 180) {
//       throttle = Math.min(throttle, 0.05);
//     } else if (state.speed > 120) {
//       throttle = Math.min(throttle, 0.1);
//     }

//     // Anty-poślizg - bardzo agresywny
//     if (Math.abs(state.v_y) > 60) {
//       // console.log(`[AI] SLIDE! v_y=${state.v_y.toFixed(0)}`);
//       throttle *= 0.2;
//       steer *= 0.3;
//     } else if (Math.abs(state.v_y) > 40) {
//       throttle *= 0.5;
//       steer *= 0.6;
//     }

//     // Sprawdź czy jesteśmy w strefie niebezpiecznej
//     if (this._isInDangerZone()) {
//       console.log('[AI] In danger zone - extra caution');
//       throttle *= 0.3;
//     }

//     this.steerCommand = steer;

//     const control = {
//       left: steer < -0.005,
//       right: steer > 0.005,
//       up: throttle > 0,
//       down: false
//     };

//     this.update(dt, control, worldW, worldH);
//   }

//   _getSafeTarget() {
//     // Sprawdź kilka waypointów w przód i znajdź bezpieczny
//     for (let i = 0; i < 8; i++) {
//       const index = (this.currentWaypointIndex + i) % this.waypoints.length;
//       const wp = this.waypoints[index];

//       // Sprawdź czy waypoint nie jest w strefie niebezpiecznej
//       if (!this._isWaypointInDangerZone(wp)) {
//         // Sprawdź czy waypoint jest dostępny (nie za bardzo z tyłu)
//         const angleToWP = Math.atan2(wp.y - this.carY, wp.x - this.carX);
//         const angleDiff = Math.abs(this._normalizeAngle(angleToWP - this.getAngle()));

//         if (angleDiff < 2.0 || i === 0) { // Zawsze akceptuj obecny waypoint
//           if (i > 0) {
//             console.log(`[AI] Skipping to safe WP ${index} (${i} ahead)`);
//             this.currentWaypointIndex = index;
//             this.waypointStability.lastChangeTime = Date.now();
//           }
//           return wp;
//         }
//       }
//     }

//     // Jeśli wszystkie waypoints są niebezpieczne, włącz tryb desperacki
//     console.log('[AI] All waypoints dangerous - entering desperate mode');
//     this._enterDesperateMode();

//     return this.waypoints[this.currentWaypointIndex];
//   }

//   _isWaypointInDangerZone(waypoint) {
//     for (const zone of this.dangerZones) {
//       const dist = Math.hypot(waypoint.x - zone.x, waypoint.y - zone.y);
//       if (dist < this.dangerZoneRadius) {
//         return true;
//       }
//     }
//     return false;
//   }

//   _isInDangerZone() {
//     for (const zone of this.dangerZones) {
//       const dist = Math.hypot(this.carX - zone.x, this.carY - zone.y);
//       if (dist < this.dangerZoneRadius) {
//         return true;
//       }
//     }
//     return false;
//   }

//   _addDangerZone(x, y) {
//     const zone = {
//       x,
//       y,
//       time: Date.now(),
//       collisions: 1
//     };

//     // Sprawdź czy już istnieje podobna strefa
//     for (const existingZone of this.dangerZones) {
//       const dist = Math.hypot(x - existingZone.x, y - existingZone.y);
//       if (dist < this.dangerZoneRadius) {
//         existingZone.collisions++;
//         existingZone.time = Date.now(); // Odśwież czas
//         console.log(`[AI] Updated danger zone (${existingZone.collisions} collisions)`);
//         return;
//       }
//     }

//     // Dodaj nową strefę
//     this.dangerZones.push(zone);
//     console.log(`[AI] Added danger zone at (${x.toFixed(0)}, ${y.toFixed(0)})`);

//     // Ogranicz liczbę stref
//     if (this.dangerZones.length > this.maxDangerZones) {
//       this.dangerZones.shift();
//     }
//   }

//   _cleanupDangerZones() {
//     const now = Date.now();
//     this.dangerZones = this.dangerZones.filter(zone => {
//       return (now - zone.time) < this.dangerZoneAvoidTime;
//     });
//   }

//   _enterDesperateMode() {
//     this.desperateMode = true;
//     this.desperateModeTimer = 5.0; // 5 sekund trybu desperackiego
//     console.log('[AI] DESPERATE MODE ACTIVATED');
//   }

//   _updateDesperateMode(dt) {
//     if (this.desperateMode) {
//       this.desperateModeTimer -= dt;
//       if (this.desperateModeTimer <= 0) {
//         this.desperateMode = false;
//         console.log('[AI] Desperate mode ended');
//       }
//     }
//   }

//   _handleDesperateMode(dt, state) {
//     // W trybie desperackim - pomiń kilka waypointów i jedź powoli
//     const targetIndex = (this.currentWaypointIndex + this.desperateSkipDistance) % this.waypoints.length;
//     const targetWP = this.waypoints[targetIndex];

//     const angleToTarget = Math.atan2(targetWP.y - this.carY, targetWP.x - this.carX);
//     const angleDiff = this._normalizeAngle(angleToTarget - state.carAngle);

//     // Bardzo ostrożna jazda
//     const steer = Phaser.Math.Clamp(angleDiff * 0.15, -0.1, 0.1);

//     return {
//       left: steer < -0.01,
//       right: steer > 0.01,
//       up: true, // Zawsze jedź do przodu w trybie desperackim
//       down: false
//     };
//   }

//   _handleSmartRecovery(dt, state) {
//     this.recoveryTimer -= dt;

//     if (this.recoveryTimer <= 0 || this.recoveryAttempts > this.maxRecoveryAttempts) {
//       this.recoveryMode = false;
//       this.recoveryAttempts = 0;
//       console.log('[AI] Recovery END - entering desperate mode');

//       // Po nieudanym recovery, włącz tryb desperacki
//       this._enterDesperateMode();
//       this.currentWaypointIndex = (this.currentWaypointIndex + this.desperateSkipDistance) % this.waypoints.length;

//       return { left: false, right: false, up: false, down: false };
//     }

//     // Prosta strategia recovery - tylko cofanie i jazda do przodu
//     if (this.recoveryPhase === 'reverse') {
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

//     // Jedź do przodu
//     return {
//       left: false,
//       right: false,
//       up: true,
//       down: false
//     };
//   }

//   _startSmartRecovery() {
//     this.recoveryMode = true;
//     this.recoveryTimer = 2.0;
//     this.recoveryPhase = 'reverse';
//     this.recoveryAttempts++;

//     console.log(`[AI] Recovery started (attempt ${this.recoveryAttempts})`);

//     // Reset detektorów
//     this.stuckDetector.stuckTime = 0;
//     this.stuckDetector.positionTimer = 0;
//     this.stuckDetector.lastPosition = { x: this.carX, y: this.carY };
//   }

//   // Pozostałe metody...
//   _checkWaypointCompletion() {
//     const currentWP = this.waypoints[this.currentWaypointIndex];
//     const dist = Math.hypot(
//       currentWP.x - this.carX,
//       currentWP.y - this.carY
//     );

//     if (dist < this.waypointZoneRadius) {
//       const prevIndex = this.currentWaypointIndex;
//       this.currentWaypointIndex = (this.currentWaypointIndex + 1) % this.waypoints.length;
//       this.waypointStability.lastChangeTime = Date.now();
//       // console.log(`[AI] WP ${prevIndex} -> ${this.currentWaypointIndex}`);
//     }
//   }

//   _detectStuck(dt) {
//     const currentPos = { x: this.carX, y: this.carY };
//     this.stuckDetector.positionTimer += dt;

//     if (this.stuckDetector.positionTimer >= 3.0) { // Zwiększono czas
//       const distMoved = Math.hypot(
//         currentPos.x - this.stuckDetector.lastPosition.x,
//         currentPos.y - this.stuckDetector.lastPosition.y
//       );

//       if (distMoved < this.stuckDetector.minMovementDistance) {
//         this.stuckDetector.stuckTime += 3.0;
//         console.log(`[AI] STUCK! Moved ${distMoved.toFixed(0)}px, stuck for ${this.stuckDetector.stuckTime}s`);

//         if (this.stuckDetector.stuckTime >= 6.0) { // Po 6 sekundach
//           // Dodaj obecne miejsce jako strefę niebezpieczną
//           this._addDangerZone(this.carX, this.carY);
//           this._enterDesperateMode();
//           this.stuckDetector.stuckTime = 0; // Reset
//         }
//       } else {
//         this.stuckDetector.stuckTime = 0; // Reset jeśli się rusza
//       }

//       this.stuckDetector.lastPosition = { ...currentPos };
//       this.stuckDetector.positionTimer = 0;
//     }
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
//         mode: this.desperateMode ? 'DESPERATE' :
//           this.recoveryMode ? `REC-${this.recoveryAttempts}-${this.recoveryPhase}` : 'DRIVE',
//         steer: this.steerCommand.toFixed(2),
//         stuck: this.stuckDetector.stuckTime.toFixed(1),
//         dangers: this.dangerZones.length
//       };

//       console.log('[AI]', JSON.stringify(debugInfo));
//       this.debugTimer = 0;
//     }
//   }

//   handleCollision(prevX, prevY, worldW, worldH) {
//     super.handleCollision(prevX, prevY, worldW, worldH);

//     // Dodaj miejsce kolizji jako strefę niebezpieczną
//     this._addDangerZone(this.carX, this.carY);

//     // Sprawdź czy to powtarzająca się kolizja w tym samym obszarze
//     const recentCollisionsInArea = this.dangerZones.filter(zone => {
//       const dist = Math.hypot(this.carX - zone.x, this.carY - zone.y);
//       const timeDiff = Date.now() - zone.time;
//       return dist < this.dangerZoneRadius && timeDiff < 10000; // 10 sekund
//     });

//     if (recentCollisionsInArea.length >= 2) {
//       console.log(`[AI] Repeated collisions in area! Entering desperate mode`);
//       this._enterDesperateMode();
//       // Pomiń więcej waypointów przy powtarzających się kolizjach
//       this.currentWaypointIndex = (this.currentWaypointIndex + this.desperateSkipDistance * 2) % this.waypoints.length;
//     } else {
//       console.log(`[AI] Collision! Starting recovery (${this.dangerZones.length} danger zones)`);
//       this._startSmartRecovery();
//     }
//   }

//   getDebugInfo() {
//     const state = this.getFullState();
//     return {
//       wp: `${this.currentWaypointIndex}/${this.waypoints.length}`,
//       angle: this.debugAngle.toFixed(0) + '°',
//       speed: state.speed.toFixed(0),
//       mode: this.desperateMode ? 'DESP' :
//         this.recoveryMode ? `REC${this.recoveryAttempts}` : 'OK',
//       stuck: this.stuckDetector.stuckTime > 0 ? `${this.stuckDetector.stuckTime.toFixed(0)}s` : '',
//       zones: this.dangerZones.length > 0 ? `D${this.dangerZones.length}` : ''
//     };
//   }

//   resetState(initialX, initialY) {
//     // Wywołaj reset stanu bazowej klasy Car
//     super.resetState(initialX, initialY);

//     // Zresetuj indeks waypointa
//     this.currentWaypointIndex = 0;

//     // Zresetuj parametry sterowania i stan
//     this.steerCommand = 0;
//     this.debugAngle = 0;

//     // Zresetuj detektor utknięcia
//     this.stuckDetector.stuckTime = 0;
//     this.stuckDetector.positionTimer = 0;
//     this.stuckDetector.lastPosition = { x: initialX, y: initialY }; // Ustaw na nowej pozycji

//     // Zresetuj tryb recovery
//     this.recoveryMode = false;
//     this.recoveryTimer = 0;
//     this.recoveryPhase = 'reverse';
//     this.recoveryAttempts = 0;

//     // Wyczyść strefy niebezpieczne
//     this.dangerZones = [];

//     // Zresetuj tryb desperacki
//     this.desperateMode = false;
//     this.desperateModeTimer = 0;

//     // Zresetuj timery debugowania i stabilizacji
//     this.debugTimer = 0;
//     this.waypointStability.lastChangeTime = 0;

//     // Zatrzymaj auto fizycznie, aby nie "cofało" się po restarcie
//     this.body.setVelocity(0, 0);
//     this.body.setAngularVelocity(0);
//   }
// }












// import { Car } from "./car.js";

// export class AICar extends Car {
//   constructor(scene, carSprite, worldData, waypoints) {
//     super(scene, carSprite, worldData);
//     this.waypoints = waypoints;
//     this.currentWaypointIndex = 0;
//     this.recoveryState = 'normal'; // 'normal', 'reversing', 'evaluating'
//     this.evaluationPauseTimer = 0;
//     // Parametry sterowania - jeszcze bardziej konserwatywne
//     this.waypointZoneRadius = 150; // Zwiększono
//     this.steerP = 0.2; // Zmniejszono
//     this.maxSteerInput = 0.12; // Zmniejszono
//     this.deadZoneAngle = 0.15;

//     // Lookahead
//     this.lookaheadDistance = 120;

//     // Stan
//     this.steerCommand = 0;
//     this.debugAngle = 0;

//     // Wykrywanie utknięcia
//     this.stuckDetector = {
//       lastPosition: { x: 0, y: 0 },
//       positionTimer: 0,
//       minMovementDistance: 30,
//       stuckTime: 0
//     };

//     // Recovery - znacznie ulepszony
//     this.recoveryMode = false;
//     this.recoveryTimer = 0;
//     this.recoveryPhase = 'reverse';
//     this.recoveryAttempts = 0;
//     this.maxRecoveryAttempts = 2; // Zmniejszono

//     // Obszary kolizji - nowy system
//     this.dangerZones = []; // Lista niebezpiecznych obszarów
//     this.maxDangerZones = 10;
//     this.dangerZoneRadius = 150;
//     this.dangerZoneAvoidTime = 15000; // 15 sekund unikania

//     // Desperacki tryb
//     this.desperateMode = false;
//     this.desperateModeTimer = 0;
//     this.desperateSkipDistance = 5; // Ile waypointów pomijać w trybie desperackim

//     // Debug
//     this.debugTimer = 0;
//     this.debugInterval = 1.0;

//     // Stabilizacja waypointa
//     this.waypointStability = {
//       lastChangeTime: 0,
//       minChangeInterval: 0.3 // Zmniejszono
//     };
//   }

//   updateAI(dt, worldW, worldH) {
//     const state = this.getFullState();

//     // Debug
//     // this._updateDebug(dt, state);

//     // Aktualizuj tryb desperacki
//     this._updateDesperateMode(dt);

//     // Wyczyść stare strefy niebezpieczne
//     this._cleanupDangerZones();

//     // Wykryj utknięcie
//     this._detectStuck(dt);

//     // Tryb recovery
//     if (this.recoveryMode) {
//       const recoveryControl = this._handleSmartRecovery(dt, state);
//       this.update(dt, recoveryControl, worldW, worldH);
//       return;
//     }

//     // Tryb desperacki - pomiń problematyczne obszary
//     if (this.desperateMode) {
//       const desperateControl = this._handleDesperateMode(dt, state);
//       this.update(dt, desperateControl, worldW, worldH);
//       return;
//     }

//     // Sprawdź obecny waypoint
//     this._checkWaypointCompletion();

//     // Wybierz cel - unikaj stref niebezpiecznych
//     const targetWP = this._getSafeTarget();

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

//     // Oblicz sterowanie - bardzo ostrożne
//     let steer = 0;
//     let throttle = 0.2; // Zmniejszono domyślną prędkość

//     const absAngleDiff = Math.abs(angleDiff);

//     if (absAngleDiff < this.deadZoneAngle) {
//       steer = 0;
//       throttle = 0.4;
//     } else {
//       steer = angleDiff * this.steerP;
//       steer = Phaser.Math.Clamp(steer, -this.maxSteerInput, this.maxSteerInput);

//       // Bardzo konserwatywne dostosowanie prędkości
//       if (absAngleDiff > 1.5) {
//         throttle = 0.03; // Bardzo wolno
//       } else if (absAngleDiff > 1.0) {
//         throttle = 0.06;
//       } else if (absAngleDiff > 0.7) {
//         throttle = 0.1;
//       } else if (absAngleDiff > 0.4) {
//         throttle = 0.15;
//       } else {
//         throttle = 0.25;
//       }
//     }

//     // Ograniczenia prędkości - bardzo agresywne
//     if (state.speed > 180) {
//       throttle = Math.min(throttle, 0.05);
//     } else if (state.speed > 120) {
//       throttle = Math.min(throttle, 0.1);
//     }

//     // Anty-poślizg - bardzo agresywny
//     if (Math.abs(state.v_y) > 60) {
//       // console.log(`[AI] SLIDE! v_y=${state.v_y.toFixed(0)}`);
//       throttle *= 0.2;
//       steer *= 0.3;
//     } else if (Math.abs(state.v_y) > 40) {
//       throttle *= 0.5;
//       steer *= 0.6;
//     }

//     // Sprawdź czy jesteśmy w strefie niebezpiecznej
//     if (this._isInDangerZone()) {
//       console.log('[AI] In danger zone - extra caution');
//       throttle *= 0.3;
//     }

//     this.steerCommand = steer;

//     const control = {
//       left: steer < -0.005,
//       right: steer > 0.005,
//       up: throttle > 0,
//       down: false
//     };

//     this.update(dt, control, worldW, worldH);
//   }

//   _getSafeTarget() {
//     // Sprawdź kilka waypointów w przód i znajdź bezpieczny
//     for (let i = 0; i < 8; i++) {
//       const index = (this.currentWaypointIndex + i) % this.waypoints.length;
//       const wp = this.waypoints[index];

//       // Sprawdź czy waypoint nie jest w strefie niebezpiecznej
//       if (!this._isWaypointInDangerZone(wp)) {
//         // Sprawdź czy waypoint jest dostępny (nie za bardzo z tyłu)
//         const angleToWP = Math.atan2(wp.y - this.carY, wp.x - this.carX);
//         const angleDiff = Math.abs(this._normalizeAngle(angleToWP - this.getAngle()));

//         if (angleDiff < 2.0 || i === 0) { // Zawsze akceptuj obecny waypoint
//           if (i > 0) {
//             console.log(`[AI] Skipping to safe WP ${index} (${i} ahead)`);
//             this.currentWaypointIndex = index;
//             this.waypointStability.lastChangeTime = Date.now();
//           }
//           return wp;
//         }
//       }
//     }

//     // Jeśli wszystkie waypoints są niebezpieczne, włącz tryb desperacki
//     console.log('[AI] All waypoints dangerous - entering desperate mode');
//     this._enterDesperateMode();

//     return this.waypoints[this.currentWaypointIndex];
//   }

//   _isWaypointInDangerZone(waypoint) {
//     for (const zone of this.dangerZones) {
//       const dist = Math.hypot(waypoint.x - zone.x, waypoint.y - zone.y);
//       if (dist < this.dangerZoneRadius) {
//         return true;
//       }
//     }
//     return false;
//   }

//   _isInDangerZone() {
//     for (const zone of this.dangerZones) {
//       const dist = Math.hypot(this.carX - zone.x, this.carY - zone.y);
//       if (dist < this.dangerZoneRadius) {
//         return true;
//       }
//     }
//     return false;
//   }

//   _addDangerZone(x, y) {
//     const zone = {
//       x,
//       y,
//       time: Date.now(),
//       collisions: 1
//     };

//     // Sprawdź czy już istnieje podobna strefa
//     for (const existingZone of this.dangerZones) {
//       const dist = Math.hypot(x - existingZone.x, y - existingZone.y);
//       if (dist < this.dangerZoneRadius) {
//         existingZone.collisions++;
//         existingZone.time = Date.now(); // Odśwież czas
//         console.log(`[AI] Updated danger zone (${existingZone.collisions} collisions)`);
//         return;
//       }
//     }

//     // Dodaj nową strefę
//     this.dangerZones.push(zone);
//     console.log(`[AI] Added danger zone at (${x.toFixed(0)}, ${y.toFixed(0)})`);

//     // Ogranicz liczbę stref
//     if (this.dangerZones.length > this.maxDangerZones) {
//       this.dangerZones.shift();
//     }
//   }

//   _cleanupDangerZones() {
//     const now = Date.now();
//     this.dangerZones = this.dangerZones.filter(zone => {
//       return (now - zone.time) < this.dangerZoneAvoidTime;
//     });
//   }

//   _enterDesperateMode() {
//     this.desperateMode = true;
//     this.desperateModeTimer = 5.0; // 5 sekund trybu desperackiego
//     console.log('[AI] DESPERATE MODE ACTIVATED');
//   }

//   _updateDesperateMode(dt) {
//     if (this.desperateMode) {
//       this.desperateModeTimer -= dt;
//       if (this.desperateModeTimer <= 0) {
//         this.desperateMode = false;
//         console.log('[AI] Desperate mode ended');
//       }
//     }
//   }

//   _handleDesperateMode(dt, state) {
//     // W trybie desperackim - pomiń kilka waypointów i jedź powoli
//     const targetIndex = (this.currentWaypointIndex + this.desperateSkipDistance) % this.waypoints.length;
//     const targetWP = this.waypoints[targetIndex];

//     const angleToTarget = Math.atan2(targetWP.y - this.carY, targetWP.x - this.carX);
//     const angleDiff = this._normalizeAngle(angleToTarget - state.carAngle);

//     // Bardzo ostrożna jazda
//     const steer = Phaser.Math.Clamp(angleDiff * 0.15, -0.1, 0.1);

//     return {
//       left: steer < -0.01,
//       right: steer > 0.01,
//       up: true, // Zawsze jedź do przodu w trybie desperackim
//       down: false
//     };
//   }

//   _handleSmartRecovery(dt, state) {
//     this.recoveryTimer -= dt;

//     switch (this.recoveryState) {
//       case 'reversing':
//         // Faza 1: Aktywne cofanie
//         if (this.recoveryTimer > 0) {
//           console.log(`[AI] Recovery: REVERSING... (${this.recoveryTimer.toFixed(1)}s left)`);
//           return {
//             left: false,
//             right: false,
//             up: false,
//             down: true
//           };
//         } else {
//           // Cofanie zakończone, czas na pauzę i ocenę
//           this.recoveryState = 'evaluating';
//           this.evaluationPauseTimer = 0.5; // Pauza 0.5s, aby auto się zatrzymało
//           console.log('[AI] Recovery: Reversing finished. PAUSING to EVALUATE position.');
//           return { left: false, right: false, up: false, down: false }; // Zatrzymaj auto
//         }

//       case 'evaluating':
//         // Faza 2: Ocena sytuacji po cofnięciu
//         this.evaluationPauseTimer -= dt;
//         if (this.evaluationPauseTimer > 0) {
//           // Wciąż w trakcie pauzy, nic nie rób
//           return { left: false, right: false, up: false, down: false };
//         } else {
//           // Pauza skończona, sprawdź kąt do następnego waypointa
//           this.recoveryState = 'normal'; // Wyjdź ze stanu specjalnego recovery
//           this.recoveryMode = false;     // Wyłącz główny tryb recovery

//           const nextWp = this.waypoints[(this.currentWaypointIndex + 1) % this.waypoints.length];
//           const angleToWp = this._normalizeAngle(Math.atan2(nextWp.y - this.carY, nextWp.x - this.carX) - state.carAngle);

//           // Jeśli kąt do celu jest mniejszy niż 90 stopni (wartość bezwzględna < PI/2),
//           // to znaczy, że jesteśmy w miarę "odwróceni" w dobrym kierunku.
//           if (Math.abs(angleToWp) < Math.PI / 2) {
//             console.log('[AI] Recovery: Evaluation SUCCESSFUL. Resuming normal drive.');
//             // Wróć do normalnej logiki updateAI, która teraz poprawnie wybierze sterowanie
//             return { left: false, right: false, up: false, down: false };
//           } else {
//             // Kąt jest wciąż fatalny (np. stoimy do góry nogami). 
//             // Spróbuj jeszcze raz szybkiego cofnięcia.
//             console.warn('[AI] Recovery: Evaluation FAILED. Still facing wrong way. Trying one more quick reverse.');
//             this.recoveryState = 'reversing';
//             this.recoveryTimer = 1.0; // Tym razem krócej
//             return { left: false, right: false, up: false, down: true };
//           }
//         }

//       default:
//         // Domyślnie wyjdź z trybu recovery, aby uniknąć zapętleń
//         this.recoveryMode = false;
//         return { left: false, right: false, up: false, down: false };
//     }
//   }

//   _startSmartRecovery() {
//     this.recoveryMode = true;
//     this.recoveryState = 'reversing'; // Zacznij od cofania
//     this.recoveryTimer = 3.0; // Zwiększony czas na wycofanie
//     this.recoveryAttempts++;

//     console.log(`[AI] Recovery STARTED (phase: reversing, attempt ${this.recoveryAttempts})`);

//     // Reset detektorów
//     this.stuckDetector.stuckTime = 0;
//     this.stuckDetector.positionTimer = 0;
//     this.stuckDetector.lastPosition = { x: this.carX, y: this.carY };
//   }

//   // Pozostałe metody...
//   _checkWaypointCompletion() {
//     const currentWP = this.waypoints[this.currentWaypointIndex];
//     const dist = Math.hypot(
//       currentWP.x - this.carX,
//       currentWP.y - this.carY
//     );

//     if (dist < this.waypointZoneRadius) {
//       const prevIndex = this.currentWaypointIndex;
//       this.currentWaypointIndex = (this.currentWaypointIndex + 1) % this.waypoints.length;
//       this.waypointStability.lastChangeTime = Date.now();
//       // console.log(`[AI] WP ${prevIndex} -> ${this.currentWaypointIndex}`);
//     }
//   }

//   _detectStuck(dt) {
//     const currentPos = { x: this.carX, y: this.carY };
//     this.stuckDetector.positionTimer += dt;

//     if (this.stuckDetector.positionTimer >= 3.0) { // Zwiększono czas
//       const distMoved = Math.hypot(
//         currentPos.x - this.stuckDetector.lastPosition.x,
//         currentPos.y - this.stuckDetector.lastPosition.y
//       );

//       if (distMoved < this.stuckDetector.minMovementDistance) {
//         this.stuckDetector.stuckTime += 3.0;
//         console.log(`[AI] STUCK! Moved ${distMoved.toFixed(0)}px, stuck for ${this.stuckDetector.stuckTime}s`);

//         if (this.stuckDetector.stuckTime >= 6.0) { // Po 6 sekundach
//           // Dodaj obecne miejsce jako strefę niebezpieczną
//           this._addDangerZone(this.carX, this.carY);
//           this._enterDesperateMode();
//           this.stuckDetector.stuckTime = 0; // Reset
//         }
//       } else {
//         this.stuckDetector.stuckTime = 0; // Reset jeśli się rusza
//       }

//       this.stuckDetector.lastPosition = { ...currentPos };
//       this.stuckDetector.positionTimer = 0;
//     }
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
//         mode: this.desperateMode ? 'DESPERATE' :
//           this.recoveryMode ? `REC-${this.recoveryAttempts}-${this.recoveryPhase}` : 'DRIVE',
//         steer: this.steerCommand.toFixed(2),
//         stuck: this.stuckDetector.stuckTime.toFixed(1),
//         dangers: this.dangerZones.length
//       };

//       console.log('[AI]', JSON.stringify(debugInfo));
//       this.debugTimer = 0;
//     }
//   }

//   handleCollision(prevX, prevY, worldW, worldH) {
//     super.handleCollision(prevX, prevY, worldW, worldH);

//     // Dodaj miejsce kolizji jako strefę niebezpieczną
//     this._addDangerZone(this.carX, this.carY);

//     // Sprawdź czy to powtarzająca się kolizja w tym samym obszarze
//     const recentCollisionsInArea = this.dangerZones.filter(zone => {
//       const dist = Math.hypot(this.carX - zone.x, this.carY - zone.y);
//       const timeDiff = Date.now() - zone.time;
//       return dist < this.dangerZoneRadius && timeDiff < 10000; // 10 sekund
//     });

//     if (recentCollisionsInArea.length >= 2) {
//       console.log(`[AI] Repeated collisions in area! Entering desperate mode`);
//       this._enterDesperateMode();
//       // Pomiń więcej waypointów przy powtarzających się kolizjach
//       this.currentWaypointIndex = (this.currentWaypointIndex + this.desperateSkipDistance * 2) % this.waypoints.length;
//     } else {
//       console.log(`[AI] Collision! Starting recovery (${this.dangerZones.length} danger zones)`);
//       this._startSmartRecovery();
//     }
//   }

//   getDebugInfo() {
//     const state = this.getFullState();
//     return {
//       wp: `${this.currentWaypointIndex}/${this.waypoints.length}`,
//       angle: this.debugAngle.toFixed(0) + '°',
//       speed: state.speed.toFixed(0),
//       mode: this.desperateMode ? 'DESP' :
//         this.recoveryMode ? `REC${this.recoveryAttempts}` : 'OK',
//       stuck: this.stuckDetector.stuckTime > 0 ? `${this.stuckDetector.stuckTime.toFixed(0)}s` : '',
//       zones: this.dangerZones.length > 0 ? `D${this.dangerZones.length}` : ''
//     };
//   }

//   resetState(initialX, initialY) {
//     // Wywołaj reset stanu bazowej klasy Car
//     super.resetState(initialX, initialY);

//     // Zresetuj indeks waypointa
//     this.currentWaypointIndex = 0;

//     // Zresetuj parametry sterowania i stan
//     this.steerCommand = 0;
//     this.debugAngle = 0;

//     // Zresetuj detektor utknięcia
//     this.stuckDetector.stuckTime = 0;
//     this.stuckDetector.positionTimer = 0;
//     this.stuckDetector.lastPosition = { x: initialX, y: initialY }; // Ustaw na nowej pozycji

//     // Zresetuj tryb recovery
//     this.recoveryMode = false;
//     this.recoveryTimer = 0;
//     this.recoveryPhase = 'reverse';
//     this.recoveryAttempts = 0;

//     // Wyczyść strefy niebezpieczne
//     this.dangerZones = [];

//     // Zresetuj tryb desperacki
//     this.desperateMode = false;
//     this.desperateModeTimer = 0;

//     // Zresetuj timery debugowania i stabilizacji
//     this.debugTimer = 0;
//     this.waypointStability.lastChangeTime = 0;

//     // Zatrzymaj auto fizycznie, aby nie "cofało" się po restarcie
//     this.body.setVelocity(0, 0);
//     this.body.setAngularVelocity(0);
//   }
// }













import { Car } from "./car.js";

export class AICar extends Car {
  constructor(scene, carSprite, worldData, waypoints) {
    super(scene, carSprite, worldData);
    this.waypoints = waypoints;
    this.currentWaypointIndex = 0;
    this.recoverySubPhase = 'normal';
    this.recoverySteer = 0;
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
    // this._updateDebug(dt, state);

    // Aktualizuj tryb desperacki
    this._updateDesperateMode(dt);

    // Wyczyść stare strefy niebezpieczne
    this._cleanupDangerZones();

    // Wykryj utknięcie
    this._detectStuck(dt);

    // Tryb recovery
    if (this.recoveryMode) {
      const recoveryControl = this._handleSmarterRecovery(dt, state);
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
      // console.log(`[AI] SLIDE! v_y=${state.v_y.toFixed(0)}`);
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
    // Najpierw sprawdź czy obecny waypoint jest bezpieczny
    const currentWP = this.waypoints[this.currentWaypointIndex];
    if (!this._isWaypointInDangerZone(currentWP)) {
      return currentWP; // Jeśli obecny waypoint jest OK, używaj go
    }

    // Szukaj bezpiecznego waypointa z ograniczeniem przeskoku
    const maxSkip = 3; // Nie przeskakuj więcej niż 3 waypointy naprzód

    for (let i = 1; i <= maxSkip; i++) {
      const index = (this.currentWaypointIndex + i) % this.waypoints.length;
      const wp = this.waypoints[index];

      // Sprawdź czy waypoint nie jest w strefie niebezpiecznej
      if (!this._isWaypointInDangerZone(wp)) {
        // Sprawdź czy waypoint jest "przed" samochodem (kąt)
        const angleToWP = Math.atan2(wp.y - this.carY, wp.x - this.carX);
        const angleDiff = Math.abs(this._normalizeAngle(angleToWP - this.getAngle()));

        // Akceptuj tylko waypoint, który jest "przed" samochodem (±45 stopni)
        if (angleDiff < 0.8) {
          console.log(`[AI] Skipping to safe WP ${index} (${i} ahead)`);
          this.currentWaypointIndex = index;
          this.waypointStability.lastChangeTime = Date.now();
          return wp;
        }
      }
    }

    // Jeśli nie znaleziono bezpiecznego waypointa w przód, zostań przy obecnym
    console.log('[AI] No safe WP found ahead, sticking to current');
    return currentWP;
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
    // W trybie desperackim nie przeskakujemy za daleko
    // Użyjmy dynamicznego lookahead bazującego na prędkości
    const lookahead = Math.max(1, Math.min(3, Math.floor(state.speed / 60)));
    const targetIndex = (this.currentWaypointIndex + lookahead) % this.waypoints.length;
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

_handleSmarterRecovery(dt, state) {
    this.recoveryTimer -= dt;

    if (this.recoveryTimer <= 0 || this.recoveryAttempts > this.maxRecoveryAttempts) {
        console.log('[AI] Recovery FAILED - timeout or max attempts reached. Entering desperate mode.');
        this.recoveryMode = false;
        this.recoveryAttempts = 0;
        this.recoverySubPhase = 'normal';
        this._enterDesperateMode();
        return { left: false, right: false, up: false, down: false };
    }

    // --- FAZA 1: COFANIE Z KOREKTĄ KURSU ---
    if (this.recoverySubPhase === 'reverse') {
        // Dynamiczne dostosowanie sterowania cofania
        const reverseThrottle = 0.5;
        const angleToPrevWp = Math.atan2(
            this.waypoints[(this.currentWaypointIndex - 1 + this.waypoints.length) % this.waypoints.length].y - this.carY,
            this.waypoints[(this.currentWaypointIndex - 1 + this.waypoints.length) % this.waypoints.length].x - this.carX
        );
        const angleDiff = this._normalizeAngle(angleToPrevWp - state.carAngle);
        
        // Skręć w kierunku poprzedniego waypointa
        this.recoverySteer = Phaser.Math.Clamp(angleDiff * 0.5, -0.3, 0.3);

        // Jeśli samochód się rusza do tyłu lub stoi, przejdź do wyprostowania
        if (state.speed < 2 || Math.abs(state.speed) < 5) {
            this.recoverySubPhase = 'reorient';
            this.recoveryTimer = 1.5;
            return { left: false, right: false, up: false, down: false };
        }

        return {
            left: this.recoverySteer < -0.01,
            right: this.recoverySteer > 0.01,
            up: false,
            down: true
        };
    }
    // --- FAZA 2: WYPROSTOWYWANIE SIĘ ---
    else if (this.recoverySubPhase === 'reorient') {
        const targetWP = this.waypoints[this.currentWaypointIndex];
        const angleToTarget = Math.atan2(targetWP.y - this.carY, targetWP.x - this.carX);
        const angleDiff = this._normalizeAngle(angleToTarget - state.carAngle);
        
        const steer = Phaser.Math.Clamp(angleDiff * 0.3, -0.2, 0.2);
        
        if (this.recoveryTimer <= 0 || Math.abs(angleDiff) < 0.3) {
            this.recoveryMode = false;
            return { left: false, right: false, up: true, down: false };
        }

        return {
            left: steer < -0.01,
            right: steer > 0.01,
            up: Math.abs(angleDiff) < 0.5,
            down: false
        };
    }

    return { left: false, right: false, up: false, down: false };
}

  // ZASTĄP SWOJĄ FUNKCJĘ _startSmartRecovery TA WERSJĄ:
  _startSmartRecovery() {
    // Definiuj localny state bezpośrednio w tej funkcji
    const state = this.getFullState();

    this.recoveryMode = true;
    this.recoverySubPhase = 'reverse'; // Zacznij od cofania
    this.recoveryTimer = 1.5; // Czas na cofnięcie
    this.recoveryAttempts++;

    console.log(`[AI] Recovery STARTED (phase: reverse, attempt ${this.recoveryAttempts})`);

    // Heurystyka cofania w zależności od aktualnego stanu
    // Używamy v_y (lateral velocity) lub ogólnego kierunku ruchu z state
    const currentSpeed = Math.hypot(state.v_x, state.v_y);
    if (currentSpeed > 10) {
      // Jeśli porusza się, spróbuj cofnięcia ze skosem przeciwnym do kąta
      this.recoverySteer = -Math.sign(state.carAngle);
    } else {
      // Jeśli auto stoi, cofaj prosto
      this.recoverySteer = 0;
    }

    // Zresetuj detektory utknięcia
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
      // console.log(`[AI] WP ${prevIndex} -> ${this.currentWaypointIndex}`);
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

      // Ograniczony przeskok waypointów - tylko +2, nie więcej
      this.currentWaypointIndex = (this.currentWaypointIndex + 2) % this.waypoints.length;
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

  resetState(initialX, initialY) {
    // Wywołaj reset stanu bazowej klasy Car
    super.resetState(initialX, initialY);

    // Zresetuj indeks waypointa
    this.currentWaypointIndex = 0;

    // Zresetuj parametry sterowania i stan
    this.steerCommand = 0;
    this.debugAngle = 0;

    // Zresetuj detektor utknięcia
    this.stuckDetector.stuckTime = 0;
    this.stuckDetector.positionTimer = 0;
    this.stuckDetector.lastPosition = { x: initialX, y: initialY }; // Ustaw na nowej pozycji

    // Zresetuj tryb recovery
    this.recoveryMode = false;
    this.recoveryTimer = 0;
    this.recoveryPhase = 'reverse';
    this.recoveryAttempts = 0;

    // Wyczyść strefy niebezpieczne
    this.dangerZones = [];

    // Zresetuj tryb desperacki
    this.desperateMode = false;
    this.desperateModeTimer = 0;

    // Zresetuj timery debugowania i stabilizacji
    this.debugTimer = 0;
    this.waypointStability.lastChangeTime = 0;

    // Zatrzymaj auto fizycznie, aby nie "cofało" się po restarcie
    this.body.setVelocity(0, 0);
    this.body.setAngularVelocity(0);
  }
}
