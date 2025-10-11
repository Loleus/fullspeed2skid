// Import scen gry (ekran ładowania, menu, właściwa rozgrywka, HUD)
import { MenuScene } from '../scenes/MenuScene.js?v=';
import { LoadingScene } from '../scenes/LoadingScene.js?v=2.2.1';
import { GameScene } from '../scenes/GameScene.js?v=2.2.1';
import { HudScene } from '../scenes/HudScene.js?v=2.2.1';

// Import stałych globalnych
import { TILE_SIZE, WORLD_HEIGHT, GAME_CONFIG } from '../core/constants.js';

// Rozmiar pojedynczego kafelka (używany np. w mapach)
const tileSize  = TILE_SIZE;
// Wysokość świata gry (możliwe do przewijania poziomy itp.)
const worldH    = WORLD_HEIGHT;

// Konfiguracja silnika Phaser
const config = {
  type: Phaser[GAME_CONFIG.type], // automatyczny wybór WebGL lub Canvas
  width: GAME_CONFIG.width,        // szerokość widocznego obszaru gry
  height: GAME_CONFIG.height,      // wysokość widocznego obszaru gry
  scale: {
    mode: Phaser.Scale[GAME_CONFIG.scale.mode],               // dopasowanie do okna przeglądarki
    autoCenter: Phaser.Scale[GAME_CONFIG.scale.autoCenter], // centrowanie gry w oknie
    width: GAME_CONFIG.scale.width,
    height: GAME_CONFIG.scale.height
  },
  render: {
    pixelArt: GAME_CONFIG.render.pixelArt,         // tryb pixel-art (brak wygładzania)
    antialias: GAME_CONFIG.render.antialias,       // brak antyaliasingu
    disableContextMenu: GAME_CONFIG.render.disableContextMenu // blokuj menu po kliknięciu prawym przyciskiem myszy
  },
  physics: {
    default: GAME_CONFIG.physics.default,      // silnik fizyczny typu arcade
    arcade: {
      gravity: GAME_CONFIG.physics.arcade.gravity,    // brak grawitacji (gra 2D typu top-down)
      debug: GAME_CONFIG.physics.arcade.debug          // tryb debugowania fizyki wyłączony
    }
  },
  scene: [LoadingScene, MenuScene, GameScene, HudScene], // sceny w grze
  // Phaser sam utworzy element <canvas>, więc nie podajemy go ręcznie
};

// Inicjalizacja nowej gry Phaser i przypisanie do zmiennej globalnej
window._phaserGame = new Phaser.Game(config);

function isMobile() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function resizeGameCanvas() {
  if (!isMobile()) return;

  const canvas = document.querySelector('canvas');
  if (!canvas) return;

  if (document.fullscreenElement) {
    canvas.style.width = '';
    canvas.style.height = '';
    return;
  }

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
  canvas.style.margin = '0 auto';
}


// Obsługa zdarzeń związanych z rozmiarem i orientacją urządzenia na iOS
if (isMobile()) {
  window.addEventListener('resize', resizeGameCanvas);
  window.addEventListener('orientationchange', () => setTimeout(resizeGameCanvas, 300));
  document.addEventListener('fullscreenchange', resizeGameCanvas);
  window.addEventListener('DOMContentLoaded', () => setTimeout(resizeGameCanvas, 300));
  setTimeout(resizeGameCanvas, 500);
}

// Eksport przydatnych wartości do innych modułów
export { tileSize, worldH };
