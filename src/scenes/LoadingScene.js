import { World } from '../world/World.js';
import { TILE_SIZE, WORLD_HEIGHT } from '../core/constants.js';

export class LoadingScene extends window.Phaser.Scene {
  constructor() {
    super({ key: 'LoadingScene' });
  }

  init(data) {
    this.trackFile = data.trackFile;
    this.gameMode = data.gameMode || 'PRACTICE';
    this.startFix = data.startFix;
  }

  preload() {
    // Ładuj tekstury
    this.load.image('grass', 'assets/images/grass.jpg');
    this.load.image('bgc', 'assets/images/bgc.jpg'); // pełnoekranowe tło
    this.load.audio('ambience', 'assets/samples/game_ambience.mp3');
  }

  async create() {
    const { width, height } = this.sys.game.canvas;

    // Dodaj tło jako obraz rozciągnięty na cały canvas, umieść na bardzo niskiej głębokości
    const bg = this.add.image(0, 0, 'bgc').setOrigin(0, 0);
    bg.setDisplaySize(width, height);
    bg.setScrollFactor(0);
    bg.setDepth(-1000);

    const btnWidth = 720;
    const btnHeight = 80;
    const padding = 55;

    // Tło przycisku
    this.add.rectangle(width / 2, height / 2, btnWidth, btnHeight, Phaser.Display.Color.RGBStringToColor("rgba(70, 105, 0, 1)").color, 1)
      .setOrigin(0.5)
      .setAlpha(0.87)
      .setDepth(10);

    // Tekst ładowania
    const loadingText = this.add.text(width / 2, height / 2, 'loading...', {
      fontFamily: 'Stormfaze',
      fontSize: '71px',
      color: 'rgba(148, 182, 0, 1)',
      align: 'center',
      padding: { left: padding, right: padding, top: padding, bottom: padding },
    }).setOrigin(0.5).setDepth(11);

    // Utwórz template świata po załadowaniu grass
    this.createWorldTemplate();

    // Jeśli przekazano plik toru, ładuj SVG i uruchom grę
    if (this.trackFile) {
      loadingText.setText('LOADING TRACK...');
      const svgPath = `assets/levels/${this.trackFile}`;
      const worldData = await World.loadWorld(svgPath, WORLD_HEIGHT, TILE_SIZE);
      worldData.svgPath = svgPath;
      worldData.startFix = this.startFix;
      this.ambience = this.sound.add('ambience', { volume: 1.0, loop: true });
      this.scene.start('GameScene', {
        worldData: worldData,
        gameMode: this.gameMode,
        startFix: this.startFix,
        ambience: this.ambience
      });
    } else {
      this.time.delayedCall(500, () => {
        this.scene.start('MenuScene');
      });
    }
  }

  createWorldTemplate() {
    const worldSize = WORLD_HEIGHT;
    const canvas = document.createElement('canvas');
    canvas.width = worldSize;
    canvas.height = worldSize;
    const ctx = canvas.getContext('2d');

    const grassImg = this.textures.get('grass').getSourceImage();

    for (let x = 0; x < worldSize; x += TILE_SIZE) {
      for (let y = 0; y < worldSize; y += TILE_SIZE) {
        ctx.drawImage(grassImg, x, y, TILE_SIZE, TILE_SIZE);
      }
    }

    window._worldTemplate = canvas;
  }
}
