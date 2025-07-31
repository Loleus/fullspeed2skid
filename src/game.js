import { CameraManager } from "./cameras.js";
import { Car } from "./car.js";
import { World } from "./world.js";
import { tileSize } from "./main.js";
import { SkidMarks } from "./skidMarks.js";
import { preloadWorldTextures } from "./textureManager.js";
import { getControlState } from "./controlsManager.js";
import { updateSkidMarks } from "./skidMarksManager.js";

let skidMarks = null;
let skidMarksEnabled = true;

export class GameScene extends window.Phaser.Scene {
  constructor() {
    super({ key: "GameScene" });
    this.minimapa = true;
  }

  create() {
    this.events.emit("game-scene-start");
    this.events.once("shutdown", () => {
      this.events.emit("game-scene-shutdown");
    });
  }

  isMobile() {
    return /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop|Mobile/i.test(navigator.userAgent);
  }

  init(data) {
    this.worldData = data.worldData;
    window._worldData = data.worldData;
  }

  preload() {
    if (window._worldData && window._worldData.tiles) {
      preloadWorldTextures(this, window._worldData.tiles, tileSize);
    }
    this.load.image("car", "assets/images/car.png");
  }

  async create() {
    const worldData = this.worldData || window._worldData;
    const viewW = this.sys.game.config.width;
    const viewH = this.sys.game.config.height;
    const start = worldData.startPos;
    const startYOffset = (viewH * 3) / 10;

    this.car = this.physics.add.sprite(start.x, start.y + startYOffset, "car");
    this.car.setOrigin(0.5).setDepth(2);
    this.car.body.allowRotation = false;
    this.carController = new Car(this, this.car, worldData);
    this.carController.resetState(start.x, start.y + startYOffset);

    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasdKeys = this.input.keyboard.addKeys({
      up: window.Phaser.Input.Keyboard.KeyCodes.W,
      down: window.Phaser.Input.Keyboard.KeyCodes.S,
      left: window.Phaser.Input.Keyboard.KeyCodes.A,
      right: window.Phaser.Input.Keyboard.KeyCodes.D,
    });

    this.cameraManager = new CameraManager(this, this.car, worldData.worldSize);

    this.vKey = this.input.keyboard.addKey(window.Phaser.Input.Keyboard.KeyCodes.V);
    this.rKey = this.input.keyboard.addKey(window.Phaser.Input.Keyboard.KeyCodes.R);
    this.xKey = this.input.keyboard.addKey(window.Phaser.Input.Keyboard.KeyCodes.X);

    if (this.isMobile()) {
      this.control = {};
      this.game.events.on("hud-control", (control) => {
        this.control = control;
        if (control.v) this.cameraManager.toggle();
        if (control.r) this.resetGame();
        if (control.x) this.exitToMenu();
      });
      this.hudInfoText = this.control;
    } else {
      this.hudInfoText = this.add
        .text(10, 10, "V - zmiana kamery\nR - reset\nX - exit", {
          fontFamily: "Stormfaze",
          font: "20px Stormfaze",
          fill: "#fff",
          backgroundColor: "rgb(31, 31, 31)",
          padding: { left: 8, right: 8, top: 4, bottom: 4 },
        })
        .setScrollFactor(0)
        .setDepth(100);
    }

    this.world = new World(this, worldData, tileSize, viewW, viewH);
    if (worldData.worldSize) this.worldSize = worldData.worldSize;

    if (this.minimapa) {
      this.cameras.main.ignore([this.hudInfoText]);
      await this.world.initMinimap(worldData.svgPath, this.hudInfoText);
    } else {
      const hudObjects = [this.hudInfoText];
      this.hudCamera = this.cameras.add(0, 0, viewW, viewH, false, "hud");
      this.cameras.main.ignore(hudObjects);
      this.hudCamera.ignore(this.children.list.filter(function (obj) {
        return hudObjects.indexOf(obj) === -1;
      }));
      this.hudCamera.setScroll(0, 0);
      this.hudCamera.setRotation(0);
    }

    window.dispatchEvent(new Event("game-ready"));
    skidMarks = new SkidMarks({ enabled: skidMarksEnabled, wheelWidth: 12 });
  }

  update(time, dt) {
    dt = dt / 1000;

    if (this.vKey && window.Phaser.Input.Keyboard.JustDown(this.vKey)) this.cameraManager.toggle();
    if (this.rKey && window.Phaser.Input.Keyboard.JustDown(this.rKey)) this.resetGame();
    if (this.xKey && window.Phaser.Input.Keyboard.JustDown(this.xKey)) this.exitToMenu();

    const control = getControlState(this);
    const throttle = this.carController.updateInput(control).throttle;
    this.carController.update(dt, control, this.worldSize, this.worldSize);
    const carPos = this.carController.getPosition();
    this.world.drawTiles(carPos.x, carPos.y);

    if (skidMarks && skidMarks.enabled) {
      updateSkidMarks(this, tileSize, skidMarks, throttle);
    }

    if (this.minimapa && this.world) {
      this.world.drawMinimap(carPos, this.worldSize, this.worldSize);
    }

    if (this.cameraManager) this.cameraManager.update(dt);
    if (this.hudCamera) this.hudCamera.setRotation(0);
    if (this.hudContainer) this.hudContainer.rotation = 0;
    if (this.gasBtn) this.gasBtn.rotation = 0;
    if (this.brakeBtn) this.brakeBtn.rotation = 0;
  }

  resetGame() {
    const worldData = this.worldData || window._worldData;
    const viewH = this.sys.game.config.height;
    const start = worldData.startPos;
    const startYOffset = (viewH * 3) / 10;
    this.carController.resetState(start.x, start.y + startYOffset);

    if (this.world) {
      this.world.trackTiles = [];
      for (const pair of this.world.tilePool.entries()) {
        const tileObj = pair[1];
        tileObj.setVisible(false);
      }
    }

    if (this.cameraManager) this.cameraManager.reset();
    if (skidMarks) skidMarks.clear();
  }

  exitToMenu() {
    this.scene.start("MenuScene");
  }
}
