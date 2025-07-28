// main.js
import { MenuScene } from './MenuScene.js';
import { LoadingScene } from './LoadingScene.js';
import { GameScene } from './game.js';

const tileSize  = 256;
const worldH    = 2048;

// Inicjalizacja Phasera z LoadingScene i MenuScene
const config = {
  type: Phaser.AUTO,
  width: 1280,
  height: 720,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1280,
    height: 720
  },
  render: {
    pixelArt: true,
    antialias: false,
    disableContextMenu: true
  },
  physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
  scene: [LoadingScene, MenuScene, GameScene],
  // USUWAM canvas: niech Phaser sam utworzy element
};

window._phaserGame = new Phaser.Game(config);

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function resizeGameCanvas() {
  if (!isIOS()) return;
  const canvas = document.querySelector('canvas');
  if (!canvas) return;
  // Jeśli fullscreen, nie zmieniaj rozmiaru
  if (document.fullscreenElement) {
    canvas.style.width = '';
    canvas.style.height = '';
    return;
  }
  // Dopasuj do widocznego okna (bez paska przeglądarki)
  const w = window.innerWidth;
  const h = window.innerHeight;
  // Zachowaj proporcje gry (1280x720)
  const aspect = 1280 / 720;
  let newW = w;
  let newH = Math.round(w / aspect);
  if (newH > h) {
    newH = h;
    newW = Math.round(h * aspect);
  }
  canvas.style.width = newW + 'px';
  canvas.style.height = newH + 'px';
  canvas.style.display = 'block';
  canvas.style.margin = '0 auto';
}

if (isIOS()) {
  window.addEventListener('resize', resizeGameCanvas);
  window.addEventListener('orientationchange', () => setTimeout(resizeGameCanvas, 300));
  document.addEventListener('fullscreenchange', resizeGameCanvas);
  window.addEventListener('DOMContentLoaded', () => setTimeout(resizeGameCanvas, 300));
  setTimeout(resizeGameCanvas, 500);
}

export { tileSize, worldH };
