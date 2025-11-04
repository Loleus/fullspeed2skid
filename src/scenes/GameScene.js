import { VehicleFactory } from "../services/VehicleFactory.js";
import { CameraManager } from "../cameras/CameraManager.js";
import { World } from "../world/World.js";
import { TILE_SIZE } from "../core/constants.js";
import { preloadWorldTextures } from "../world/TextureManager.js";
import { getControlState } from "../input/controlsManager.js";
import { createKeyboardBindings } from "../input/keyboardManager.js";
import { createHUD } from "../game/hudManager.js";
import { CountdownManager } from "../game/CountdownManager.js";
import { LapsTimer } from "../game/LapsTimer.js";
import { HiscoreService } from "../services/HiscoreService.js";
import { SkidMarksSystem } from "../game/SkidMarksSystem.js";

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
        this.ambience = data.ambience;
        if (this.ambience && !this.ambience.isPlaying) {
            this.ambience.play();
        };
        this.worldData = data.worldData;
        this.worldData.startFix = data.startFix;
        this.gameMode = data.gameMode || "PRACTICE";
        window._worldData = data.worldData;
        if (this.gameMode === "PRACTICE") this.aiController = null;
        this.raceFinished = false;
    }

    preload() {
        if (window._worldData?.tiles) {
            preloadWorldTextures(this, window._worldData.tiles, TILE_SIZE);
        }
        this.load.image("car_p1", "assets/images/car.png");
        this.load.image("car_p2", "assets/images/car_X.png");
        this.load.audio('applause', 'assets/samples/game_applause.mp3');
        this.load.audio('idle', 'assets/samples/game_idle.mp3');
        this.load.audio('off', 'assets/samples/game_off.mp3');
        this.load.audio('on', 'assets/samples/game_on.mp3');
        this.load.audio('race', 'assets/samples/game_race.wav');
        this.load.audio('race_max', 'assets/samples/game_race.wav');
        this.load.audio('slide', 'assets/samples/game_slide.mp3');
        this.load.audio('countdown', 'assets/samples/game_countdown.mp3');
        this.load.audio('game_music', 'assets/samples/game_music.mp3');
        this.load.audio('game_crash', 'assets/samples/game_crash.mp3');
    }

    initAudio() {
        if (this.musicOn) {
            this.idle = this.sound.add('idle', { volume: 0.2, loop: true });
            this.applause = this.sound.add('applause', { volume: 1.0 });
            this.off = this.sound.add('off', { volume: 0.2 });
            this.on = this.sound.add('on', { volume: 0.2 });
            this.race = this.sound.add('race', { volume: 0.2, rate: 1.0, loop: true });
            this.race_max = this.sound.add('race_max', { volume: 0.2, rate: 1.5, loop: true });
            this.slide = this.sound.add('slide', { volume: 0.4 });
            this.countdownSound = this.sound.add('countdown', { volume: 0.4 });
            this.music = this.sound.add('game_music', { volume: 0.4, loop: true });
            this.crash = this.sound.add('game_crash', { volume: 0.6 });
        }
    }

    async create() {
        this.maxPitch = 0.5;        // maksymalny pitch
        this.minPitch = 0.0;        // pitch docelowy po puszczeniu
        this.pitch = 0.0;           // aktualny pitch
        this.isThrottle = false;    // czy gaz wciśnięty

        console.log(this.registry.get('audioEnabled'));

        if (!this.registry.get('audioEnabled')) {
            console.log('Muting audio as per registry setting');
            this.sound.mute = true;
            console.log("niemagrac");
        }
        if (this.sound.mute !== undefined) {
            this.musicOn = !this.sound.mute;
            this.initAudio()
            console.log("magrac")
        }

        const worldData = this.worldData || window._worldData;
        const viewW = this.sys.game.config.width;
        const viewH = this.sys.game.config.height;
        const start = worldData.startPos;

        const keys = createKeyboardBindings(this);
        this.cursors = keys.cursors;
        this.wasdKeys = keys.wasdKeys;
        this.vKey = keys.vKey;
        this.rKey = keys.rKey;
        this.xKey = keys.xKey;

        const factory = new VehicleFactory(this, worldData);
        const { controller, sprite, speed } = factory.createPlayer({ x: start.x, y: start.y });
        this.carController = controller;
        this.car = sprite;
        console.log("PLAYER SPEED:", this.speed);
        const twoPlayers = !!worldData?.twoPlayers;

        if (!twoPlayers && this.gameMode === "RACE" && this.worldData.waypoints?.length > 0) {
            const aiStart = this.worldData.waypoints[0];
            this.aiController = factory.createAI({ x: aiStart.x, y: aiStart.y, waypoints: this.worldData.waypoints });
            if (this.collisionsEnabled) factory.linkOpponents(this.carController, this.aiController);
        } else if (twoPlayers) {
            this.p2Controller = factory.createPlayer({ x: start.x, y: start.y, texture: "car_p2" });
            factory.linkOpponents(this.carController, this.p2Controller);
        }

        this.skidMarksSystem = new SkidMarksSystem(this, { enabled: true, wheelWidth: 12, tileSize: TILE_SIZE });
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

        this.world = new World(this, worldData, TILE_SIZE, viewW, viewH);
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
        this.skidMarksSystem.update()

        if (this.minimapa && this.world) {
            this.world.drawMinimap(aiCarPos, carPos, this.worldSize, this.worldSize);
        }
        let boom = this.carController.collisionCount > 0;
        this.cameraManager?.update(dt);
        if (this.hudCamera) this.hudCamera.setRotation(0);

        if (!this.sound.mute) {

            if (countdownWasActive) {
                if (!this.idle.isPlaying && !this.countdownSound.isPlaying) {
                    this.countdownSound.play();
                    this.gameMode === "RACE" ? this.music.play() : this.music.stop();
                }
                return
            }

            if (boom && !this.crash.isPlaying) {
                this.crash.play();
            } else if (!boom && this.crash.isPlaying) {
                return;
            }

            ``
            if (this.raceFinished) {
                if (this.race.isPlaying && (!control.up || !control.down)) {
                    this.race && this.race.stop();
                    this.music.stop();
                    if (!this.idle.isPlaying) {
                        this.off && this.off.play();
                        this.time.delayedCall(700, () => {
                            this.idle && this.idle.play();
                        })
                    };
                }
            }


            if (this.slide.isPlaying && (this.carController.getWheelSlip([0, 2]) >= 0.3 || this.skidMarksSystem._list[0].skidMarks.burnoutDrawing[0] == true)) {
                return
            } else if (!this.slide.isPlaying && (this.carController.getWheelSlip([0, 2]) >= 0.3 || this.skidMarksSystem._list[0].skidMarks.burnoutDrawing[0] == true)) {
                this.slide.play()
            } else {
                this.slide.stop();
            }
            if (this.race.isPlaying) {
                if ((control.up || control.down) && !this.isThrottle) {
                    this.isThrottle = true;
                } else if ((!control.up && !control.down) && this.isThrottle) {
                    this.isThrottle = false;
                }
                // Jeśli gaz trzymany, zwiększ pitch do maxPitch
                if (this.isThrottle) {
                    this.pitch += (Math.abs(this.carController.getLocalSpeed() / 2000)) * dt;
                    if (this.pitch > this.maxPitch) this.pitch = this.maxPitch;
                } else {
                    // Jeśli puszczony, opadaj do minPitch
                    this.pitch -= (Math.abs(this.carController.getLocalSpeed() / 2000)) * dt;
                    if (this.pitch < this.minPitch) this.pitch = this.minPitch;
                }
            }

            // Zaktualizuj rate (pitch) dźwięku. W Phaser rate odpowiada prędkości odtwarzania.
            // Jeśli używasz WebAudio API bezpośrednio, to manipuluj playbackRate albo detune zależnie od potrzeb.
            // Opcjonalnie: zmiana głośności zależnie od pitch dla efektu
            // this.loopSound.setVolume(0.5 + 0.5 * Math.min(this.pitch / this.maxPitch, 1));
            this.race.setRate(1.0 + this.pitch);

            if ((control.up || control.down) && !this.on.isPlaying && !this.race.isPlaying && !this.race_max.isPlaying && this.carController.throttleLock == false) {
                this.on && this.on.play();
                this.time.delayedCall(672, () => {
                    this.race && this.race.play();
                    this.idle && this.idle.stop();
                    this.on.stop()
                });
            } else if ((control.up || control.down) && this.race.isPlaying && this.carController.throttleLock == false) {
                if (this.race.rate >= 1.49) {
                    this.race.pause();
                    this.race_max && this.race_max.play();
                }
            } else if (!control.up && !control.down && this.race.isPlaying && this.carController.throttleLock == false) {
                if (this.race.rate >= 1.001) {
                    return
                } else if (this.race.rate < 1.001) {
                    this.race && this.race.stop();
                    if (!this.idle.isPlaying && !this.race.isPlaying) {
                        this.off && this.off.play();
                        this.time.delayedCall(800, () => {
                            this.idle && this.idle.play();
                        })
                    };
                }
            } else if (this.race_max.isPlaying && !control.up && !control.down && this.carController.throttleLock == false) {
                this.race_max && this.race_max.stop();
                this.race && this.race.resume();
            } else if (this.carController.throttleLock == true) {
                control.up = false;
                control.down = false;
                this.race && this.race.stop();
                this.race_max && this.race_max.stop();
                this.pitch = 0.0;
                if (!this.idle.isPlaying && !this.off.isPlaying) {
                    this.off && this.off.play();
                    this.time.delayedCall(800, () => {
                        this.idle && this.idle.play();
                    })
                };
            }
        }
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
        const checked = this.hiscoreService.checked({
            trackIndex: window._selectedTrack || 0,
            lapsTimer: this.lapsTimer
        })
        console.log(checked)
        if (checked && this.musicOn && !this.applause.isPlaying) {
            this.applause.play();
            this.time.delayedCall(10000, () => {

                this.hiscoreService.tryQualify({
                    trackIndex: window._selectedTrack || 0,
                    lapsTimer: this.lapsTimer
                });
            });
        }
    }

    resetGame() {
        this.hiscoreChecked = false;
        if (this.musicOn) {
            this.music.isPlaying ? this.music.stop() : null;
            this.ambience.isPlaying ? this.ambience.stop() : null;
            this.idle.isPlaying ? this.idle.stop() : null;
            this.pith = 0.0;
            this.race.setRate(1.0);
            this.race.stop();
            this.race_max.stop();
            this.countdownSound.play();
            this.music.play();
        }
        this.lapsTimer.reset();
        const worldData = this.worldData || window._worldData;
        const start = worldData.startPos;

        this.raceFinished = false;
        this.carController.resetState(start.x, start.y);
        console.log(this.carController.getLocalSpeed());
        console.log(this.race.rate);
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

    exitToMenu() {
        this.hiscoreChecked = false;
        if (this.musicOn) {
            this.music.isPlaying ? this.music.stop() : null;
            this.ambience.isPlaying ? this.ambience.stop() : null;
            this.idle.isPlaying ? this.idle.stop() : null;
            this.pith = 0.0;
            this.race.setRate(1.0);
            this.race.stop();
            this.race_max.stop();
            this.countdownSound.stop();
        }
        this.scene.start("MenuScene");
    }
}