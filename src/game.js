import { CameraManager } from './cameras.js';
import { Car } from './car.js';
import { World } from './world.js';

const tileSize  = 256;
const worldW    = 6144;
const worldH    = 6144;
const viewW     = 1280;
const viewH     = 720;

let car, carController, cursors, wasdKeys;
let fpsText;
let world = null;
let cameraManager = null;
let vKey = null;
let minimapa = true;

export function startGame(worldData) {
  const config = {
    type: Phaser.AUTO,
    width: viewW,
    height: viewH,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: viewW,
      height: viewH
    },
    render: {
      pixelArt: true,
      antialias: false
    },
    physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false }},
    scene: { preload, create, update }
  };
  window._worldData = worldData; // debug
  new Phaser.Game(config);
}

function preload() {
  for (const tile of window._worldData.tiles) {
    const cropped = document.createElement('canvas');
    cropped.width = tileSize;
    cropped.height = tileSize;
    cropped.getContext('2d').drawImage(tile.canvas, 0, 0, tileSize, tileSize, 0, 0, tileSize, tileSize);
    this.textures.addCanvas(tile.id, cropped);
  }
  this.load.image('car', 'assets/images/car.png');
}

async function create() {
  const worldData = window._worldData;
  const start = worldData.startPos;
  const startYOffset = viewH * 3/10;
  car = this.physics.add.sprite(start.x, start.y + startYOffset, 'car');
  car.setOrigin(0.5).setDepth(2);
  car.body.allowRotation = false;
  carController = new Car(this, car, worldData);
  carController.resetState(start.x, start.y + startYOffset);
  cursors = this.input.keyboard.createCursorKeys();
  vKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.V);
  // Dodaj obsługę WSAD
  wasdKeys = this.input.keyboard.addKeys({
    up: Phaser.Input.Keyboard.KeyCodes.W,
    down: Phaser.Input.Keyboard.KeyCodes.S,
    left: Phaser.Input.Keyboard.KeyCodes.A,
    right: Phaser.Input.Keyboard.KeyCodes.D
  });
  cameraManager = new CameraManager(this, car);
  fpsText = this.add.text(10, 10, 'FPS: 0', {
    font: '20px monospace',
    fill: '#fff',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: { left: 8, right: 8, top: 4, bottom: 4 },
  }).setScrollFactor(0).setDepth(100);
  world = new World(this, worldData, tileSize, viewW, viewH);
  if (minimapa) {
    await world.initMinimap('assets/levels/scene_1.svg', fpsText);
  } else {
    const hudObjects = [fpsText];
    this.hudCamera = this.cameras.add(0, 0, viewW, viewH, false, 'hud');
    this.cameras.main.ignore(hudObjects);
    this.hudCamera.ignore(this.children.list.filter(obj => !hudObjects.includes(obj)));
    this.hudCamera.setScroll(0, 0);
    this.hudCamera.setRotation(0);
  }
}

function getControlState() {
  // Zbierz stany klawiszy
  const upPressed    = (cursors.up.isDown    || wasdKeys.up.isDown);
  const downPressed  = (cursors.down.isDown  || wasdKeys.down.isDown);
  const leftPressed  = (cursors.left.isDown  || wasdKeys.left.isDown);
  const rightPressed = (cursors.right.isDown || wasdKeys.right.isDown);
  // Zabezpieczenie: nie pozwól na jednoczesne przeciwne kierunki
  let up = false, down = false, left = false, right = false;
  if (upPressed && !downPressed) up = true;
  else if (downPressed && !upPressed) down = true;
  if (leftPressed && !rightPressed) left = true;
  else if (rightPressed && !leftPressed) right = true;
  // Priorytet: jeśli oba zestawy mają ten sam kierunek, rejestruj tylko pierwszy wciśnięty
  if (up) {
    if (cursors.up.isDown && wasdKeys.up.isDown) {
      up = cursors.up.timeDown < wasdKeys.up.timeDown;
    }
  }
  if (down) {
    if (cursors.down.isDown && wasdKeys.down.isDown) {
      down = cursors.down.timeDown < wasdKeys.down.timeDown;
    }
  }
  if (left) {
    if (cursors.left.isDown && wasdKeys.left.isDown) {
      left = cursors.left.timeDown < wasdKeys.left.timeDown;
    }
  }
  if (right) {
    if (cursors.right.isDown && wasdKeys.right.isDown) {
      right = cursors.right.timeDown < wasdKeys.right.timeDown;
    }
  }
  return { up, down, left, right };
}

function update(time, dt) {
  dt = dt / 1000;
  if (vKey && Phaser.Input.Keyboard.JustDown(vKey)) {
    cameraManager.toggle();
  }
  const control = getControlState();
  carController.update(dt, control, worldW, worldH);
  const carPos = carController.getPosition();
  world.drawTiles(carPos.x, carPos.y);
  if (fpsText) {
    const fps = (1 / dt).toFixed(1);
    fpsText.setText(`FPS: ${fps}\nV - zmiana kamery`);
  }
  if (minimapa && world) {
    world.drawMinimap(carPos, worldW, worldH);
  }
  if (cameraManager) {
    cameraManager.update(dt);
  }
} 