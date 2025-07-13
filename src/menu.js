import { showLoadingOverlay } from './loadingScreen.js';
import { main } from './main.js';

export function showMenuOverlay() {
  // Sprawdź czy menu już nie jest wyświetlane
  if (document.querySelector('.menu-overlay')) {
    return;
  }
  
  // Tworzenie tła
  const menuOverlay = document.createElement('div');
  menuOverlay.className = 'menu-overlay';
  menuOverlay.style.backgroundImage = "url('assets/images/asphalt.jpg')";
  menuOverlay.style.backgroundRepeat = 'repeat';
  menuOverlay.style.position = 'fixed';
  menuOverlay.style.left = '0';
  menuOverlay.style.top = '0';
  menuOverlay.style.width = '100vw';
  menuOverlay.style.height = '100vh';
  menuOverlay.style.display = 'flex';
  menuOverlay.style.flexDirection = 'column';
  menuOverlay.style.alignItems = 'center';
  menuOverlay.style.justifyContent = 'center';
  menuOverlay.style.zIndex = '10000';

  // Przycisk START
  const startBtn = document.createElement('div');
  startBtn.innerText = 'START';
  startBtn.className = 'menu-btn';
  startBtn.style.margin = '20px 0';
  menuOverlay.appendChild(startBtn);

  // Przycisk CAR
  const carBtn = document.createElement('div');
  carBtn.innerText = 'CAR';
  carBtn.className = 'menu-btn menu-btn-disabled';
  carBtn.style.margin = '20px 0';
  menuOverlay.appendChild(carBtn);

  // Przycisk TRACK 1
  const trackBtn = document.createElement('div');
  trackBtn.innerText = 'TRACK 1';
  trackBtn.className = 'menu-btn menu-btn-disabled';
  trackBtn.style.margin = '20px 0';
  menuOverlay.appendChild(trackBtn);

  // Przycisk FULLSCREEN
  const fullscreenBtn = document.createElement('div');
  fullscreenBtn.innerText = 'FULLSCREEN';
  fullscreenBtn.className = 'menu-btn';
  fullscreenBtn.style.margin = '20px 0';
  menuOverlay.appendChild(fullscreenBtn);

  document.body.appendChild(menuOverlay);

  // Obsługa przycisku START
  startBtn.onclick = () => {
    menuOverlay.remove();
    
    // Pokaż grę jeśli była ukryta
    const canvas = document.querySelector('#phaser-canvas');
    if (canvas) {
      canvas.style.display = 'block';
    }
    
    // Sprawdź czy gra już jest uruchomiona
    if (!window.gameStarted) {
      window.gameStarted = true;
      showLoadingOverlay();
      main();
    }
  };
  // Obsługa fullscreen
  fullscreenBtn.onclick = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.body.requestFullscreen();
    }
  };
} 