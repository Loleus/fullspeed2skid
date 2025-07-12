// main.js
import { CameraManager } from './cameras.js';
import { Car } from './car.js';
import { World } from './world.js';

const tileSize  = 256;
const worldW    = 6144;
const worldH    = 6144;
const viewW     = 1280;
const viewH     = 720;

let car, carController, cursors;
let fpsText;
let world = null;
let cameraManager = null;
let vKey = null;
let minimapa = true;

// --- EKRAN ŁADOWANIA ---
let loadingOverlay, loadingCircle, loadingText;
let loadingProgress = 0;
let loadingFadeOut = false;
let loaderShouldHide = false;

function showLoadingOverlay() {
  loadingOverlay = document.createElement('div');
  loadingOverlay.className = 'loading-overlay';
  loadingCircle = document.createElement('div');
  loadingCircle.className = 'loading-circle';
  loadingText = document.createElement('div');
  loadingText.className = 'loading-text';
  loadingText.innerText = '0%';
  loadingCircle.appendChild(loadingText);
  loadingOverlay.appendChild(loadingCircle);
  document.body.appendChild(loadingOverlay);
}

function setLoadingProgress(percent) {
  loadingProgress = percent;
  if (loadingText) loadingText.innerText = percent + '%';
  if (percent >= 100 && !loadingFadeOut) {
    loadingFadeOut = true;
    loadingOverlay.style.opacity = '0';
    setTimeout(() => {
      if (loadingOverlay && loadingOverlay.parentNode) loadingOverlay.parentNode.removeChild(loadingOverlay);
    }, 300);
  }
}

showLoadingOverlay();

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

async function startGame() {
  let fakeProgress = 0;
  let progressInterval = setInterval(() => {
    if (fakeProgress < 90) {
      fakeProgress++;
      setLoadingProgress(fakeProgress);
    }
  }, 8);
  const worldData = await World.loadWorld('assets/levels/scene_1.svg', worldH, tileSize);
  setLoadingProgress(95);
  clearInterval(progressInterval);
  window._worldData = worldData; // debug
  new Phaser.Game(config);
}

startGame();

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
  setTimeout(() => {
    setLoadingProgress(100);
  }, 0);
}

function update(time, dt) {
  dt = dt / 1000;
  if (vKey && Phaser.Input.Keyboard.JustDown(vKey)) {
    cameraManager.toggle();
  }
  carController.update(dt, cursors, worldW, worldH);
  // --- Dynamiczne dorysowywanie kafli świata ---
  const carPos = carController.getPosition();
  world.drawTiles(carPos.x, carPos.y);
  // —— Licznik FPS + info o zmianie kamery
  if (fpsText) {
    const fps = (1 / dt).toFixed(1);
    fpsText.setText(`FPS: ${fps}\nV - zmiana kamery`);
  }
  // ===================== MINIMAPA: rysowanie pozycji gracza =====================
  if (minimapa && world) {
    world.drawMinimap(carPos, worldW, worldH);
  }
  // --- AKTUALIZACJA KAMER ---
  if (cameraManager) {
    cameraManager.update(dt);
  }
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/fullspeed2skid/service-worker.js');
  });
}
