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
import { LapsTimer } from "./lapsTimer.js";
import { HiscoreManager } from "../scenes/hiscoreManager.js";

let skidMarks = null;
let skidMarksAI = null;
let skidMarksEnabled = true;

export class GameScene extends window.Phaser.Scene {
    constructor() {
        super({ key: "GameScene" });
        this.minimapa = true;
        this.gameMode = "PRACTICE";
        this.collisionsEnabled = true;
        this.raceFinished = false;
        this.hiscoreChecked = false;
    }

    isMobile() {
        return /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop|Mobile/i.test(navigator.userAgent);
    }

    init(data) {
        console.log(window._hiscores.tracks);
        this.worldData = data.worldData;
        this.worldData.startFix = data.startFix;
        this.gameMode = data.gameMode || "PRACTICE";
        window._worldData = data.worldData;
        if (this.gameMode === "PRACTICE") this.aiController = null;
        this.raceFinished = false;
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

        this.countdown = new CountdownManager(this);
        this.countdown.start();
    }

    update(time, dt) {
        dt /= 1000;

        const countdownWasActive = this.countdown?.isActive();
        if (this.countdown?.isActive()) {
            this.countdown.update(dt);
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

        this.carController.update(dt, control, this.worldSize, this.worldSize);
        this.lapsTimer.update(dt);
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
            this.p2Controller.update(dt, control2, this.worldSize, this.worldSize);
        }

        if (this.aiController) {
            // 🔸 KLUCZOWA ZMIANA: Tworzymy pusty control dla AI po zakończeniu wyścigu
            if (countdownWasActive) {
                this.aiController.throttleLock = true;
                this.aiController.updateAI(dt, this.worldSize, this.worldSize);
            } else if (this.gameMode === "RACE" && this.raceFinished) {
                // 🔸 Po zakończeniu wyścigu AI używa pustego kontrolu (jak gracz)
                this.aiController.throttleLock = false;
                // Zamiast updateAI, używamy update z pustym controlem
                const emptyControl = {
                    up: false,
                    down: false,
                    left: false,
                    right: false
                };
                this.aiController.update(dt, emptyControl, this.worldSize, this.worldSize);
            } else {
                this.aiController.throttleLock = false;
                this.aiController.updateAI(dt, this.worldSize, this.worldSize);
            }
        }

        const carPos = this.carController.getPosition();
        const aiCarPos = this.aiController ? this.aiController.getPosition() : this.p2Controller ? this.p2Controller.getPosition() : null;
        if (this.world) this.world.drawTiles(carPos.x, carPos.y);

        if (skidMarks?.enabled) {
            const skidMarksList = [{ controller: this.carController, skidMarks }];
            if (this.aiController && skidMarksAI) skidMarksList.push({ controller: this.aiController, skidMarks: skidMarksAI });
            if (this.p2Controller && skidMarksAI) skidMarksList.push({ controller: this.p2Controller, skidMarks: skidMarksAI });
            updateSkidMarks(this, tileSize, skidMarksList);
        }

        if (this.minimapa && this.world) {
            this.world.drawMinimap(aiCarPos, carPos, this.worldSize, this.worldSize);
        }

        this.cameraManager?.update(dt);

        if (this.hudCamera) this.hudCamera.setRotation(0);
    }

    showRaceFinish() {
        if (this.gameMode === "RACE" && this.raceFinishText) {
            this.raceFinished = true;
            this.raceFinishText.setVisible(true);
            this.handleHiscorePrompt(); // NEW
        }
    }
    
    handleHiscorePrompt() {
        if (this.hiscoreChecked) return;
        this.hiscoreChecked = true;
    
        try {
            const trackIndex = (window._selectedTrack ?? 0);
            const trackKey = `track${trackIndex + 1}`;
    
            // Zbierz czasy z LapsTimer
            const { total, bestLap } = this.lapsTimer.getLapTimes();
            const totalTime = Number(total);     // sekundy
            const best = Number(bestLap || 0);   // sekundy
    
            // Przygotuj managera na podstawie istniejących danych
            const mgr = new HiscoreManager({
                storageKey: 'mygame_hiscores',
                templatePath: 'assets/levels/hiscores.json',
                maxEntries: 4
            });
    
            // Użyj danych z menu, żeby nie robić async init jeszcze raz
            if (window._hiscores && window._hiscores.tracks) {
                mgr.data = JSON.parse(JSON.stringify(window._hiscores));
            }
    
            // Sprawdź kwalifikację
            const current = mgr.getForTrack(trackKey); // kopia tabeli
            const maxEntries = mgr.maxEntries || 4;
    
            const qualifies = (() => {
                if (current.length < maxEntries) return true;
                const worst = current[current.length - 1];
                if (totalTime < worst.totalTime) return true;
                if (totalTime === worst.totalTime && best < worst.bestLap) return true;
                return false;
            })();
    
            if (!qualifies) return;
    
            // Prompt o nick
            const defaultNick = 'PLAYER';
            const nick = (window.prompt('NEW HISCORE! ENTER YOUR NAME:', defaultNick) || defaultNick).trim().slice(0, 10);
            if (!nick) return;
    
            // Zapis do tabeli i localStorage
            const updated = mgr.addScore(trackKey, { nick, totalTime, bestLap: best });
    
            // Zaktualizuj globalne dane, żeby menu/overlay widział nową tabelę
            window._hiscores = mgr.getAll();
    
            // (Opcjonalnie) log lub lekki feedback
            console.log('[Hiscore] Updated', trackKey, updated);
        } catch (e) {
            console.warn('[Hiscore] Failed to process hiscore', e);
        }
    }

    resetGame() {
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
        skidMarks?.clear();
        if (skidMarksAI) skidMarksAI.clear();

        this.countdown.start();
        this.lapsTimer.reset();
    }

    exitToMenu() {
        this.scene.start("MenuScene");
    }
}