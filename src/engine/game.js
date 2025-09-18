import { CameraManager } from "../cameras/cameras.js";
import { PlayerCar } from "../vehicles/PlayerCar.js";
import { World } from "./world.js";
import { tileSize } from "../app/main.js";
import { SkidMarks } from "../rendering/skidMarks.js";
import { preloadWorldTextures } from "./textureManager.js";
import { getControlState } from "../input/controlsManager.js";
import { updateSkidMarks } from "./skidMarksManager.js";
import { createKeyboardBindings } from "../input/keyboardManager.js";
import { createHUD } from "../ui/hudManager.js";
import { AICar } from "../ai/AICar.js";
import { CountdownManager } from "./countdownManager.js";

let skidMarks = null;
let skidMarksAI = null;
let skidMarksEnabled = true;

export class GameScene extends window.Phaser.Scene {
	constructor() {
		super({ key: "GameScene" });
		this.minimapa = true;
		this.gameMode = "PRACTICE";
	}

	isMobile() {
		return /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop|Mobile/i.test(navigator.userAgent);
	}

	init(data) {
		this.worldData = data.worldData;
		this.gameMode = data.gameMode || "PRACTICE";
		window._worldData = data.worldData;
		if (this.gameMode === "PRACTICE") this.aiController = null;
	}

	preload() {
		if (window._worldData?.tiles) {
			preloadWorldTextures(this, window._worldData.tiles, tileSize);
		}
		this.load.image("car_p1", "assets/images/car.png");
		this.load.image("car_p2", "assets/images/car_X.png");
	}

	async create() {
		const worldData = this.worldData || window._worldData;
		const viewW = this.sys.game.config.width;
		const viewH = this.sys.game.config.height;
		const start = worldData.startPos;
		const startYOffset = 0;

		this.car = this.physics.add.sprite(start.x, start.y + startYOffset, "car_p1");
		this.car.setOrigin(0.5).setDepth(2);
		this.car.body.allowRotation = false;

		this.carController = new PlayerCar(this, this.car, worldData, 1);
		this.carController.resetState(start.x, start.y + startYOffset);

		const twoPlayers = !!worldData?.twoPlayers;
		if (!twoPlayers && this.gameMode === "RACE" && this.worldData.waypoints?.length > 0) {
			const aiStart = this.worldData.waypoints[0];
			const aiStartYOffset = 0;

			this.aiCarSprite = this.physics.add.sprite(aiStart.x, aiStart.y + aiStartYOffset, "car_p2");
			this.aiCarSprite.setOrigin(0.5).setDepth(2);
			this.aiCarSprite.body.allowRotation = false;

			this.aiController = new AICar(this, this.aiCarSprite, this.worldData, this.worldData.waypoints);
			this.aiController.resetState(aiStart.x, aiStart.y + aiStartYOffset);

			skidMarksAI = new SkidMarks({ enabled: skidMarksEnabled, wheelWidth: 12 });
			this.carController.opponentController = this.aiController;
			this.aiController.opponentController = this.carController;
		} else if (twoPlayers) {
			const p2YOffset = 0;
			this.p2CarSprite = this.physics.add.sprite(start.x, start.y + p2YOffset, "car_p2");
			this.p2CarSprite.setOrigin(0.5).setDepth(2);
			this.p2CarSprite.body.allowRotation = false;

			this.p2Controller = new PlayerCar(this, this.p2CarSprite, worldData, 2);
			this.p2Controller.resetState(start.x, start.y + p2YOffset);

			skidMarksAI = new SkidMarks({ enabled: skidMarksEnabled, wheelWidth: 12 });
			this.carController.opponentController = this.p2Controller;
			this.p2Controller.opponentController = this.carController;
		}

		const keys = createKeyboardBindings(this);
		this.cursors = keys.cursors;
		this.wasdKeys = keys.wasdKeys;
		this.vKey = keys.vKey;
		this.rKey = keys.rKey;
		this.xKey = keys.xKey;

		this.cameraManager = new CameraManager(this, this.car, worldData.worldSize);
		this.hudInfoText = createHUD(this, this.isMobile(), this.cameraManager);

		// ✅ LAPS HUD
		this.totalLaps = 3;
		this.currentLap = 0;
		const { width } = this.sys.game.canvas;
		// const dispLaps = this.gameMode === "RACE" ? `LAPS: ${this.currentLap}/${this.totalLaps}` : "LAPS: ∞";
		this.lapsText = this.add
			.text(width / 2, 10, `LAPS: ${this.currentLap}/${this.totalLaps}`, {
				fontFamily: "Harting",
				fontSize: "50px",
				color: "#80e12aff",
				align: "center",
				backgroundColor: "rgb(31, 31, 31)",
				padding: { left: 8, right: 8, top: 4, bottom: 4 },
			})
			.setOrigin(0.5, 0)
			.setDepth(1000)
			.setShadow(3, 3, "#0f0", 4, false, true)
			.setScrollFactor(0);

		// ✅ TIMER HUD - dodanie timera okrążeń
		this.lapTimes = {
			total: 0,
			bestLap: 0,
			currentLapStart: 0,
			lapsCompleted: 0
		};

		this.lapTimerText = this.add
			.text(width / 2, 90, "TOTAL: 0.00s  BEST LAP: 0.00s", {
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

		// Zgrupuj elementy HUD do jednej referencji przekazywanej do kamery HUD
		if (this.isMobile()) {
			this.control = this.hudInfoText; // obiekt sterowania
			this.hudRoot = this.add.container(0, 0, [this.lapsText, this.lapTimerText]);
		} else {
			this.hudRoot = this.add.container(0, 0, [this.hudInfoText, this.lapsText, this.lapTimerText]);
			this.cameras.main.ignore([this.hudRoot]);
		}

		this.world = new World(this, worldData, tileSize, viewW, viewH);
		if (worldData.worldSize) this.worldSize = worldData.worldSize;

		if (this.minimapa) {
			await this.world.initMinimap(worldData.svgPath, this.hudRoot);
		} else {
			const hudObjects = [this.hudRoot];
			this.hudCamera = this.cameras.add(0, 0, viewW, viewH, false, "hud");
			this.cameras.main.ignore(hudObjects);
			this.hudCamera.ignore(this.children.list.filter((obj) => !hudObjects.includes(obj)));
			this.hudCamera.setScroll(0, 0);
			this.hudCamera.setRotation(0);
		}

		window.dispatchEvent(new Event("game-ready"));
		skidMarks = new SkidMarks({ enabled: skidMarksEnabled, wheelWidth: 12 });

		// ✅ Inicjalizacja countdown managera
		this.countdown = new CountdownManager(this);
		this.countdown.start();

		this.checkpoints = Array.isArray(worldData.checkpoints) ? [...worldData.checkpoints] : [];
		this.checkpoints.sort((a, b) => a.id - b.id); // Upewniamy się, że są w kolejności 1, 2, 3
		this.checkpointOrder = [1, 2, 3]; // Jawne ustawienie kolejności (1 → 2 → 3 → 1...)
		this.expectedCheckpointIndex = 0; // Oczekujemy najpierw CP 1
		this._cpInside = new Map(this.checkpoints.map((cp) => [cp.id, false]));
		this.hasCompletedFullLap = false; // Czy gracz przejechał już 1→2→3?
		this.timerStarted = false; // ✅ Czy timer został uruchomiony
		this.raceFinished = false; // Flaga zakończenia wyścigu
	}

	update(time, dt) {
		dt /= 1000;

		// ✅ Sprawdź czy countdown się skończył i uruchom timer
		const countdownWasActive = this.countdown?.isActive();
		if (this.countdown?.isActive()) {
			this.countdown.update(dt);
		}

		// ✅ Uruchom timer od razu po zakończeniu countdownu
		if (countdownWasActive && !this.countdown?.isActive() && !this.timerStarted) {
			this.timerStarted = true;
			this.lapTimes.currentLapStart = 0; // Pierwsze okrążenie zaczyna się od 0
		}

		if (this.vKey && window.Phaser.Input.Keyboard.JustDown(this.vKey)) this.cameraManager.toggle();
		if (this.rKey && window.Phaser.Input.Keyboard.JustDown(this.rKey)) this.resetGame();
		if (this.xKey && window.Phaser.Input.Keyboard.JustDown(this.xKey)) this.exitToMenu();

		const control = getControlState(this);
		if (this.countdown?.isActive()) {
			control.up = false;
			control.down = false;
		}

		this.carController.update(dt, control, this.worldSize, this.worldSize);

		// ✅ Aktualizacja timera okrążeń - liczy od razu po countdown
		if (this.timerStarted && !this.raceFinished) {
			this.lapTimes.total += dt;
			this.updateLapTimer();
		}

		if (this.checkpoints && this.checkpoints.length > 0) {
			const pos = this.carController.getPosition();
			for (const cp of this.checkpoints) {
				const inside = pos.x >= cp.x && pos.x <= cp.x + cp.w && pos.y >= cp.y && pos.y <= cp.y + cp.h;
				const wasInside = this._cpInside.get(cp.id);

				if (inside && !wasInside) {
					const expectedId = this.checkpointOrder[this.expectedCheckpointIndex];

					if (cp.id === expectedId) {
						// Gracz przejechał oczekiwany checkpoint
						this.expectedCheckpointIndex++;

						// Jeśli przejechaliśmy wszystkie CP (1→2→3), ustaw flagę
						if (this.expectedCheckpointIndex >= this.checkpointOrder.length) {
							this.hasCompletedFullLap = true;
							this.expectedCheckpointIndex = 0; // Resetujemy, by oczekiwać znowu CP 1
						}

						// Jeśli przejechaliśmy CP 1 **PO** pełnym okrążeniu (1→2→3→1)
						if (cp.id === 1 && this.hasCompletedFullLap) {
							// Sprawdź czy to nie jest ostatnie okrążenie
							if (this.currentLap < this.totalLaps) {
								this.currentLap = Math.min(this.currentLap + 1, this.totalLaps);
								this.lapsText.setText(`LAPS: ${this.currentLap}/${this.totalLaps}`);

								// Aktualizacja czasu okrążenia
								this.updateLapTime();

								// Sprawdź czy to było ostatnie okrążenie
								if (this.currentLap >= this.totalLaps) {
									this.raceFinished = true;
								}
							}

							this.hasCompletedFullLap = false; // Resetujemy flagę
						}
					}
				}
				this._cpInside.set(cp.id, inside);
			}
		}

		if (this.p2Controller) {
			const control2 = {
				up: this.cursors.up.isDown,
				down: this.cursors.down.isDown,
				left: this.cursors.left.isDown,
				right: this.cursors.right.isDown,
			};
			if (this.countdown?.isActive()) {
				control2.up = false;
				control2.down = false;
			}
			this.p2Controller.update(dt, control2, this.worldSize, this.worldSize);
		}

		if (this.aiController) {
			if (this.countdown?.isActive()) {
				this.aiController.throttleLock = true;
			}
			this.aiController.updateAI(dt, this.worldSize, this.worldSize);
		}

		const carPos = this.carController.getPosition();
		const aiCarPos = this.aiController ? this.aiController.getPosition() : this.p2Controller ? this.p2Controller.getPosition() : null;
		this.world.drawTiles(carPos.x, carPos.y);

		if (skidMarks?.enabled) {
			const skidMarksList = [{ controller: this.carController, skidMarks: skidMarks }];
			if (this.aiController && skidMarksAI) skidMarksList.push({ controller: this.aiController, skidMarks: skidMarksAI });
			if (this.p2Controller && skidMarksAI) skidMarksList.push({ controller: this.p2Controller, skidMarks: skidMarksAI });

			updateSkidMarks(this, tileSize, skidMarksList);
		}

		if (this.minimapa && this.world) {
			this.world.drawMinimap(aiCarPos, carPos, this.worldSize, this.worldSize);
		}

		this.cameraManager?.update(dt);

		if (this.hudCamera) this.hudCamera.setRotation(0);
		if (this.hudContainer) this.hudContainer.rotation = 0;
		if (this.gasBtn) this.gasBtn.rotation = 0;
		if (this.brakeBtn) this.brakeBtn.rotation = 0;
	}

	// Aktualizacja wyświetlacza czasu okrążeń
	updateLapTimer() {
		if (this.lapTimerText) {
			const currentLapTime = this.lapTimes.total - this.lapTimes.currentLapStart;
			const totalTime = this.lapTimes.total.toFixed(2);
			const bestLapTime = this.lapTimes.bestLap > 0 ? this.lapTimes.bestLap.toFixed(2) : "0.00";

			this.lapTimerText.setText(`TOTAL: ${totalTime}s  BEST LAP: ${bestLapTime}s`);
		}
	}

	// Aktualizacja czasu najlepszego okrążenia
	updateLapTime() {
		// Nie aktualizuj jeśli wyścig zakończony
		if (this.raceFinished) return;

		const currentLapTime = this.lapTimes.total - this.lapTimes.currentLapStart;

		// Aktualizuj najlepszy czas, jeśli jest lepszy lub to pierwsze okrążenie
		if (this.lapTimes.bestLap === 0 || currentLapTime < this.lapTimes.bestLap) {
			this.lapTimes.bestLap = currentLapTime;
		}

		// Zresetuj czas rozpoczęcia okrążenia
		this.lapTimes.currentLapStart = this.lapTimes.total;

		// Aktualizuj wyświetlacz
		this.updateLapTimer();
	}

	resetGame() {
		const worldData = this.worldData || window._worldData;
		const start = worldData.startPos;

		this.carController.resetState(start.x, start.y);

		if (this.aiController && this.worldData.waypoints?.length > 0) {
			const aiStart = this.worldData.waypoints[0];
			this.aiController.resetState(aiStart.x, aiStart.y);
		}

		if (this.world) {
			this.world.trackTiles = [];
			for (const tileObj of this.world.tilePool.values()) {
				tileObj.setVisible(false);
			}
		}

		this.cameraManager?.reset();
		skidMarks?.clear();
		if (skidMarksAI) {
			skidMarksAI.clear();
		}

		// Restart odliczania
		this.countdown.start();

		// ✅ Reset okrążeń, checkpointów i timerów
		this.currentLap = 0;
		if (this.lapsText) this.lapsText.setText(`LAPS: ${this.currentLap}/${this.totalLaps}`);
		this.expectedCheckpointIndex = 0;
		this.hasCompletedFullLap = false; // Reset flagi
		this.timerStarted = false; // ✅ Reset flagi startu timera
		this.raceFinished = false; // Reset flagi zakończenia wyścigu

		// Reset timerów
		this.lapTimes = {
			total: 0,
			bestLap: 0,
			currentLapStart: 0,
			lapsCompleted: 0
		};

		// Aktualizuj wyświetlacz timerów
		this.updateLapTimer();

		if (this._cpInside) {
			for (const key of this._cpInside.keys()) this._cpInside.set(key, false);
		}
	}

	exitToMenu() {
		this.scene.start("MenuScene");
	}
}