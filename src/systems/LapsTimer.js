export class LapsTimer {
    constructor(scene, gameMode = "PRACTICE", totalLaps) {
        this.scene = scene;
        this.gameMode = gameMode;
        this.totalLaps = gameMode === "PRACTICE" ? 100 : totalLaps;

        this.currentLap = 0;
        this.raceFinished = false;
        this.timerStarted = false;

        this.lapTimes = {
            total: 0,
            bestLap: 0,
            currentLapStart: 0,
            lapsCompleted: 0
        };

        this.checkpoints = [];
        this.checkpointOrder = [1, 2, 3];
        this.expectedCheckpointIndex = 0;
        this._cpInside = new Map();
        this.hasCompletedFullLap = false;

        this.lapsText = null;
        this.lapTimerMainText = null;
        this.bestLapText = null;

        this._hudUpdateAccumulator = 0;
        this._hudUpdateInterval = 1 / 30;

        this.initializeHUD();
    }

    initializeHUD() {
        const { width } = this.scene.sys.game.canvas;
        const dispLaps = this.gameMode === "RACE" ? `LAPS:${this.currentLap}/${this.totalLaps}` : "LAPS: ∞";

        this.lapsText = this.scene.add.text(width / 2, 10, dispLaps, {
            fontFamily: "Harting",
            fontSize: "55px",
            color: "#63db00ff",
            align: "center",
            backgroundColor: "rgba(22, 72, 10,0.67)",
            padding: { left: 12, right: 12, top: 4, bottom: -4 },
        })
        .setOrigin(0.5, 0)
        .setDepth(1000)
        .setShadow(3, 3, "#1d1d1dff", 2, false, true)
        .setScrollFactor(0);

        this.lapTimerMainText = this.scene.add.text(width / 2, 72, "", {
            fontFamily: "Harting",
            fontSize: "25px",
            color: "#63db00ff",
            align: "center",
            backgroundColor: "rgba(22, 72, 10,0.67)",
            padding: { left: 6, right: 8, top: 0, bottom: 4 },
        })
        .setOrigin(0.5, 0)
        .setDepth(1000)
        .setShadow(2, 2, "#333", 1, false, true)
        .setScrollFactor(0);

        this.bestLapText = this.scene.add.text(width / 2, 72 + 32, "BEST LAP: 0:00'00\"", {
            fontFamily: "Harting",
            fontSize: "20px",
            color: "#63db00ff",
            align: "center",
            backgroundColor: "rgba(22, 72, 10,0.67)",
            padding: { left: 13, right: 15, top: 4, bottom: 4 },
        })
        .setOrigin(0.5, 0)
        .setDepth(1000)
        .setShadow(2, 2, "#333", 1, false, true)
        .setScrollFactor(0);
        // this.speedText = this.scene.add.text(width / 2, 72 + 32 + 28, "000 km/h", {
        //     fontFamily: "Harting",
        //     fontSize: "22px",
        //     color: "#63db00ff",
        //     align: "center",
        //     backgroundColor: "rgba(22, 72, 10,0.67)",
        //     padding: { left: 10, right: 10, top: 4, bottom: 4 },
        // })
        // .setOrigin(0.5, 0)
        // .setDepth(1000)
        // .setShadow(2, 2, "#333", 1, false, true)
        // .setScrollFactor(0);
        this.updateLapTimerDisplay();
    }

    msToStandardTime(ms) {
        const totalMs = Math.floor(ms);
        const hours = Math.floor(totalMs / 3600000);
        const minutes = Math.floor((totalMs % 3600000) / 60000);
        const seconds = Math.floor((totalMs % 60000) / 1000);
        const centiseconds = Math.floor((totalMs % 1000) / 10);

        return `${hours}:${minutes.toString().padStart(2, '0')}'${seconds.toString().padStart(2, '0')}"${centiseconds.toString().padStart(2, '0')}`;
    }   

    updateLapTimerDisplay() {
        // użyj helpera dla całkowitego czasu
        const totalMs = Math.floor(this.lapTimes.total * 1000);
        const formattedMain = this.msToStandardTime(totalMs);
        this._totalFormatted = formattedMain;
        if (this.lapTimerMainText) {
            this.lapTimerMainText.setText(`TOTAL: ${formattedMain}`);
        }

        // BEST LAP: użyj tej samej funkcji pomocniczej
        if (this.bestLapText) {
            const best = this.lapTimes.bestLap;
            if (best && best > 0) {
                const bestMs = Math.floor(best * 1000);
                const formattedBest = this.msToStandardTime(bestMs);
                this.bestLapText.setText(`BEST LAP: ${formattedBest}`);
            } else {
                this.bestLapText.setText(`BEST LAP: 0:00'00"00`);
            }
        }
    }
    
    updateLapsDisplay() {
        const dispLaps = this.gameMode === "RACE" ? `LAPS:${this.currentLap}/${this.totalLaps}` : "LAPS: ∞";
        if (this.lapsText) {
            this.lapsText.setText(dispLaps);
        }
    }

    update(deltaTime) {
        if (this.timerStarted && !this.raceFinished) {
            this.lapTimes.total += deltaTime;

            this._hudUpdateAccumulator += deltaTime;
            if (this._hudUpdateAccumulator >= this._hudUpdateInterval) {
                this.updateLapTimerDisplay();
                // this.updateSpeedDisplay();   // 🔽 aktualizacja prędkości
                this._hudUpdateAccumulator = 0;
            }
        }
    }
    // updateSpeedDisplay() {
    //     if (!this.speedText) return;
    
    //     const state = this.scene.carController.getFullState();
    //     const speed = state.speed * (169 / 450) || 0;
    
    //     // format 000 km/h
    //     const formatted = speed.toFixed(0).padStart(3, "0");
    //     this.speedText.setText(`${formatted} km/h`);
    // }
    
    startTimer() {
        if (!this.timerStarted) {
            this.timerStarted = true;
            this.lapTimes.currentLapStart = 0;
        }
    }

    completeLap() {
        if (this.raceFinished) return;

        const currentLapTime = this.lapTimes.total - this.lapTimes.currentLapStart;

        if (this.lapTimes.bestLap === 0 || currentLapTime < this.lapTimes.bestLap) {
            this.lapTimes.bestLap = currentLapTime;
        }

        this.lapTimes.currentLapStart = this.lapTimes.total;
        this.updateLapTimerDisplay();
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

                    if (this.expectedCheckpointIndex >= this.checkpointOrder.length) {
                        this.hasCompletedFullLap = true;
                        this.expectedCheckpointIndex = 0;
                    }

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

    initializeCheckpoints(checkpointsData) {
        if (!Array.isArray(checkpointsData)) return;

        this.checkpoints = [...checkpointsData];
        this.checkpoints.sort((a, b) => a.id - b.id);
        this._cpInside = new Map(this.checkpoints.map((cp) => [cp.id, false]));
    }

    reset() {
        this.currentLap = 0;
        this.expectedCheckpointIndex = 0;
        this.hasCompletedFullLap = false;
        this.timerStarted = false;
        this.raceFinished = false;

        this.lapTimes = {
            total: 0,
            bestLap: 0,
            currentLapStart: 0,
            lapsCompleted: 0
        };

        this._hudUpdateAccumulator = 0;

        this.updateLapsDisplay();
        this.updateLapTimerDisplay();

        if (this._cpInside) {
            for (const key of this._cpInside.keys()) {
                this._cpInside.set(key, false);
            }
        }
    }

    getHUDElements() {
        return [this.lapsText, this.lapTimerMainText, this.bestLapText];
    }

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
