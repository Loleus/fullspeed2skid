import { World, preloadWorldTextures } from "../domain/index.js";
import { VehicleFactory, AudioService, HiscoreService } from "../services/index.js";
import { createHUD, CountdownManager, LapsTimer, SkidMarksSystem, SmokeParticleEmitter } from "../systems/index.js";
import { CameraManager } from "../cameras/CameraManager.js";
import { getControlState, createKeyboardBindings } from "../input/index.js";

export class GameScene extends window.Phaser.Scene {
    constructor() {
        super({ key: "GameScene" });
        this.minimapa = true;
        this.gameMode = "PRACTICE";
        this.collisionsEnabled = true;
        this.raceFinished = false;
        this.hiscoreChecked = false;
        // Utworzenie instancji AudioService
        this.audioService = new AudioService(this);
    }

    isMobile() {
        return /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop|Mobile/i.test(navigator.userAgent);
    }

    init(data) {
        console.log(window._hiscores.tracks);
        this.TILE_SIZE = data.TILE_SIZE;
        this.worldData = data.worldData;
        this.worldData.startFix = data.startFix;
        this.gameMode = data.gameMode || "PRACTICE";
        window._worldData = data.worldData;
        if (this.gameMode === "PRACTICE") this.aiController = null;
        this.raceFinished = false;
    }

    preload() {
        if (window._worldData?.tiles) {
            preloadWorldTextures(this, window._worldData.tiles, this.TILE_SIZE);
        }
        this.load.atlas('flares', 'assets/images/flares.png', 'assets/images/smoke.json');
        this.load.image("car_p1", "assets/images/car.png");
        this.load.image("car_p2", "assets/images/car_X.png");

        // Delegowanie ładowania audio do serwisu
        this.audioService.preload();
    }

    async create() {
        // Delegowanie tworzenia audio do serwisu
        this.audioService.create();

        const worldData = this.worldData || window._worldData;
        const viewW = this.sys.game.config.width;
        const viewH = this.sys.game.config.height;
        const start = worldData.startPos;

        const factory = new VehicleFactory(this, worldData);
        const { controller, sprite, speed } = factory.createPlayer({ x: start.x, y: start.y });
        this.carController = controller;
        this.car = sprite;

        const keys = createKeyboardBindings(this);
        this.cursors = keys.cursors;
        this.wasdKeys = keys.wasdKeys;
        this.vKey = keys.vKey;
        this.rKey = keys.rKey;
        this.xKey = keys.xKey;

        // ----------------------------------------
        // Efekt dymu z rury wydechowej
        // ----------------------------------------
        this.smokeEmitter = new SmokeParticleEmitter(this, {
            maxParticles: 1000,
            textureKey: 'flares',
            frameKey: 'black'
        });

        // Drugie auto / AI
        const twoPlayers = !!worldData?.twoPlayers;
        if (!twoPlayers && this.gameMode === "RACE" && this.worldData.waypoints?.length > 0) {
            const aiStart = this.worldData.waypoints[0];
            this.aiController = factory.createAI({ x: aiStart.x, y: aiStart.y, waypoints: this.worldData.waypoints });
            if (this.collisionsEnabled) factory.linkOpponents(this.carController, this.aiController);
        } else if (twoPlayers) {
            this.p2Controller = factory.createPlayer({ x: start.x, y: start.y, texture: "car_p2" });
            factory.linkOpponents(this.carController, this.p2Controller);
        }

        this.skidMarksSystem = new SkidMarksSystem(this, { enabled: true, wheelWidth: 12, tileSize: this.TILE_SIZE });
        this.skidMarksSystem.register(this.carController);
        if (this.aiController) this.skidMarksSystem.register(this.aiController);
        if (this.p2Controller) this.skidMarksSystem.register(this.p2Controller);

        window.dispatchEvent(new Event("game-ready"));

        this.cameraManager = new CameraManager(this, this.car, worldData.worldSize);
        this.hudInfoText = createHUD(this, this.isMobile(), this.cameraManager);

        const totalLaps = this.gameMode === "RACE" ? 3 : 100;
        this.lapsTimer = new LapsTimer(this, this.gameMode, totalLaps);
        this.lapsTimer.initializeCheckpoints(worldData.checkpoints);

        const lapHUDElements = this.lapsTimer.getHUDElements();
        if (this.isMobile()) {
            this.control = this.hudInfoText;
            this.hudRoot = this.add.container(0, 0, [...lapHUDElements]);
        } else {
            this.hudRoot = this.add.container(0, 0, [this.hudInfoText, ...lapHUDElements]);
            this.cameras.main.ignore(this.hudRoot);
        }

        if (this.gameMode === "RACE") {
            this.raceFinishText = this.add.text(
                viewW / 2,
                viewH / 2,
                'RACE FINISHED!',
                {
                    fontFamily: 'Stormfaze',
                    fontSize: '100px',
                    color: '#e10000c8'
                }
            ).setOrigin(0.5).setDepth(10).setVisible(false).setShadow(3, 3, '#490c00ff', 3, false, true)
            this.hudRoot.add(this.raceFinishText);
        }

        this.world = new World(this, worldData, this.TILE_SIZE, viewW, viewH);
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

        this.hiscoreService = new HiscoreService({});
        this.countdown = new CountdownManager(this);
        this.countdown.start();
        console.log(this.carController);
        console.log(this.aiController)
    }

    localToWorld(carX, carY, carAngleDeg, offsetX, offsetY) {
        const rad = Phaser.Math.DegToRad(carAngleDeg);
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const worldX = carX + offsetX * cos - offsetY * sin;
        const worldY = carY + offsetX * sin + offsetY * cos;
        return { x: worldX, y: worldY };
    }

    update(time, dt) {
        const deltaSeconds = dt / 1000;

        const countdownWasActive = this.countdown?.isActive();

        if (this.countdown?.isActive()) {
            this.countdown.update(deltaSeconds);
        }

        if (countdownWasActive && !this.countdown?.isActive() && !this.lapsTimer.isTimerStarted()) {
            this.lapsTimer.startTimer();
        }

        if (this.vKey && window.Phaser.Input.Keyboard.JustDown(this.vKey)) this.cameraManager.toggle();

        if (this.gameMode === "RACE" && this.raceFinishText?.visible) {
            if (this.rKey && window.Phaser.Input.Keyboard.JustDown(this.rKey)) {
                this.raceFinishText.setVisible(false);
                this.resetGame();
            }
            if (this.xKey && window.Phaser.Input.Keyboard.JustDown(this.xKey)) {
                this.exitToMenu();
            }
        }

        if (this.gameMode === "RACE" && !this.raceFinished && this.lapsTimer.isRaceFinished()) {
            this.showRaceFinish();
        }

        if (this.rKey && window.Phaser.Input.Keyboard.JustDown(this.rKey)) this.resetGame();
        if (this.xKey && window.Phaser.Input.Keyboard.JustDown(this.xKey)) this.exitToMenu();

        const control = getControlState(this);
        if (countdownWasActive || (this.gameMode === "RACE" && this.raceFinished)) {
            control.up = false;
            control.down = false;
            control.left = false;
            control.right = false;
        }

        this.carController.update(deltaSeconds, control, this.worldSize, this.worldSize);
        this.lapsTimer.update(deltaSeconds);
        const pos = this.carController.getPosition();
        this.lapsTimer.checkpointUpdate(pos);

        if (this.p2Controller) {
            let control2 = {
                up: this.cursors.up.isDown,
                down: this.cursors.down.isDown,
                left: this.cursors.left.isDown,
                right: this.cursors.right.isDown,
            };
            if (countdownWasActive || (this.gameMode === "RACE" && this.raceFinished)) {
                control2.up = false;
                control2.down = false;
                control2.left = false;
                control2.right = false;
            }
            this.p2Controller.update(deltaSeconds, control2, this.worldSize, this.worldSize);
        }

        if (this.aiController) {
            if (countdownWasActive) {
                this.aiController.throttleLock = true;
                this.aiController.updateAI(deltaSeconds, this.worldSize, this.worldSize);
            } else if (this.gameMode === "RACE" && this.raceFinished) {
                this.aiController.throttleLock = false;
                const emptyControl = { up: false, down: false, left: false, right: false };
                this.aiController.update(deltaSeconds, emptyControl, this.worldSize, this.worldSize);
            } else {
                this.aiController.throttleLock = false;
                this.aiController.updateAI(deltaSeconds, this.worldSize, this.worldSize);
            }
        }

        const carPos = this.carController.getPosition();
        const aiCarPos = this.aiController ? this.aiController.getPosition() : this.p2Controller ? this.p2Controller.getPosition() : null;

        if (this.world) this.world.drawTiles(carPos.x, carPos.y);
        this.skidMarksSystem.update()

        if (this.minimapa && this.world) {
            this.world.drawMinimap(aiCarPos, carPos, this.worldSize, this.worldSize);
        }

        this.cameraManager?.update(deltaSeconds);
        if (this.hudCamera) this.hudCamera.setRotation(0);

        // Delegowanie aktualizacji audio do serwisu
        this.audioService.update(deltaSeconds, {
            control,
            countdownWasActive,
            raceFinished: this.raceFinished,
            carController: this.carController,
            aiController: this.aiController,
            skidMarksSystem: this.skidMarksSystem,
            gameMode: this.gameMode,
        });

        // Aktualizacja pozycji i kąta emitera dymu
        const CAR_HEIGHT = 66;
        // pozycja środka auta
        const carX = this.carController.carX;
        const carY = this.carController.carY;
        // kąt auta w stopniach (użyj tego pola, które masz: carSprite.angle lub car.angle)
        const carAngle = this.carController.carSprite.angle;
        // lokalne przesunięcie emitera względem środka auta:
        const offsetX = -8;
        const offsetY = +(CAR_HEIGHT / 2) - 3; // minus -> w tył auta (przykład)
        const worldPos = this.localToWorld(carX, carY, carAngle, offsetX, offsetY);
        const backAngle = carAngle;
        const emitAngle = backAngle + 90;
        // oblicz worldPos i emitAngle jak wcześniej
        if (!this._smokeTimer) this._smokeTimer = 0;
        this._smokeTimer += dt;
        const emitFreq = (control.down || control.up) ? 60 : 300;
        if (this._smokeTimer >= emitFreq) {
            this.smokeEmitter.emit(worldPos.x, worldPos.y, emitAngle);
            this._smokeTimer = 0;
        }
        this.smokeEmitter.update(dt);
    }

    showRaceFinish() {
        if (this.gameMode === "RACE" && this.raceFinishText) {
            this.raceFinished = true;
            this.raceFinishText.setVisible(true);
            this.handleHiscorePrompt();
        }
    }

    handleHiscorePrompt() {
        if (this.hiscoreChecked) return;
        this.hiscoreChecked = true;
        const hiscoreParams = {
            trackIndex: window._selectedTrack || 0,
            lapsTimer: this.lapsTimer
        }
        if (this.hiscoreService.checked(hiscoreParams)) {
            // Wywołanie metody z serwisu audio
            this.audioService.playApplause();
            this.time.delayedCall(10000, () => { this.hiscoreService.tryQualify(hiscoreParams) });
        }
        if (this.sound.mute) {
            this.hiscoreService.tryQualify(hiscoreParams)
        }
    }

    resetGame() {
        if (this.scene.isActive("GameScene") && !this.scene.isActive('MenuScene')) {
            this.hiscoreChecked = false;

            // Delegowanie resetu audio
            this.audioService.reset();

            this.lapsTimer.reset();
            const worldData = this.worldData || window._worldData;
            const start = worldData.startPos;

            this.raceFinished = false;
            this.carController.resetState(start.x, start.y);

            if (this.aiController && this.worldData.waypoints?.length > 0) {
                const aiStart = this.worldData.waypoints[0];
                this.aiController.resetState(aiStart.x, aiStart.y);
            }

            if (this.p2Controller) {
                this.p2Controller.resetState(start.x, start.y);
            }

            if (this.world) {
                this.world.trackTiles = [];
                for (const tileObj of this.world.tilePool.values()) {
                    tileObj.setVisible(false);
                }
            }

            this.cameraManager?.reset();
            this.skidMarksSystem.clear();

            this.countdown.start();
        }
    }

    async exitToMenu() {
        if (this.scene.isActive("GameScene") && !this.scene.isActive('MenuScene')) {
            this.hiscoreChecked = false;

            const audioSvc = this.audioService || this.game?.audioService;
            setTimeout(() => {
                // anuluj timery jeśli je rejestrujesz
                audioSvc?.timers?.forEach(t => t.remove && t.remove());
                audioSvc?.timers?.clear?.();

                // zatrzymaj wszystkie znane soundy
                Object.values(audioSvc?.sounds || {}).forEach(s => s?.stop && s.stop());

                // opcjonalnie ustaw flagę po zatrzymaniu
                // audioSvc.suspended = true;
            }, 60); // 0 też działa, 60 ms daje WebAudio więcej czasu
            this.scene.start("MenuScene");
        }
    }
}
