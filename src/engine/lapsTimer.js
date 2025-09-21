export class LapsTimer {
    constructor(scene, gameMode = "PRACTICE", totalLaps = 3) {
        this.scene = scene;
        this.gameMode = gameMode;
        this.totalLaps = gameMode === "PRACTICE" ? 100 : totalLaps;
        
        // Stan okrążeń
        this.currentLap = 0;
        this.raceFinished = false;
        this.timerStarted = false;
        
        // Dane czasów
        this.lapTimes = {
            total: 0,
            bestLap: 0,
            currentLapStart: 0,
            lapsCompleted: 0
        };
        
        // Logika checkpointów
        this.checkpoints = [];
        this.checkpointOrder = [1, 2, 3];
        this.expectedCheckpointIndex = 0;
        this._cpInside = new Map();
        this.hasCompletedFullLap = false;
        
        // HUD elementy
        this.lapsText = null;
        this.lapTimerText = null;
        
        this.initializeHUD();
    }
    
    initializeHUD() {
        const { width } = this.scene.sys.game.canvas;
        const dispLaps = this.gameMode === "RACE" ? `LAPS: ${this.currentLap}/${this.totalLaps}` : "LAPS: ∞";
        // HUD okrążeń
        this.lapsText = this.scene.add
            .text(width / 2, 10, dispLaps, {
                fontFamily: "Harting",
                fontSize: "50px",
                color: "#80e12aff",
                align: "center",
                backgroundColor: "rgb(31, 31, 31)",
                padding: { left: 115, right: 115, top: 4, bottom: 4 },
            })
            .setOrigin(0.5, 0)
            .setDepth(1000)
            .setShadow(3, 3, "#0f0", 4, false, true)
            .setScrollFactor(0);

        // HUD timera
        this.lapTimerText = this.scene.add
            .text(width / 2, 64, "TOTAL: 0.00s  BEST LAP: 0.00s", {
                fontFamily: "Harting",
                fontSize: "25px",
                color: "#80e12aff",
                align: "center",
                backgroundColor: "rgb(31, 31, 31)",
                padding: { left: 8, right: 8, top: 4, bottom: 4 },
            })
            .setOrigin(0.5, 0)
            .setDepth(1000)
            .setShadow(2, 2, "#0f0", 2, false, true)
            .setScrollFactor(0);
    }
    
    initializeCheckpoints(checkpointsData) {
        if (!Array.isArray(checkpointsData)) return;
        
        this.checkpoints = [...checkpointsData];
        this.checkpoints.sort((a, b) => a.id - b.id);
        this._cpInside = new Map(this.checkpoints.map((cp) => [cp.id, false]));
    }
    
    startTimer() {
        if (!this.timerStarted) {
            this.timerStarted = true;
            this.lapTimes.currentLapStart = 0;
        }
    }
    
    update(deltaTime) {
        // Aktualizacja timera
        if (this.timerStarted && !this.raceFinished) {
            this.lapTimes.total += deltaTime;
            this.updateLapTimerDisplay();
        }
    }
    
    checkpointUpdate(carPosition) {
        if (!this.checkpoints || this.checkpoints.length === 0) return;
        
        for (const cp of this.checkpoints) {
            const inside = carPosition.x >= cp.x && 
                          carPosition.x <= cp.x + cp.w && 
                          carPosition.y >= cp.y && 
                          carPosition.y <= cp.y + cp.h;
            const wasInside = this._cpInside.get(cp.id);

            if (inside && !wasInside) {
                const expectedId = this.checkpointOrder[this.expectedCheckpointIndex];

                if (cp.id === expectedId) {
                    this.expectedCheckpointIndex++;

                    // Jeśli przejechaliśmy wszystkie CP (1→2→3), ustaw flagę
                    if (this.expectedCheckpointIndex >= this.checkpointOrder.length) {
                        this.hasCompletedFullLap = true;
                        this.expectedCheckpointIndex = 0;
                    }

                    // Jeśli przejechaliśmy CP 1 PO pełnym okrążeniu (1→2→3→1)
                    if (cp.id === 1 && this.hasCompletedFullLap) {
                        if (this.currentLap < this.totalLaps) {
                            this.currentLap = Math.min(this.currentLap + 1, this.totalLaps);
                            this.updateLapsDisplay();
                            this.completeLap();

                            if (this.currentLap >= this.totalLaps) {
                                this.raceFinished = true;
                            }
                        }
                        this.hasCompletedFullLap = false;
                    }
                }
            }
            this._cpInside.set(cp.id, inside);
        }
    }
    
    completeLap() {
        if (this.raceFinished) return;

        const currentLapTime = this.lapTimes.total - this.lapTimes.currentLapStart;

        // Aktualizuj najlepszy czas
        if (this.lapTimes.bestLap === 0 || currentLapTime < this.lapTimes.bestLap) {
            this.lapTimes.bestLap = currentLapTime;
        }

        // Zresetuj czas rozpoczęcia okrążenia
        this.lapTimes.currentLapStart = this.lapTimes.total;
        this.updateLapTimerDisplay();
    }
    
    updateLapsDisplay() {
        const dispLaps = this.gameMode === "RACE" ? `LAPS: ${this.currentLap}/${this.totalLaps}` : "LAPS: ∞";
        if (this.lapsText) {
            this.lapsText.setText(dispLaps);
        }
    }
    
    updateLapTimerDisplay() {
        if (this.lapTimerText) {
            const totalTime = this.lapTimes.total.toFixed(2);
            const bestLapTime = this.lapTimes.bestLap > 0 ? this.lapTimes.bestLap.toFixed(2) : "0.00";
            this.lapTimerText.setText(`TOTAL: ${totalTime}s  BEST LAP: ${bestLapTime}s`);
        }
    }
    
    reset() {
        // Reset okrążeń i stanu
        this.currentLap = 0;
        this.expectedCheckpointIndex = 0;
        this.hasCompletedFullLap = false;
        this.timerStarted = false;
        this.raceFinished = false;

        // Reset timerów
        this.lapTimes = {
            total: 0,
            bestLap: 0,
            currentLapStart: 0,
            lapsCompleted: 0
        };

        // Aktualizuj wyświetlacze
        this.updateLapsDisplay();
        this.updateLapTimerDisplay();

        // Reset checkpointów
        if (this._cpInside) {
            for (const key of this._cpInside.keys()) {
                this._cpInside.set(key, false);
            }
        }
    }
    
    getHUDElements() {
        return [this.lapsText, this.lapTimerText];
    }
    
    // Gettery dla zewnętrznych modułów
    isRaceFinished() {
        return this.raceFinished;
    }
    
    isTimerStarted() {
        return this.timerStarted;
    }
    
    getCurrentLap() {
        return this.currentLap;
    }
    
    getLapTimes() {
        return { ...this.lapTimes };
    }
}