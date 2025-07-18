import { CameraManager } from './cameras.js';
import { Car } from './car.js';
import { World } from './world.js';
import { tileSize } from './main.js';
import { SkidMarks } from './skidMarks.js';

const FPS_SMOOTH = 10;
let fpsHistory = [];
let targetFps = 60;
let fpsSwitchCooldown = 0;
let skidMarks = null;
let skidMarksEnabled = true; // Możesz sterować flagą

export class GameScene extends window.Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
    this.minimapa = true;
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
        const cropped = document.createElement('canvas');
        cropped.width = tileSize;
        cropped.height = tileSize;
        cropped.getContext('2d').drawImage(tile.canvas, 0, 0, tileSize, tileSize, 0, 0, tileSize, tileSize);
        this.textures.addCanvas(tile.id, cropped);
      }
    }
    this.load.image('car', 'assets/images/car.png');
  }

  async create() {
    const worldData = this.worldData || window._worldData;
    const viewW = this.sys.game.config.width;
    const viewH = this.sys.game.config.height;
    const start = worldData.startPos;
    const startYOffset = viewH * 3/10;
    this.car = this.physics.add.sprite(start.x, start.y + startYOffset, 'car');
    this.car.setOrigin(0.5).setDepth(2);
    this.car.body.allowRotation = false;
    this.carController = new Car(this, this.car, worldData);
    this.carController.resetState(start.x, start.y + startYOffset);
    this.cursors = this.input.keyboard.createCursorKeys();
    this.vKey = this.input.keyboard.addKey(window.Phaser.Input.Keyboard.KeyCodes.V);
    this.wasdKeys = this.input.keyboard.addKeys({
      up: window.Phaser.Input.Keyboard.KeyCodes.W,
      down: window.Phaser.Input.Keyboard.KeyCodes.S,
      left: window.Phaser.Input.Keyboard.KeyCodes.A,
      right: window.Phaser.Input.Keyboard.KeyCodes.D
    });
    this.cameraManager = new CameraManager(this, this.car, worldData.worldSize);
    this.fpsText = this.add.text(10, 10, 'FPS: 0\nV - zmiana kamery\nR - reset\nX - exit', {
      fontFamily: 'Stormfaze',
      font: '20px Stormfaze',
      fill: '#fff',
      backgroundColor: 'rgb(31, 31, 31)',
      padding: { left: 8, right: 8, top: 4, bottom: 4 },
    }).setScrollFactor(0).setDepth(100);
    this.world = new World(this, worldData, tileSize, viewW, viewH);
    if (worldData.worldSize) {
      this.worldSize = worldData.worldSize;
    }
    if (this.minimapa) {
      this.cameras.main.ignore([this.fpsText]);
      await this.world.initMinimap(worldData.svgPath, this.fpsText);
    } else {
      const hudObjects = [this.fpsText];
      this.hudCamera = this.cameras.add(0, 0, viewW, viewH, false, 'hud');
      this.cameras.main.ignore(hudObjects);
      this.hudCamera.ignore(this.children.list.filter(obj => !hudObjects.includes(obj)));
      this.hudCamera.setScroll(0, 0);
      this.hudCamera.setRotation(0);
    }
    this.rKey = this.input.keyboard.addKey(window.Phaser.Input.Keyboard.KeyCodes.R);
    this.xKey = this.input.keyboard.addKey(window.Phaser.Input.Keyboard.KeyCodes.X);
    window.dispatchEvent(new Event('game-ready'));
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
    this.carController.update(dt, control, this.worldSize, this.worldSize);
    const carPos = this.carController.getPosition();
    this.world.drawTiles(carPos.x, carPos.y);
    if (skidMarks && skidMarks.enabled) {
      const steerAngle = this.carController.getSteerAngle();
      for (let i = 0; i < 4; i++) {
        const slip = this.carController.getWheelSlip(i);
        const curr = this.carController.getWheelWorldPosition(i);
        skidMarks.update(i, curr, slip, steerAngle, this.world.tilePool, tileSize);
      }
    }
    if (this.fpsText) {
      const fpsNow = 1 / dt;
      fpsHistory.push(fpsNow);
      if (fpsHistory.length > FPS_SMOOTH) fpsHistory.shift();
      const fpsAvg = fpsHistory.reduce((a, b) => a + b, 0) / fpsHistory.length;
      const fpsStable = Math.round(fpsAvg);
      this.fpsText.setText(`FPS: ${fpsStable}\nV - zmiana kamery\nR - reset\nX - exit`);
      if (fpsSwitchCooldown > 0) fpsSwitchCooldown--;
      else if (window._phaserGame && window._phaserGame.loop) {
        if (targetFps === 60 && fpsAvg < 50) {
          window._phaserGame.loop.targetFps = 30;
          targetFps = 30;
          fpsSwitchCooldown = 120;
        } else if (targetFps === 30 && fpsAvg > 55) {
          window._phaserGame.loop.targetFps = 60;
          targetFps = 60;
          fpsSwitchCooldown = 120;
        }
      }
    }
    if (this.minimapa && this.world) {
      this.world.drawMinimap(carPos, this.worldSize, this.worldSize);
    }
    if (this.cameraManager) {
      this.cameraManager.update(dt);
    }
  }

  getControlState() {
    const upPressed    = (this.cursors.up.isDown    || this.wasdKeys.up.isDown);
    const downPressed  = (this.cursors.down.isDown  || this.wasdKeys.down.isDown);
    const leftPressed  = (this.cursors.left.isDown  || this.wasdKeys.left.isDown);
    const rightPressed = (this.cursors.right.isDown || this.wasdKeys.right.isDown);
    let up = false, down = false, left = false, right = false;
    if (upPressed && !downPressed) up = true;
    else if (downPressed && !upPressed) down = true;
    if (leftPressed && !rightPressed) left = true;
    else if (rightPressed && !leftPressed) right = true;
    if (up) {
      if (this.cursors.up.isDown && this.wasdKeys.up.isDown) {
        up = this.cursors.up.timeDown < this.wasdKeys.up.timeDown;
      }
    }
    if (down) {
      if (this.cursors.down.isDown && this.wasdKeys.down.isDown) {
        down = this.cursors.down.timeDown < this.wasdKeys.down.timeDown;
      }
    }
    if (left) {
      if (this.cursors.left.isDown && this.wasdKeys.left.isDown) {
        left = this.cursors.left.timeDown < this.wasdKeys.left.timeDown;
      }
    }
    if (right) {
      if (this.cursors.right.isDown && this.wasdKeys.right.isDown) {
        right = this.cursors.right.timeDown < this.wasdKeys.right.timeDown;
      }
    }
    return { up, down, left, right };
  }

  resetGame() {
    const worldData = this.worldData || window._worldData;
    const viewH = this.sys.game.config.height;
    const start = worldData.startPos;
    const startYOffset = viewH * 3/10;
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
    if (skidMarks) skidMarks.clear();
  }

  exitToMenu() {
    this.scene.start('MenuScene');
  }
} 