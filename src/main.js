// main.js
import { showLoadingOverlay, hideLoadingOverlay } from './loadingScreen.js';
import { showMenuOverlay } from './menu.js';
import { startGame } from './game.js';
import { World } from './world.js';

const tileSize  = 256;
const worldH    = 4096;

showMenuOverlay();

async function main() {
  let fakeProgress = 0;
  let progressInterval = setInterval(() => {
    if (fakeProgress < 90) {
      fakeProgress++;
    }
  }, 8);
  const worldData = await World.loadWorld('assets/levels/scene_1.svg', worldH, tileSize);
  clearInterval(progressInterval);
  startGame(worldData);
  window.addEventListener('game-ready', () => {
    hideLoadingOverlay();
  }, { once: true });
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/fullspeed2skid/service-worker.js');
  });
}

export { main };
