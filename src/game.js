import { CameraManager } from "./cameras.js";
import { Car } from "./car.js";
import { World } from "./world.js";
import { tileSize } from "./main.js";
import { SkidMarks } from "./skidMarks.js";

let skidMarks = null;
let skidMarksEnabled = true;

class HudMobileControls {
  constructor(scene) {
    this.scene = scene;
  }

  createButton(x, y, label, callback) {
    const marginX = 50;
    const marginY = 50;
    const diameter = 80;

    const centerX = x + marginX;
    const centerY = y + marginY;

    const circle = this.scene.add
      .circle(centerX, centerY, diameter / 2, 0x1f1f1f)
      .setAlpha(0.3)
      .setStrokeStyle(3, 0xffffff)
      .setInteractive()
      .setScrollFactor(0)
      .setDepth(100);

    const text = this.scene.add
      .text(centerX, centerY, label, {
        fontFamily: "Stormfaze",
        fontSize: "40px",
        color: "#ffffff",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(101);

    circle.on("pointerdown", callback);
  }

  createAll() {
    const spacing = 100;
    const margin = 30;
    const y = 30;

    this.createButton(margin + 0 * spacing, y, "V", () =>
      this.scene.cameraManager.toggle()
    );
    this.createButton(margin + 1 * spacing, y, "R", () =>
      this.scene.resetGame()
    );
    this.createButton(margin + 2 * spacing, y, "X", () =>
      this.scene.exitToMenu()
    );
  }
}

export class GameScene extends window.Phaser.Scene {
  constructor() {
    super({ key: "GameScene" });
    this.minimapa = true;
  }

  isMobile() {
    return /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop|Mobile/i.test(
      navigator.userAgent
    );
  }

  init(data) {
    this.worldData = data.worldData;
    window._worldData = data.worldData;
  }

  preload() {
    if (window._worldData && window._worldData.tiles) {
      for (const tile of window._worldData.tiles) {
        if (this.textures.exists(tile.id)) {
          this.textures.remove(tile.id);
        }
      }
      for (const tile of window._worldData.tiles) {
        const cropped = document.createElement("canvas");
        cropped.width = tileSize;
        cropped.height = tileSize;
        cropped
          .getContext("2d")
          .drawImage(
            tile.canvas,
            0,
            0,
            tileSize,
            tileSize,
            0,
            0,
            tileSize,
            tileSize
          );
        this.textures.addCanvas(tile.id, cropped);
      }
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
    this.vKey = this.input.keyboard.addKey(
      window.Phaser.Input.Keyboard.KeyCodes.V
    );
    this.wasdKeys = this.input.keyboard.addKeys({
      up: window.Phaser.Input.Keyboard.KeyCodes.W,
      down: window.Phaser.Input.Keyboard.KeyCodes.S,
      left: window.Phaser.Input.Keyboard.KeyCodes.A,
      right: window.Phaser.Input.Keyboard.KeyCodes.D,
    });

    this.cameraManager = new CameraManager(this, this.car, worldData.worldSize);

    if (this.isMobile()) {
      // ✅ Ustaw pusty tekst HUD (ale potrzebny do ignorowania przez kamerę)
      this.hudInfoText = this.add
        .text(0, 0, "", {
          fontSize: "1px", // mikroskopijny placeholder
        })
        .setScrollFactor(0)
        .setDepth(100);

      // ✅ Tworzenie przycisków gaz/hamulec
      const btnRadius = 60;
      const margin = 30;
      const y = this.sys.game.config.height - btnRadius - margin - 40;

      this.gasBtn = this.add
        .circle(btnRadius + margin, y, btnRadius, 0x00cc00)
        .setAlpha(0.3)
        .setScrollFactor(0)
        .setDepth(100)
        .setStrokeStyle(3, 0xffffff)
        .setInteractive();
      this.add
        .text(btnRadius + margin, y, "↑", {
          font: "48px Arial",
          color: "#fff",
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(101);

      const w = this.sys.game.config.width;
      this.brakeBtn = this.add
        .circle(w - btnRadius - margin, y, btnRadius, 0xcc0000)
        .setAlpha(0.3)
        .setScrollFactor(0)
        .setDepth(100)
        .setStrokeStyle(3, 0xffffff)
        .setInteractive();
      this.add
        .text(w - btnRadius - margin, y, "↓", {
          font: "48px Arial",
          color: "#fff",
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(101);

      this.gasBtn.on("pointerdown", () => {
        this.control = this.control || {};
        this.control.up = true;
      });
      this.gasBtn.on("pointerup", () => {
        this.control.up = false;
      });
      this.gasBtn.on("pointerout", () => {
        this.control.up = false;
      });
      this.brakeBtn.on("pointerdown", () => {
        this.control = this.control || {};
        this.control.down = true;
      });
      this.brakeBtn.on("pointerup", () => {
        this.control.down = false;
      });
      this.brakeBtn.on("pointerout", () => {
        this.control.down = false;
      });

      // ✅ Tworzenie przycisków opcji (V/R/X) — HudMobileControls
      const mobileControls = new HudMobileControls(this);
      mobileControls.createAll();

      // ✅ Ignorujemy HUD w głównej kamerze (jak dla desktopu)
      const hudObjects = [this.hudInfoText, this.gasBtn, this.brakeBtn];
      hudObjects.push(
        ...this.children.list.filter((child) => child.depth >= 100)
      );

      this.cameras.main.ignore(hudObjects);

      this.hudCamera = this.cameras.add(0, 0, viewW, viewH, false, "hud");
      this.hudCamera.setScroll(0, 0);

      // <<< TUTAJ dodaj to aby ignorować kafle
      if (this.world && this.world.tilePool) {
        for (const tileObj of this.world.tilePool.values()) {
          this.hudCamera.ignore(tileObj);
        }
      }
      this.hudCamera.ignore(this.car);
    } else {
      this.hudInfoText = this.add
        .text(10, 10, "V - zmiana kamery\nR - reset\nX - exit", {
          fontFamily: "Stormfaze",
          font: "20px Stormfaze",
          fill: "#fff",
          backgroundColor: "rgba(31, 31, 31,0.5)",
          padding: { left: 8, right: 8, top: 4, bottom: 4 },
        })
        .setScrollFactor(0)
        .setDepth(100);
    }

    this.world = new World(this, worldData, tileSize, viewW, viewH);
    if (worldData.worldSize) {
      this.worldSize = worldData.worldSize;
    }

    if (this.minimapa) {
      this.cameras.main.ignore([this.hudInfoText]);
      await this.world.initMinimap(worldData.svgPath, this.hudInfoText);
    } else {
      const hudObjects = [this.hudInfoText];
      this.hudCamera = this.cameras.add(0, 0, viewW, viewH, false, "hud");
      this.cameras.main.ignore(hudObjects);
      this.hudCamera.ignore(
        this.children.list.filter((obj) => !hudObjects.includes(obj))
      );
      this.hudCamera.setScroll(0, 0);
      this.hudCamera.setRotation(0);
    }

    this.rKey = this.input.keyboard.addKey(
      window.Phaser.Input.Keyboard.KeyCodes.R
    );
    this.xKey = this.input.keyboard.addKey(
      window.Phaser.Input.Keyboard.KeyCodes.X
    );

    window.dispatchEvent(new Event("game-ready"));
    skidMarks = new SkidMarks({ enabled: skidMarksEnabled, wheelWidth: 12 });
  }

  update(time, dt) {
    dt = dt / 1000;

    if (this.vKey && window.Phaser.Input.Keyboard.JustDown(this.vKey)) {
      this.cameraManager.toggle();
    }
    if (this.rKey && window.Phaser.Input.Keyboard.JustDown(this.rKey)) {
      this.resetGame();
    }
    if (this.xKey && window.Phaser.Input.Keyboard.JustDown(this.xKey)) {
      this.exitToMenu();
    }

    const control = this.getControlState();
    const { throttle } = this.carController.updateInput(control);
    this.carController.update(dt, control, this.worldSize, this.worldSize);
    const carPos = this.carController.getPosition();
    this.world.drawTiles(carPos.x, carPos.y);

    // if (this.hudCamera && this.world.tilePool) {
    //   for (const tileObj of this.world.tilePool.values()) {
    //     this.hudCamera.ignore([tileObj, this.car]);
    //   }
    // }
    if (skidMarks && skidMarks.enabled) {
      const steerAngle = this.carController.getSteerAngle();
      const carMass = this.carController.carMass;
      const dirtyTiles = new Set();

      for (let i = 0; i < 4; i++) {
        const slip = this.carController.getWheelSlip(i);
        const curr = this.carController.getWheelWorldPosition(i);
        const surfaceType = this.world.getSurfaceTypeAt(curr.x, curr.y);
        const grip =
          this.world.worldData.surfaceParams?.[surfaceType]?.grip ?? 1.0;
        const maxSpeed = this.carController.maxSpeed;
        const wheelDirtyTiles = skidMarks.update(
          i,
          curr,
          slip,
          steerAngle,
          this.world.tilePool,
          tileSize,
          this.carController.getLocalSpeed(),
          grip,
          carMass,
          throttle,
          maxSpeed
        );
        wheelDirtyTiles &&
          wheelDirtyTiles.forEach((tile) => dirtyTiles.add(tile));
      }

      dirtyTiles.forEach((tile) => {
        if (tile && tile.texture) {
          tile.texture.refresh();
        }
      });
    }

    if (this.minimapa && this.world) {
      this.world.drawMinimap(carPos, this.worldSize, this.worldSize);
    }

    if (this.cameraManager) {
      this.cameraManager.update(dt);
    }
  }

  getControlState() {
    let upPressed = this.cursors.up.isDown || this.wasdKeys.up.isDown;
    let downPressed = this.cursors.down.isDown || this.wasdKeys.down.isDown;
    let leftPressed = this.cursors.left.isDown || this.wasdKeys.left.isDown;
    let rightPressed = this.cursors.right.isDown || this.wasdKeys.right.isDown;

    if (this.isMobile()) {
      upPressed = !!(this.control && this.control.up);
      downPressed = !!(this.control && this.control.down);

      if (window._gyroControl) {
        leftPressed = leftPressed || window._gyroControl.left;
        rightPressed = rightPressed || window._gyroControl.right;
      }
      if (this.control) {
        leftPressed = leftPressed || !!this.control.left;
        rightPressed = rightPressed || !!this.control.right;
      }
    }

    return {
      up: upPressed,
      down: downPressed,
      left: leftPressed,
      right: rightPressed,
    };
  }

  resetGame() {
    const worldData = this.worldData || window._worldData;
    const viewH = this.sys.game.config.height;
    const start = worldData.startPos;
    const startYOffset = (viewH * 3) / 10;
    this.carController.resetState(start.x, start.y + startYOffset);

    if (this.world) {
      this.world.trackTiles = [];
      for (const [tileId, tileObj] of this.world.tilePool.entries()) {
        tileObj.setVisible(false);
      }
    }

    if (this.cameraManager) {
      this.cameraManager.reset();
    }

    if (skidMarks) {
      skidMarks.clear();
    }
  }

  exitToMenu() {
    this.scene.start("MenuScene");
  }
}
