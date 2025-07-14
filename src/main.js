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

// Dalej logika ładowania świata i startu gry będzie wywoływana przez sceny

async function main() {
  let fakeProgress = 0;
  let progressInterval = setInterval(() => {
    if (fakeProgress < 90) {
      fakeProgress++;
    }
  }, 8);
  const worldData = await World.loadWorld('assets/levels/scene_1.svg', worldH, tileSize);
  clearInterval(progressInterval);
  // startGame(worldData); // This line is removed as per the edit hint
  window.addEventListener('game-ready', () => {
    // hideLoadingOverlay(); // This line is removed as per the edit hint
  }, { once: true });
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/fullspeed2skid/service-worker.js');
  });
}

export { main };
