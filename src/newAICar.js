// AICar.js
import { Car } from "./car.js";
import { AI_CONFIG } from "./ai_modules/ai-config.js";
import { Navigation } from "./ai_modules/Navigation.js";
import { DrivingLogic } from "./ai_modules/DrivingLogic.js";
import { StuckDetector } from "./ai_modules/StuckDetector.js";
import { DangerZoneManager } from "./ai_modules/DangerZoneManager.js";
import { RecoverySystem } from "./ai_modules/RecoverySystem.js";

export class AICar extends Car {
  constructor(scene, carSprite, worldData, waypoints) {
    super(scene, carSprite, worldData);

    // Inicjalizacja modułów AI z centralną konfiguracją
    this.navigation = new Navigation(waypoints, AI_CONFIG);
    this.drivingLogic = new DrivingLogic(AI_CONFIG);
    this.stuckDetector = new StuckDetector(AI_CONFIG);
    this.dangerZoneManager = new DangerZoneManager(AI_CONFIG);
    this.recoverySystem = new RecoverySystem(AI_CONFIG);
  }

  updateAI(dt, worldW, worldH) {
    const state = this.getFullState();
    const carPosition = { x: this.carX, y: this.carY };

    // 1. Aktualizuj moduły stanu
    this.dangerZoneManager.cleanup();
    this.stuckDetector.update(dt, carPosition);

    // 2. Sprawdź, czy trzeba zmienić zachowanie (behavior)
    if (this.stuckDetector.isStuck) {
      this.dangerZoneManager.add(this.carX, this.carY);
      this.recoverySystem.startDesperate(this.navigation);
      this.stuckDetector.reset(carPosition); // Resetuj detektor po reakcji
    }

    // 3. Pobierz sterowanie od aktywnego systemu
    let control;
    const specialControls = this.recoverySystem.update(dt, state, this.navigation);

    if (specialControls) {
      // Samochód jest w trybie RECOVERY lub DESPERATE
      control = specialControls;
    } else {
      // Normalna jazda
      this.navigation.updateWaypointCompletion(this.carX, this.carY);
      const target = this.navigation.getSafeTarget(this, this.dangerZoneManager);
      const inDanger = this.dangerZoneManager.isPointInDanger(carPosition);
      control = this.drivingLogic.calculateControls(state, target, inDanger);
    }
    
    // 4. Zastosuj sterowanie
    this.update(dt, control, worldW, worldH);
  }

  handleCollision(prevX, prevY, worldW, worldH) {
    super.handleCollision(prevX, prevY, worldW, worldH);

    this.dangerZoneManager.add(this.carX, this.carY);

    const collisionsInArea = this.dangerZoneManager.getCollisionsInZone(this.carX, this.carY);
    
    if (collisionsInArea >= AI_CONFIG.DANGER_ZONE_COLLISION_THRESHOLD_FOR_DESPERATE) {
        console.log(`[AICar] Repeated collisions (${collisionsInArea}). Triggering desperate mode.`);
        this.recoverySystem.startDesperate(this.navigation);
    } else {
        console.log(`[AICar] Collision! Triggering recovery.`);
        this.recoverySystem.startRecovery();
    }
  }

  resetState(initialX, initialY) {
    super.resetState(initialX, initialY);

    // Zresetuj stan wszystkich modułów
    this.navigation.reset();
    this.stuckDetector.reset({ x: initialX, y: initialY });
    this.dangerZoneManager.reset();
    this.recoverySystem.reset();
    
    this.body.setVelocity(0, 0);
    this.body.setAngularVelocity(0);
  }

  getDebugInfo() {
      // Można by rozbudować o informacje z modułów
      return {
          wp: `${this.navigation.currentWaypointIndex}/${this.navigation.waypoints.length}`,
          mode: this.recoverySystem.getBehavior(),
          zones: this.dangerZoneManager.zones.length,
      };
  }
}