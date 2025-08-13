// ai_modules/RecoverySystem.js
import { normalizeAngle } from "./utils.js";

const BEHAVIOR = {
  DRIVING: 'DRIVING',
  RECOVERY: 'RECOVERY',
  DESPERATE: 'DESPERATE',
};

export class RecoverySystem {
  constructor(config) {
    this.config = config;
    this.reset();
  }

  reset() {
    this.behavior = BEHAVIOR.DRIVING;
    this.timer = 0;
    this.phase = 'none';
    this.attempts = 0;
  }

  // --- Publiczne metody do zmiany stanu ---

  startRecovery() {
    if (this.behavior === BEHAVIOR.DESPERATE) return; // Nie przerywaj trybu desperackiego
    
    this.behavior = BEHAVIOR.RECOVERY;
    this.phase = 'reverse';
    this.timer = this.config.RECOVERY_REVERSE_TIME;
    this.attempts++;
    console.log(`[Recovery] Started (Attempt ${this.attempts})`);
  }

  startDesperate(navigation) {
    this.behavior = BEHAVIOR.DESPERATE;
    this.timer = this.config.DESPERATE_MODE_DURATION;
    navigation.skipWaypoints(this.config.DESPERATE_MODE_SKIP_WAYPOINTS);
    console.log('[Recovery] DESPERATE MODE ACTIVATED');
  }

  // --- Główna pętla aktualizacji ---

  update(dt, state, navigation) {
    if (this.behavior === BEHAVIOR.DRIVING) return null;

    this.timer -= dt;

    if (this.timer <= 0) {
        if (this.behavior === BEHAVIOR.RECOVERY) {
            // Jeśli recovery się nie udało, przejdź w tryb desperacki
            if (this.attempts > this.config.RECOVERY_MAX_ATTEMPTS) {
                console.log('[Recovery] FAILED. Entering desperate mode.');
                this.startDesperate(navigation);
                return this.getDesperateControls(state, navigation);
            }
        }
        console.log(`[Recovery] Mode ${this.behavior} ended. Returning to DRIVING.`);
        this.reset();
        return null; // Koniec trybu, wróć do normalnej jazdy
    }
    
    // Zwróć odpowiednie sterowanie dla aktywnego trybu
    if (this.behavior === BEHAVIOR.RECOVERY) {
        return this.getRecoveryControls(state, navigation);
    }
    if (this.behavior === BEHAVIOR.DESPERATE) {
        return this.getDesperateControls(state, navigation);
    }
    return null;
  }

  // --- Logika sterowania dla poszczególnych trybów ---
  
  getRecoveryControls(state, navigation) {
      // Prosta logika: cofaj ze skrętem w stronę drogi
      const targetWP = navigation.getCurrentWaypoint();
      const angleToTarget = Math.atan2(targetWP.y - state.carY, targetWP.x - state.carX);
      const angleDiff = normalizeAngle(angleToTarget - state.carAngle);
      
      const steer = Math.sign(angleDiff) * -1; // Cofaj, skręcając w przeciwną stronę
      
      return { left: steer < 0, right: steer > 0, up: false, down: true };
  }

  getDesperateControls(state, navigation) {
      // Prosta jazda do przodu w kierunku celu, bez finezji
      const targetWP = navigation.getCurrentWaypoint();
      const angleToTarget = Math.atan2(targetWP.y - state.carY, targetWP.x - state.carX);
      const angleDiff = normalizeAngle(angleToTarget - state.carAngle);
      
      const steer = Phaser.Math.Clamp(angleDiff * 0.5, -0.2, 0.2);

      return { left: steer < -0.01, right: steer > 0.01, up: true, down: false };
  }

  getBehavior() {
      return this.behavior;
  }
}