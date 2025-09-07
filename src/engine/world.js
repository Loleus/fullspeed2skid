// world.js - logika świata, kafli, minimapy i typów nawierzchni
import { loadSVGPhaserWorld, createMinimapTextureFromSVG } from './svgPhaserWorldLoader.js';

export class World {
  constructor(scene, worldData, tileSize, viewW, viewH) {
    this.scene = scene;
    this.worldData = worldData;
    this.tileSize = tileSize;
    this.viewW = viewW;
    this.viewH = viewH;
    this.trackTiles = [];
    this.tilePool = new Map(); // pooling kafli
    // Minimap-related
    this.minimapKey = null;
    this.minimapImage = null;
    this.minimapOverlay = null;
    this.minimapSize = 265;
    this.minimapMargin = 18;
    this.minimapWorldSize = 1024;
    this.minimapLastUpdate = 0; // znacznik czasu do throttlingu minimapy
  }

  // Ładowanie świata z SVG
  static async loadWorld(svgPath, worldH, tileSize) {
    return await loadSVGPhaserWorld(svgPath, worldH, tileSize);
  }

  // Dynamiczne rysowanie kafli świata wokół pozycji (cx, cy)
  drawTiles(cx, cy) {
    // Zbierz kafle, które powinny być widoczne
    const radius = 1.1 * 1.5 * Math.max(this.viewW, this.viewH) + this.tileSize;
    const minTileX = Math.floor((cx - radius) / this.tileSize) - 1;
    const maxTileX = Math.floor((cx + radius) / this.tileSize) + 1;
    const minTileY = Math.floor((cy - radius) / this.tileSize) - 1;
    const maxTileY = Math.floor((cy + radius) / this.tileSize) + 1;
    const neededTiles = new Set();
    for (let tx = minTileX; tx <= maxTileX; tx++) {
      for (let ty = minTileY; ty <= maxTileY; ty++) {
        let x = tx * this.tileSize;
        let y = ty * this.tileSize;
        const dx = x + this.tileSize/2 - cx;
        const dy = y + this.tileSize/2 - cy;
        if (dx*dx + dy*dy <= radius*radius) {
          const tileId = `tile_${tx}_${ty}`;
          neededTiles.add(tileId);
          if (this.scene.textures.exists(tileId)) {
            let tileObj = this.tilePool.get(tileId);
            if (!tileObj) {
              tileObj = this.scene.add.image(x, y, tileId)
                .setOrigin(0)
                .setDepth(0);
              this.tilePool.set(tileId, tileObj);
              // --- IGNORUJ KAŻDY NOWY KAFEL NA HUD ---
              if (this.scene.hudCamera) this.scene.hudCamera.ignore(tileObj);
            } else {
              tileObj.setPosition(x, y);
              tileObj.setVisible(true);
            }
            this.trackTiles.push(tileObj);
          }
        }
      }
    }
    // Ukryj kafle, które nie są już potrzebne
    for (const [tileId, tileObj] of this.tilePool.entries()) {
      if (!neededTiles.has(tileId)) {
        tileObj.setVisible(false);
      }
    }
  }

  // Inicjalizacja minimapy
  async initMinimap(svgPath, fpsText) {
    const key = await createMinimapTextureFromSVG(this.scene, svgPath, this.minimapSize);
    this.minimapKey = key;
    const minimapOffsetX = this.viewW - this.minimapSize - this.minimapMargin;
    const minimapOffsetY = this.minimapMargin;
    this.minimapImage = this.scene.add.image(minimapOffsetX + this.minimapSize/2, minimapOffsetY + this.minimapSize/2, this.minimapKey)
      .setScrollFactor(0)
      .setDepth(100);
    this.minimapOverlay = this.scene.add.graphics().setScrollFactor(0).setDepth(101);
    const hudObjects = [fpsText, this.minimapImage, this.minimapOverlay];
    this.scene.hudCamera = this.scene.cameras.add(0, 0, this.viewW, this.viewH, false, 'hud');
    this.scene.cameras.main.ignore(hudObjects);
    this.scene.hudCamera.ignore(this.scene.children.list.filter(obj => !hudObjects.includes(obj)));
    this.scene.hudCamera.setScroll(0, 0);
    this.scene.hudCamera.setRotation(0);
  }

  // Rysowanie pozycji auta na minimapie
  drawMinimap(aiCarPos, carPos, worldW, worldH) {
    // Ogranicz częstotliwość aktualizacji do 15 Hz
    const now = performance.now();
    if (now - this.minimapLastUpdate < 66) return;
    this.minimapLastUpdate = now;
    if (!this.minimapOverlay) return;
    this.minimapOverlay.clear();
    const px = Phaser.Math.Clamp(carPos.x, 0, worldW);
    const py = Phaser.Math.Clamp(carPos.y, 0, worldH);
    const minimapOffsetX = this.viewW - this.minimapSize - this.minimapMargin;
    const minimapOffsetY = this.minimapMargin;
    const carX = minimapOffsetX + (px / worldW * this.minimapSize);
    const carY = minimapOffsetY + (py / worldH * this.minimapSize);
    if (aiCarPos) {
    const aipx = Phaser.Math.Clamp(aiCarPos.x, 0, worldW);
    const aipy = Phaser.Math.Clamp(aiCarPos.y, 0, worldH);
    const aicarX = minimapOffsetX + (aipx / worldW * this.minimapSize);
    const aiCarY = minimapOffsetY + (aipy / worldH * this.minimapSize);
    this.minimapOverlay.fillStyle(0xffff00, 1);
    this.minimapOverlay.fillCircle(aicarX, aiCarY, 3);
    }
    this.minimapOverlay.fillStyle(0xffffff, 1);
    this.minimapOverlay.fillCircle(carX, carY, 3);
  }

  // Pobierz typ nawierzchni w punkcie (delegacja do worldData)
  getSurfaceTypeAt(x, y) {
    return this.worldData.getSurfaceTypeAt(x, y);
  }

  // Pobierz dane świata
  getWorldData() {
    return this.worldData;
  }

  // Pobierz pozycję startową
  getStartPosition() {
    return this.worldData.startPos;
  }
} 