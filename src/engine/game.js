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
import { LapsTimer } from "./lapsTimer.js"; // ✅ Import nowego modułu

let skidMarks = null;
let skidMarksAI = null;
let skidMarksEnabled = true;

export class GameScene extends window.Phaser.Scene {
    constructor() {
        super({ key: "GameScene" });
        this.minimapa = true;
        this.gameMode = "PRACTICE";
        this.collisionsEnabled = false
    }

    isMobile() {
        return /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop|Mobile/i.test(navigator.userAgent);
    }

    init(data) {
        this.worldData = data.worldData;
        this.worldData.startFix = data.startFix;  // Dodaj startFix do worldData
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

        const keys = createKeyboardBindings(this);
        this.cursors = keys.cursors;
        this.wasdKeys = keys.wasdKeys;
        this.vKey = keys.vKey;
        this.rKey = keys.rKey;
        this.xKey = keys.xKey;

        this.car = this.physics.add.sprite(start.x, start.y + startYOffset, "car_p1");
        this.car.setOrigin(0.5).setDepth(2);
        this.car.body.allowRotation = false;

        this.carController = new PlayerCar(this, this.car, worldData);
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

            if (this.collisionsEnabled) {
                this.carController.opponentController = this.aiController;
                this.aiController.opponentController = this.carController;
            }
        } else if (twoPlayers) {
            const p2YOffset = 0;
            this.p2CarSprite = this.physics.add.sprite(start.x, start.y + p2YOffset, "car_p2");
            this.p2CarSprite.setOrigin(0.5).setDepth(2);
            this.p2CarSprite.body.allowRotation = false;

            this.p2Controller = new PlayerCar(this, this.p2CarSprite, worldData);
            this.p2Controller.resetState(start.x, start.y + p2YOffset);

            skidMarksAI = new SkidMarks({ enabled: skidMarksEnabled, wheelWidth: 12 });
            this.carController.opponentController = this.p2Controller;
            this.p2Controller.opponentController = this.carController;
        }

        this.cameraManager = new CameraManager(this, this.car, worldData.worldSize);
        this.hudInfoText = createHUD(this, this.isMobile(), this.cameraManager);

        // ✅ Inicjalizacja LapsTimer
        this.lapsTimer = new LapsTimer(this, this.gameMode, 3);
        this.lapsTimer.initializeCheckpoints(worldData.checkpoints);

        // Zgrupuj elementy HUD do jednej referencji przekazywanej do kamery HUD
        const lapHUDElements = this.lapsTimer.getHUDElements();
        if (this.isMobile()) {
            this.control = this.hudInfoText;
            this.hudRoot = this.add.container(0, 0, [...lapHUDElements]);
        } else {
            this.hudRoot = this.add.container(0, 0, [this.hudInfoText, ...lapHUDElements]);
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
    }

    update(time, dt) {
        dt /= 1000;

        // ✅ Sprawdź czy countdown się skończył i uruchom timer
        const countdownWasActive = this.countdown?.isActive();
        if (this.countdown?.isActive()) {
            this.countdown.update(dt);
        }

        // ✅ Uruchom timer od razu po zakończeniu countdownu
        if (countdownWasActive && !this.countdown?.isActive() && !this.lapsTimer.isTimerStarted()) {
            this.lapsTimer.startTimer();
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

        // ✅ Aktualizacja timera okrążeń
        this.lapsTimer.update(dt);

        // ✅ Sprawdzanie checkpointów
        const pos = this.carController.getPosition();
        this.lapsTimer.checkpointUpdate(pos);

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

        // ✅ Reset lapsTimer
        this.lapsTimer.reset();
    }

    exitToMenu() {
        this.scene.start("MenuScene");
    }
}
