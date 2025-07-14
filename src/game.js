import { CameraManager } from './cameras.js';
import { Car } from './car.js';
import { World } from './world.js';

const tileSize  = 256;
const viewW     = 1280;
const viewH     = 720;

let car, carController, cursors, wasdKeys;
let fpsText;
let world = null;
let worldSize = null;
let cameraManager = null;
let vKey = null;
let minimapa = true;
let fpsHistory = [];
const FPS_SMOOTH = 10;
let targetFps = 60;
let fpsSwitchCooldown = 0;

// Usuwam funkcję startGame i tworzę GameScene jako klasę Phaser.Scene

export class GameScene extends window.Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  init(data) {
    // Przechowuj worldData globalnie i lokalnie w scenie
    this.worldData = data.worldData;
    window._worldData = data.worldData;
  }

  preload() {
    // Wyczyść stare tekstury kafli, jeśli istnieją
    if (window._worldData && window._worldData.tiles) {
      for (const tile of window._worldData.tiles) {
        if (this.textures.exists(tile.id)) {
          this.textures.remove(tile.id);
        }
      }
      for (const tile of window._worldData.tiles) {
        const cropped = document.createElement('canvas');
        cropped.width = 256;
        cropped.height = 256;
        cropped.getContext('2d').drawImage(tile.canvas, 0, 0, 256, 256, 0, 0, 256, 256);
        this.textures.addCanvas(tile.id, cropped);
      }
    }
    this.load.image('car', 'assets/images/car.png');
  }

  async create() {
    const worldData = this.worldData || window._worldData;
    const viewW = 1280;
    const viewH = 720;
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
      font: '20px monospace',
      fill: '#fff',
      backgroundColor: 'rgb(31, 31, 31)',
      padding: { left: 8, right: 8, top: 4, bottom: 4 },
    }).setScrollFactor(0).setDepth(100);
    this.world = new World(this, worldData, 256, viewW, viewH);
    if (worldData.worldSize) {
      this.worldSize = worldData.worldSize;
    }
    if (minimapa) {
      this.cameras.main.ignore([this.fpsText]);
      await this.world.initMinimap('assets/levels/scene_1.svg', this.fpsText);
    } else {
      const hudObjects = [this.fpsText];
      this.hudCamera = this.cameras.add(0, 0, viewW, viewH, false, 'hud');
      this.cameras.main.ignore(hudObjects);
      this.hudCamera.ignore(this.children.list.filter(obj => !hudObjects.includes(obj)));
      this.hudCamera.setScroll(0, 0);
      this.hudCamera.setRotation(0);
    }
    
    // Dodaj obsługę klawisza R
    this.rKey = this.input.keyboard.addKey(window.Phaser.Input.Keyboard.KeyCodes.R);
    
    // Dodaj obsługę klawisza X
    this.xKey = this.input.keyboard.addKey(window.Phaser.Input.Keyboard.KeyCodes.X);
    window.dispatchEvent(new Event('game-ready'));
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
    if (this.fpsText) {
      const fpsNow = 1 / dt;
      fpsHistory.push(fpsNow);
      if (fpsHistory.length > FPS_SMOOTH) fpsHistory.shift();
      const fpsAvg = fpsHistory.reduce((a, b) => a + b, 0) / fpsHistory.length;
      const fpsStable = Math.round(fpsAvg);
      this.fpsText.setText(`FPS: ${fpsStable}\nV - zmiana kamery\nR - reset\nX - exit`);
      // --- Automatyczne przełączanie FPS ---
      if (fpsSwitchCooldown > 0) fpsSwitchCooldown--;
      else if (window._phaserGame && window._phaserGame.loop) {
        if (targetFps === 60 && fpsAvg < 50) {
          window._phaserGame.loop.targetFps = 30;
          targetFps = 30;
          fpsSwitchCooldown = 120; // 2 sekundy
        } else if (targetFps === 30 && fpsAvg > 55) {
          window._phaserGame.loop.targetFps = 60;
          targetFps = 60;
          fpsSwitchCooldown = 120;
        }
      }
    }
    if (minimapa && this.world) {
      this.world.drawMinimap(carPos, this.worldSize, this.worldSize);
    }
    if (this.cameraManager) {
      this.cameraManager.update(dt);
    }
  }

  getControlState() {
    // Zbierz stany klawiszy
    const upPressed    = (this.cursors.up.isDown    || this.wasdKeys.up.isDown);
    const downPressed  = (this.cursors.down.isDown  || this.wasdKeys.down.isDown);
    const leftPressed  = (this.cursors.left.isDown  || this.wasdKeys.left.isDown);
    const rightPressed = (this.cursors.right.isDown || this.wasdKeys.right.isDown);
    // Zabezpieczenie: nie pozwól na jednoczesne przeciwne kierunki
    let up = false, down = false, left = false, right = false;
    if (upPressed && !downPressed) up = true;
    else if (downPressed && !upPressed) down = true;
    if (leftPressed && !rightPressed) left = true;
    else if (rightPressed && !leftPressed) right = true;
    // Priorytet: jeśli oba zestawy mają ten sam kierunek, rejestruj tylko pierwszy wciśnięty
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
    const viewH = 720;
    const start = worldData.startPos;
    const startYOffset = viewH * 3/10;
    
    // Reset pozycji auta
    this.carController.resetState(start.x, start.y + startYOffset);
    
    // Wyczyść kafle świata
    if (this.world) {
      this.world.trackTiles = [];
      for (const [tileId, tileObj] of this.world.tilePool.entries()) {
        tileObj.setVisible(false);
      }
    }
    
    // Reset kamery
    if (this.cameraManager) {
      this.cameraManager.reset();
    }
  }

  exitToMenu() {
    // Przełącz na MenuScene
    this.scene.start('MenuScene');
  }
} 