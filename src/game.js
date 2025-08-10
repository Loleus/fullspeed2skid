import { CameraManager } from "./cameras.js";
import { Car } from "./car.js";
import { World } from "./world.js";
import { tileSize } from "./main.js";
import { SkidMarks } from "./skidMarks.js";
import { preloadWorldTextures } from "./textureManager.js";
import { getControlState } from "./controlsManager.js";
import { updateSkidMarks } from "./skidMarksManager.js";
import { createKeyboardBindings } from "./keyboardManager.js";
import { createHUD } from "./hudManager.js";
import { AICar } from "./AICar.js";

let skidMarks = null;
let skidMarksAI = null;
let skidMarksEnabled = true;

export class GameScene extends window.Phaser.Scene {
	constructor() {
		super({ key: "GameScene" });
		this.minimapa = true;
	}

	isMobile() {
		return /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop|Mobile/i.test(navigator.userAgent);
	}

	init(data) {
		this.worldData = data.worldData;
		window._worldData = data.worldData;
	}

	preload() {
		if (window._worldData?.tiles) {
			preloadWorldTextures(this, window._worldData.tiles, tileSize);
		}
		this.load.image("car", "assets/images/car.png");
		this.load.image("car_p", "assets/images/car_X.png");
	}

	async create() {
		const worldData = this.worldData || window._worldData;
		const viewW = this.sys.game.config.width;
		const viewH = this.sys.game.config.height;
		const start = worldData.startPos;
		const startYOffset = 0;

		this.car = this.physics.add.sprite(start.x, start.y + startYOffset, "car");
		this.car.setOrigin(0.5).setDepth(2);
		this.car.body.allowRotation = false;

		this.carController = new Car(this, this.car, worldData);
		this.carController.resetState(start.x, start.y + startYOffset);

		// === INICJALIZACJA AI ===
		const aiStart = this.worldData.waypoints[0]; // pierwszy punkt jako start
		const aiStartYOffset = 80; // opcjonalne przesunięcie za graczem

		this.aiCarSprite = this.physics.add.sprite(aiStart.x, aiStart.y + aiStartYOffset, "car_p");
		this.aiCarSprite.setOrigin(0.5).setDepth(2);
		this.aiCarSprite.body.allowRotation = false;

		this.aiController = new AICar(this, this.aiCarSprite, this.worldData, this.worldData.waypoints);
		this.aiController.resetState(aiStart.x, aiStart.y + aiStartYOffset);
		console.log("Waypoints w game.js:", this.worldData.waypoints);
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
		// skidMarks = new SkidMarks({ enabled: skidMarksEnabled, wheelWidth: 12 });
		skidMarks = new SkidMarks({ enabled: skidMarksEnabled, wheelWidth: 12 });
		skidMarksAI = new SkidMarks({ enabled: skidMarksEnabled, wheelWidth: 12 });

	}

	update(time, dt) {
		dt /= 1000;

		if (this.vKey && window.Phaser.Input.Keyboard.JustDown(this.vKey)) this.cameraManager.toggle();
		if (this.rKey && window.Phaser.Input.Keyboard.JustDown(this.rKey)) this.resetGame();
		if (this.xKey && window.Phaser.Input.Keyboard.JustDown(this.xKey)) this.exitToMenu();

		const control = getControlState(this);
		const throttle = this.carController.updateInput(control).throttle;
		this.carController.update(dt, control, this.worldSize, this.worldSize);
		if (this.aiController) {
			this.aiController.updateAI(dt, this.worldSize, this.worldSize);
		}
		const carPos = this.carController.getPosition();
		this.world.drawTiles(carPos.x, carPos.y);

		if (skidMarks?.enabled) {
			console.log("SkidMarks: update called");
			updateSkidMarks(this, tileSize, [
				{ controller: this.carController, skidMarks: skidMarks },
				{ controller: this.aiController, skidMarks: skidMarksAI }
			]);

		}


		if (this.minimapa && this.world) {
			this.world.drawMinimap(carPos, this.worldSize, this.worldSize);
		}

		this.cameraManager?.update(dt);

		if (this.hudCamera) this.hudCamera.setRotation(0);
		if (this.hudContainer) this.hudContainer.rotation = 0;
		if (this.gasBtn) this.gasBtn.rotation = 0;
		if (this.brakeBtn) this.brakeBtn.rotation = 0;
	}

	resetGame() {
		const worldData = this.worldData || window._worldData;
		const viewH = this.sys.game.config.height;
		const start = worldData.startPos;

		this.carController.resetState(start.x, start.y);

		if (this.world) {
			this.world.trackTiles = [];
			for (const tileObj of this.world.tilePool.values()) {
				tileObj.setVisible(false);
			}
		}

		this.cameraManager?.reset();
		skidMarks?.clear();
	}

	exitToMenu() {
		this.scene.start("MenuScene");
	}
}
