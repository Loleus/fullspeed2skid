// Import scen gry (ekran ładowania, menu, właściwa rozgrywka, HUD)
import { MenuScene } from './MenuScene.js';
import { LoadingScene } from './LoadingScene.js';
import { GameScene } from './game.js';
import { HudScene } from './HudScene.js';

// Rozmiar pojedynczego kafelka (używany np. w mapach)
const tileSize  = 256;
// Wysokość świata gry (możliwe do przewijania poziomy itp.)
const worldH    = 2048;

// Konfiguracja silnika Phaser
const config = {
  type: Phaser.AUTO, // automatyczny wybór WebGL lub Canvas
  width: 1280,        // szerokość widocznego obszaru gry
  height: 720,        // wysokość widocznego obszaru gry
  scale: {
    mode: Phaser.Scale.FIT,               // dopasowanie do okna przeglądarki
    autoCenter: Phaser.Scale.CENTER_BOTH, // centrowanie gry w oknie
    width: 1280,
    height: 720
  },
  render: {
    pixelArt: true,         // tryb pixel-art (brak wygładzania)
    antialias: false,       // brak antyaliasingu
    disableContextMenu: true // blokuj menu po kliknięciu prawym przyciskiem myszy
  },
  physics: {
    default: 'arcade',      // silnik fizyczny typu arcade
    arcade: {
      gravity: { y: 0 },    // brak grawitacji (gra 2D typu top-down)
      debug: false          // tryb debugowania fizyki wyłączony
    }
  },
  scene: [LoadingScene, MenuScene, GameScene, HudScene], // sceny w grze
  // Phaser sam utworzy element <canvas>, więc nie podajemy go ręcznie
};

// Inicjalizacja nowej gry Phaser i przypisanie do zmiennej globalnej
window._phaserGame = new Phaser.Game(config);

// Funkcja pomocnicza do wykrywania urządzeń iOS
function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

// Dynamiczne skalowanie canvasa na iOS — aby dopasować się do dostępnego obszaru
function resizeGameCanvas() {
  if (!isIOS()) return;

  const canvas = document.querySelector('canvas');
  if (!canvas) return;

  // Jeśli użytkownik jest w trybie fullscreen, pozostaw domyślny rozmiar
  if (document.fullscreenElement) {
    canvas.style.width = '';
    canvas.style.height = '';
    return;
  }

  // Dopasowanie rozmiaru canvasa do proporcji gry (1280:720)
  const w = window.innerWidth;
  const h = window.innerHeight;
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
  canvas.style.margin = '0 auto'; // centrowanie canvasu
}

// Obsługa zdarzeń związanych z rozmiarem i orientacją urządzenia na iOS
if (isIOS()) {
  window.addEventListener('resize', resizeGameCanvas);
  window.addEventListener('orientationchange', () => setTimeout(resizeGameCanvas, 300));
  document.addEventListener('fullscreenchange', resizeGameCanvas);
  window.addEventListener('DOMContentLoaded', () => setTimeout(resizeGameCanvas, 300));
  setTimeout(resizeGameCanvas, 500);
}

// Eksport przydatnych wartości do innych modułów
export { tileSize, worldH };
