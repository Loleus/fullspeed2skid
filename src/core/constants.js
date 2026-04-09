// constants.js - Globalne stałe gry

// Rozmiar pojedynczego kafelka (używany np. w mapach)
export const TILE_SIZE = 256;

// Wysokość świata gry (możliwe do przewijania poziomy itp.)
export const WORLD_HEIGHT = 3072;

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
    pixelArt: false, // wyłącza nearest-neighbor
    antialias: true, // włącza wygładzanie tekstur
    antialiasGL: true, // dodatkowe wygładzanie w WebGL
    roundPixels: false, // nie zaokrąglaj pozycji sprite'ów (ważne dla płynności ruchu)
    disableContextMenu: true // blokuj menu po kliknięciu prawym przyciskiem myszy
    // premultipliedAlpha: false
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
