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

  isMobile() {
    return /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop|Mobile/i.test(navigator.userAgent);
  }

  setupGyroControl() {
    if (!this.isMobile()) return;
    const handleGyro = (event) => {
      if (!this.control) this.control = {};
      const tiltLR = event.gamma;
      this.control.left = tiltLR < -10;
      this.control.right = tiltLR > 10;
    };
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission().then(response => {
        if (response === 'granted') {
          window.addEventListener('deviceorientation', handleGyro, true);
        }
      });
    } else {
      window.addEventListener('deviceorientation', handleGyro, true);
    }
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

    // --- HUD mobilny: kółka gazu i hamulca ---
    if (this.isMobile()) {
      const btnRadius = 60;
      const margin = 30;
      const y = this.sys.game.config.height - btnRadius - margin;
      // Gaz (lewa)
      this.gasBtn = this.add.circle(btnRadius + margin, y, btnRadius, 0x00cc00)
        .setScrollFactor(0)
        .setDepth(100)
        .setInteractive();
      this.add.text(btnRadius + margin, y, '↑', { font: '48px Arial', color: '#fff' })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(101);
      // Hamulec (prawa)
      const w = this.sys.game.config.width;
      this.brakeBtn = this.add.circle(w - btnRadius - margin, y, btnRadius, 0xcc0000)
        .setScrollFactor(0)
        .setDepth(100)
        .setInteractive();
      this.add.text(w - btnRadius - margin, y, '↓', { font: '48px Arial', color: '#fff' })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(101);
      // Obsługa dotyku
      this.gasBtn.on('pointerdown', () => { this.control = this.control || {}; this.control.up = true; });
      this.gasBtn.on('pointerup', () => { this.control.up = false; });
      this.gasBtn.on('pointerout', () => { this.control.up = false; });
      this.brakeBtn.on('pointerdown', () => { this.control = this.control || {}; this.control.down = true; });
      this.brakeBtn.on('pointerup', () => { this.control.down = false; });
      this.brakeBtn.on('pointerout', () => { this.control.down = false; });
      // Żyroskop
      this.setupGyroControl();
    }
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
    if (skidMarks && skidMarks.enabled) {
      const steerAngle = this.carController.getSteerAngle();
      const velocity = this.carController.getVelocity();
      const carMass = this.carController.carMass;
      if (!this._lastWheelLog) this._lastWheelLog = [0, 0, 0, 0];
      const now = performance.now();
      // Nowa logika: agregujemy wszystkie "brudne" kafelki do jednego zbioru
      const dirtyTiles = new Set();
      for (let i = 0; i < 4; i++) {
        const slip = this.carController.getWheelSlip(i);
        const curr = this.carController.getWheelWorldPosition(i);
        // Pobierz grip dla pozycji koła
        const surfaceType = this.world.getSurfaceTypeAt(curr.x, curr.y);
        const grip = this.world.worldData.surfaceParams?.[surfaceType]?.grip ?? 1.0;
        const maxSpeed = this.carController.maxSpeed;
        const wheelDirtyTiles = skidMarks.update(i, curr, slip, steerAngle, this.world.tilePool, tileSize, this.carController.getLocalSpeed(), grip, carMass, throttle, maxSpeed);
        wheelDirtyTiles && wheelDirtyTiles.forEach(tile => dirtyTiles.add(tile));
      }
      // Odśwież tekstury tylko raz na klatkę dla wszystkich zmienionych kafelków
      dirtyTiles.forEach(tile => {
        if (tile && tile.texture) {
          tile.texture.refresh();
        }
      });
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
    // --- Integracja mobilnych przycisków i żyroskopu ---
    if (this.isMobile && this.control) {
      up = !!this.control.up;
      down = !!this.control.down;
      left = !!this.control.left;
      right = !!this.control.right;
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