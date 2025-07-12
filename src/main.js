// main.js
import { showLoadingOverlay, setLoadingProgress } from './loadingScreen.js';
import { startGame } from './game.js';
import { World } from './world.js';

const tileSize  = 256;
const worldH    = 6144;

showLoadingOverlay();

async function main() {
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
  setTimeout(() => setLoadingProgress(100), 0);
  startGame(worldData);
}

main();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/fullspeed2skid/service-worker.js');
  });
}
