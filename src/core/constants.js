// constants.js - Globalne stałe gry

// Rozmiar pojedynczego kafelka (używany np. w mapach)
export const TILE_SIZE = 256;

// Wysokość świata gry (możliwe do przewijania poziomy itp.)
export const WORLD_HEIGHT = 2048;

// Konfiguracja gry Phaser
export const GAME_CONFIG = {
  type: 'AUTO', // automatyczny wybór WebGL lub Canvas
  width: 1280,  // szerokość widocznego obszaru gry
  height: 720,  // wysokość widocznego obszaru gry
  scale: {
    mode: 'FIT',               // dopasowanie do okna przeglądarki
    autoCenter: 'CENTER_BOTH', // centrowanie gry w oknie
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
  }
};

// Eksport dla kompatybilności wstecznej
export const tileSize = TILE_SIZE;
export const worldH = WORLD_HEIGHT;
