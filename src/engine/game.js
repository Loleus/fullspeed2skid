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

let skidMarks = null;
let skidMarksAI = null;
let skidMarksEnabled = true;

export class GameScene extends window.Phaser.Scene {
	constructor() {
		super({ key: "GameScene" });
		this.minimapa = true;
		this.gameMode = 'PRACTICE';
		
		// System odliczania startu
		this.countdownActive = false;
		this.countdownTimer = 0;
		this.countdownPhase = 0; // 0=3, 1=2, 2=1, 3=START
		this.countdownText = null;
		this.countdownTween = null;
	}

	isMobile() {
		return /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop|Mobile/i.test(navigator.userAgent);
	}

	init(data) {
		this.worldData = data.worldData;
		this.gameMode = data.gameMode || 'PRACTICE';
		window._worldData = data.worldData;
		if (this.gameMode === 'PRACTICE') this.aiController = null;
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

		// === INICJALIZACJA AI lub Drugiego Gracza ===
		const twoPlayers = !!worldData?.twoPlayers;
		if (!twoPlayers && this.gameMode === 'RACE' && this.worldData.waypoints && this.worldData.waypoints.length > 0) {
			const aiStart = this.worldData.waypoints[0];
			const aiStartYOffset = 80;

			this.aiCarSprite = this.physics.add.sprite(aiStart.x, aiStart.y + aiStartYOffset, "car_p2");
			this.aiCarSprite.setOrigin(0.5).setDepth(2);
			this.aiCarSprite.body.allowRotation = false;

			this.aiController = new AICar(this, this.aiCarSprite, this.worldData, this.worldData.waypoints);
			this.aiController.resetState(aiStart.x, aiStart.y + aiStartYOffset);
			console.log("Waypoints w game.js:", this.worldData.waypoints);

			skidMarksAI = new SkidMarks({ enabled: skidMarksEnabled, wheelWidth: 12 });
			this.carController.opponentController = this.aiController;
			this.aiController.opponentController = this.carController;
		} else if (twoPlayers) {
			const p2YOffset = 80;
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
		if (this.isMobile()) {
			this.control = this.hudInfoText;
		} else {
			this.cameras.main.ignore([this.hudInfoText]);
		}

		this.world = new World(this, worldData, tileSize, viewW, viewH);

		if (worldData.worldSize) this.worldSize = worldData.worldSize;

		if (this.minimapa) {
			await this.world.initMinimap(worldData.svgPath, this.hudInfoText);
		} else {
			const hudObjects = [this.hudInfoText];
			this.hudCamera = this.cameras.add(0, 0, viewW, viewH, false, "hud");
			this.cameras.main.ignore(hudObjects);
			this.hudCamera.ignore(this.children.list.filter((obj) => !hudObjects.includes(obj)));
			this.hudCamera.setScroll(0, 0);
			this.hudCamera.setRotation(0);
		}

		window.dispatchEvent(new Event("game-ready"));
		skidMarks = new SkidMarks({ enabled: skidMarksEnabled, wheelWidth: 12 });
		
		// Uruchom odliczanie startu
		this.startCountdown();
	}

	update(time, dt) {
		dt /= 1000;

		// Aktualizuj odliczanie startu
		if (this.countdownActive) {
			this.updateCountdown(dt);
		}

		if (this.vKey && window.Phaser.Input.Keyboard.JustDown(this.vKey)) this.cameraManager.toggle();
		if (this.rKey && window.Phaser.Input.Keyboard.JustDown(this.rKey)) this.resetGame();
		if (this.xKey && window.Phaser.Input.Keyboard.JustDown(this.xKey)) this.exitToMenu();

		const control = getControlState(this);
		
		// Blokuj throttle podczas odliczania
		if (this.countdownActive) {
			control.up = false;
			control.down = false;
		}
		
		this.carController.update(dt, control, this.worldSize, this.worldSize);
		if (this.p2Controller) {
			const control2 = { up: this.cursors.up.isDown, down: this.cursors.down.isDown, left: this.cursors.left.isDown, right: this.cursors.right.isDown };
			// Blokuj throttle dla drugiego gracza
			if (this.countdownActive) {
				control2.up = false;
				control2.down = false;
			}
			this.p2Controller.update(dt, control2, this.worldSize, this.worldSize);
		}

		if (this.aiController) {
			// Blokuj throttle dla AI
			if (this.countdownActive) {
				this.aiController.throttleLock = true;
			}
			this.aiController.updateAI(dt, this.worldSize, this.worldSize);
		}

		const carPos = this.carController.getPosition();
		const aiCarPos = this.aiController ? this.aiController.getPosition() : (this.p2Controller ? this.p2Controller.getPosition() : null);
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

	resetGame() {
		const worldData = this.worldData || window._worldData;
		const start = worldData.startPos;

		// Reset gracza
		this.carController.resetState(start.x, start.y);

		// Reset AI - tu dzieje się magia!
		if (this.aiController && this.worldData.waypoints && this.worldData.waypoints.length > 0) {
			const aiStart = this.worldData.waypoints[0];
			// Wywołujemy naszą nową metodę resetującą
			this.aiController.resetState(aiStart.x, aiStart.y);
		}

		// Reset świata i efektów wizualnych
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
		
		// Reset odliczania startu
		this.startCountdown();
	}


	exitToMenu() {
		this.scene.start("MenuScene");
	}

	// === SYSTEM ODLICZANIA STARTU ===
	startCountdown() {
		console.log('[GameScene] Starting countdown...');
		this.countdownActive = true;
		this.countdownTimer = 0;
		this.countdownPhase = 0;
		
		// Blokuj throttle dla wszystkich pojazdów
		this.carController.throttleLock = true;
		if (this.aiController) this.aiController.throttleLock = true;
		if (this.p2Controller) this.p2Controller.throttleLock = true;
		
		// Pokaż pierwszą cyfrę
		this.showCountdownNumber();
	}

	updateCountdown(dt) {
		this.countdownTimer += dt;
		
		// Przełączaj cyfry co sekundę
		if (this.countdownTimer >= 1.0) {
			this.countdownPhase++;
			this.countdownTimer = 0;
			
			if (this.countdownPhase <= 3) {
				this.showCountdownNumber();
			} else {
				// Koniec odliczania - START!
				this.finishCountdown();
			}
		}
	}

	showCountdownNumber() {
		const { width, height } = this.sys.game.canvas;
		
		// Usuń poprzedni tekst jeśli istnieje
		if (this.countdownText) {
			this.countdownText.destroy();
			this.countdownText = null;
		}
		
		// Zatrzymaj poprzedni tween
		if (this.countdownTween) {
			this.countdownTween.stop();
			this.countdownTween = null;
		}
		
		// Określ tekst do wyświetlenia
		let displayText = '';
		if (this.countdownPhase === 0) displayText = '3';
		else if (this.countdownPhase === 1) displayText = '2';
		else if (this.countdownPhase === 2) displayText = '1';
		else if (this.countdownPhase === 3) displayText = 'START';
		
		// Utwórz tekst
		this.countdownText = this.add.text(width / 2, height / 2, displayText, {
			fontFamily: 'Stormfaze',
			fontSize: '79px',
			color: '#ff0000',
			align: 'center'
		}).setOrigin(0.5).setDepth(1000);
		
		// Animacja pojawienia się i zanikania
		this.countdownText.setAlpha(0).setScale(0.5);
		
		this.countdownTween = this.tweens.add({
			targets: this.countdownText,
			alpha: 1,
			scaleX: 1,
			scaleY: 1,
			duration: 200,
			ease: 'Back.easeOut',
			onComplete: () => {
				// Po pojawieniu się, zacznij zanikanie po 0.3s
				this.time.delayedCall(300, () => {
					if (this.countdownText) {
						this.tweens.add({
							targets: this.countdownText,
							alpha: 0,
							scaleX: 2.5, // Powiększ do ~200px (79px * 2.5)
							scaleY: 2.5,
							duration: 300,
							ease: 'Power2.easeOut'
						});
					}
				});
			}
		});
		
		console.log(`[GameScene] Showing countdown: ${displayText}`);
	}

	finishCountdown() {
		console.log('[GameScene] Countdown finished - RACE START!');
		
		// Usuń tekst
		if (this.countdownText) {
			this.countdownText.destroy();
			this.countdownText = null;
		}
		
		// Zatrzymaj tween
		if (this.countdownTween) {
			this.countdownTween.stop();
			this.countdownTween = null;
		}
		
		// Odblokuj throttle dla wszystkich pojazdów
		this.carController.throttleLock = false;
		if (this.aiController) this.aiController.throttleLock = false;
		if (this.p2Controller) this.p2Controller.throttleLock = false;
		
		// Zakończ odliczanie
		this.countdownActive = false;
	}
}