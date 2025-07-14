// main.js
import { MenuScene } from './MenuScene.js';
import { LoadingScene } from './LoadingScene.js';
import { GameScene } from './game.js';

const tileSize  = 256;
const worldH    = 6144;

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
    antialias: false
  },
  physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
  scene: [LoadingScene, MenuScene, GameScene],
  // USUWAM canvas: niech Phaser sam utworzy element
};

window._phaserGame = new Phaser.Game(config);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/fullspeed2skid/service-worker.js');
  });
}

export { tileSize, worldH };
