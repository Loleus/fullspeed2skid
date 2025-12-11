import { VehicleFactory } from "../services/VehicleFactory.js";
import { CameraManager } from "../cameras/CameraManager.js";
import { World } from "../domain/world/World.js";
import { TILE_SIZE } from "../core/constants.js";
import { preloadWorldTextures } from "../domain/world/TextureManager.js";
import { getControlState } from "../input/controlsManager.js";
import { createKeyboardBindings } from "../input/keyboardManager.js";
import { createHUD } from "../systems/hudManager.js";
import { CountdownManager } from "../systems/CountdownManager.js";
import { LapsTimer } from "../systems/LapsTimer.js";
import { HiscoreService } from "../services/HiscoreService.js?v=2.5.6";
import { SkidMarksSystem } from "../systems/SkidMarksSystem.js";
import { AudioService } from "../services/AudioService.js";

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
        // Inicjalizacja puli i rendererów dodatkowych
        // Stała liczba cząstek w puli
        const MAX_PARTICLES = 1000;
        const textureKey = 'flares';
        const frameKey = 'black';

        // Tablice stanów puli
        this._pCount = MAX_PARTICLES;
        this._alive = 0;
        this._freeStack = new Int32Array(MAX_PARTICLES);
        for (let i = 0; i < MAX_PARTICLES; i++) this._freeStack[i] = MAX_PARTICLES - 1 - i;
        this._freeTop = MAX_PARTICLES - 1;
        // Dane cząstek w TypedArrays dla wydajności
        this._px = new Float32Array(MAX_PARTICLES);
        this._py = new Float32Array(MAX_PARTICLES);
        this._vx = new Float32Array(MAX_PARTICLES);
        this._vy = new Float32Array(MAX_PARTICLES);
        this._life = new Float32Array(MAX_PARTICLES);
        this._ttl = new Float32Array(MAX_PARTICLES);
        this._scale = new Float32Array(MAX_PARTICLES);
        this._alpha = new Float32Array(MAX_PARTICLES);
        this._tint = new Uint32Array(MAX_PARTICLES);

        // Image-y dodane do sceny i poolowane
        this._sprites = new Array(MAX_PARTICLES);
        for (let i = 0; i < MAX_PARTICLES; i++) {
            const img = this.add.image(-1000, -1000, textureKey, frameKey);
            img.setVisible(false);
            img.setDepth(1);
            // opcjonalnie: img.setBlendMode(Phaser.BlendModes.NORMAL);
            // opcjonalnie: img.setPipeline('Light2D') jeśli mam pipeline
            this._sprites[i] = img;

            // inicjalne wartości
            this._px[i] = 0; this._py[i] = 0;
            this._vx[i] = 0; this._vy[i] = 0;
            this._life[i] = 0; this._ttl[i] = 0;
            this._scale[i] = 0; this._alpha[i] = 0;
            this._tint[i] = 0x000000;
        }

        // Helper: konwersja hex (0xRRGGBB) do int (Uint32) — w hexie jest ok
        const COLORS = [0x000000, 0x222222, 0x333333, 0x4a4a4a, 0x666666];

        this.emitSmoke = (x, y, angleDeg) => {
            // --- SMALL particles (drobne, szybkie) ---
            // smallCount: ile drobnych cząstek na burst
            const smallCount = Phaser.Math.Between(3, 5);
            for (let s = 0; s < smallCount; s++) {
                if (this._freeTop < 0) break;                 // brak wolnych slotów w puli -> przerwij
                const idx = this._freeStack[this._freeTop--]; // pobierz indeks wolnego slotu (stack)

                // a = kąt w radianach; tutaj dodajesz rozrzut ±8° (jeśli chcesz idealnie w tył, usuń Phaser.Math.Between)
                const a = Phaser.Math.DegToRad(angleDeg + Phaser.Math.Between(-8, 8));
                // speed w px/s
                const speed = Phaser.Math.FloatBetween(40, 80);

                // vx, vy zapisane w TypedArray — minimalne alokacje, szybkie odczyty
                this._vx[idx] = Math.cos(a) * speed;
                this._vy[idx] = Math.sin(a) * speed;

                // pozycja startowa
                this._px[idx] = x; this._py[idx] = y;

                // reset czasu życia i ustaw TTL (ms)
                this._life[idx] = 0;
                this._ttl[idx] = Phaser.Math.FloatBetween(300, 500);

                // początkowa skala i alpha
                this._scale[idx] = Phaser.Math.FloatBetween(0.02, 0.04);
                this._alpha[idx] = 1.0;

                // tint (kolor) — zapisujemy jako 32-bit hex w Uint32Array
                this._tint[idx] = Phaser.Utils.Array.GetRandom(COLORS);

                // aktywacja sprite'a z puli: ustaw widoczność i transformacje
                const sp = this._sprites[idx];
                sp.setVisible(true);          // ustawiamy widoczność tylko przy aktywacji
                sp.x = x; sp.y = y;           // bezpośrednie przypisanie (szybsze niż setPosition)
                sp.scaleX = sp.scaleY = this._scale[idx];
                sp.alpha = 1.0;
                sp.setTint(this._tint[idx]); // tint ustawiamy raz przy emisji
                sp.setBlendMode(Phaser.BlendModes.MULTIPLY);
                this._alive++; // zwiększ licznik aktywnych cząstek
            }

            // --- MEDIUM particles (główna masa) ---
            const mediumCount = Phaser.Math.Between(2, 3);
            for (let m = 0; m < mediumCount; m++) {
                if (this._freeTop < 0) break;
                const idx = this._freeStack[this._freeTop--];

                // mniejszy spread ±6°
                const a = Phaser.Math.DegToRad(angleDeg + Phaser.Math.Between(-6, 6));
                const speed = Phaser.Math.FloatBetween(60, 120);
                this._vx[idx] = Math.cos(a) * speed;
                this._vy[idx] = Math.sin(a) * speed;
                this._px[idx] = x; this._py[idx] = y;
                this._life[idx] = 0;
                this._ttl[idx] = Phaser.Math.FloatBetween(500, 900);
                this._scale[idx] = Phaser.Math.FloatBetween(0.04, 0.08);
                this._alpha[idx] = 1.0;
                this._tint[idx] = Phaser.Utils.Array.GetRandom(COLORS);

                const sp = this._sprites[idx];
                sp.setVisible(true);
                sp.x = x; sp.y = y;
                sp.scaleX = sp.scaleY = this._scale[idx];
                sp.alpha = 1.0;
                sp.setTint(this._tint[idx]);
                sp.setBlendMode(Phaser.BlendModes.MULTIPLY);
                this._alive++;
            }

            // --- LARGE particle (okazjonalny puff = duża chmurka / TODO: strzał z rury (audio)) ---
            if (Phaser.Math.Between(0, 100) < 20 && this._freeTop >= 0) {
                const idx = this._freeStack[this._freeTop--];
                // większy spread ±10°
                const a = Phaser.Math.DegToRad(angleDeg + Phaser.Math.Between(-10, 10));
                const speed = Phaser.Math.FloatBetween(20, 60);
                this._vx[idx] = Math.cos(a) * speed;
                this._vy[idx] = Math.sin(a) * speed;
                this._px[idx] = x; this._py[idx] = y;
                this._life[idx] = 0;
                this._ttl[idx] = Phaser.Math.FloatBetween(900, 1400);
                this._scale[idx] = Phaser.Math.FloatBetween(0.08, 0.18);
                this._alpha[idx] = 1.0;
                this._tint[idx] = Phaser.Utils.Array.GetRandom(COLORS);

                const sp = this._sprites[idx];
                sp.setVisible(true);
                sp.x = x; sp.y = y;
                sp.scaleX = sp.scaleY = this._scale[idx];
                sp.alpha = 1.0;
                sp.setTint(this._tint[idx]);
                // tutaj ustawiasz blendMode
                sp.setBlendMode(Phaser.BlendModes.MULTIPLY);
                this._alive++;
            }
        };

        // updateParticles: integracja ruchu, wygaszanie i recykling cząstek
        // dt = delta w milisekundach (tak jak w update)
        this.updateParticles = (dt) => {
            if (this._alive === 0) return; // nic aktywnego -> szybkie wyjście

            // iterujemy po wszystkich slotach (prostsze i często szybsze niż dynamiczna lista)
            for (let i = 0; i < this._pCount; i++) {
                const ttl = this._ttl[i];
                if (ttl <= 0) continue; // slot wolny -> pomiń

                // zwiększ czas życia
                const life = this._life[i] + dt;

                // jeśli przekroczono TTL -> zakończ cząstkę i zwróć slot do puli
                if (life >= ttl) {
                    this._ttl[i] = 0;
                    this._life[i] = 0;
                    this._vx[i] = 0; this._vy[i] = 0;
                    const sp = this._sprites[i];
                    sp.setVisible(false);      // ukryj sprite
                    sp.x = -1000; sp.y = -1000; // przenieś poza ekran (opcjonalne)
                    this._freeStack[++this._freeTop] = i; // push z powrotem na stos wolnych
                    this._alive--;
                    continue;
                }

                // integracja pozycji (Euler forward). dt/1000 -> konwersja ms -> s
                const vx = this._vx[i];
                const vy = this._vy[i];
                const px = this._px[i] + vx * (dt / 1000);
                const py = this._py[i] + vy * (dt / 1000);
                this._px[i] = px;
                this._py[i] = py;
                this._life[i] = life;

                // progres życia 0..1
                const t = life / ttl;

                // prosty wzrost skali i liniowe zanikanie alpha
                const s0 = this._scale[i];
                const s = s0 + t * (s0 * 1.6); // rośnie do ~2.6*s0
                const a = 1.0 - t;             // liniowe zanikanie

                // aktualizacja sprite (bez wywołań setPosition/setScale/setAlpha dla wydajności)
                const sp = this._sprites[i];
                sp.x = px;
                sp.y = py;
                sp.scaleX = sp.scaleY = s;
                sp.alpha = a;
                // tint ustawiony przy emisji — nie zmieniamy go w update (kosztowne)
            }
        };
        // koniec efektu dymu
        // ----------------------------------------

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
        // // pozycja środka auta
        const carX = this.carController.carX;
        const carY = this.carController.carY;
        // // kąt auta w stopniach (użyj tego pola, które masz: carSprite.angle lub car.angle)
        const carAngle = this.carController.carSprite.angle;
        // // lokalne przesunięcie emitera względem środka auta:
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
            this.emitSmoke(worldPos.x, worldPos.y, emitAngle);
            this._smokeTimer = 0;
        }
        this.updateParticles(dt);
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
