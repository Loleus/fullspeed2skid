import { World } from '../engine/world.js';
import { tileSize, worldH } from '../app/main.js';

export class LoadingScene extends window.Phaser.Scene {
  constructor() {
    super({ key: 'LoadingScene' });
  }

  init(data) {
    this.trackFile = data.trackFile;
    this.gameMode = data.gameMode || 'PRACTICE';
  }

  preload() {
    // Ładuj teksturę grass
    this.load.image('grass', 'assets/images/grass.jpg');
    this.load.image('tile', 'assets/images/asphalt1.jpg'); // Ścieżka do pliku
  }

  async create() {
    const { width, height } = this.sys.game.canvas;
    // this.cameras.main.setBackgroundColor('#000');
        this.add.tileSprite(0, 0, width, height, 'tile').setOrigin(0, 0);
    const btnWidth = 300;
    const btnHeight = 60;
    const padding = 5;
    // Tło przycisku
    this.add.rectangle(width / 2, height / 2, btnWidth, btnHeight, 0x444444, 1)
      .setStrokeStyle(2, 0x222222)
      .setOrigin(0.5)
      .setAlpha(0.5);
    // Tekst
    const loadingText = this.add.text(width / 2, height / 2, 'loading...', {
      fontFamily: 'Stormfaze',
      fontSize: '21px',
      color: '#fff',
      align: 'center',
      padding: { left: padding, right: padding, top: padding, bottom: padding },
    }).setOrigin(0.5);

    // Po załadowaniu tekstury grass, twórz template świata
    this.createWorldTemplate();

    // Jeśli przekazano plik toru, ładuj SVG i uruchom grę
    if (this.trackFile) {
      loadingText.setText('LOADING TRACK...');
      const svgPath = `assets/levels/${this.trackFile}`;
      const worldData = await World.loadWorld(svgPath, worldH, tileSize);
      // Dodaj pole svgPath do worldData
      worldData.svgPath = svgPath;
      // startGame(worldData);
      this.scene.start('GameScene', { 
        worldData: worldData,
        gameMode: this.gameMode 
      });
    } else {
      // Przejdź do menu po utworzeniu template
      this.time.delayedCall(500, () => {
        this.scene.start('MenuScene');
      });
    }
  }

  createWorldTemplate() {
    // Parametry świata
    const worldSize = worldH;
    // Stwórz canvas
    const canvas = document.createElement('canvas');
    canvas.width = worldSize;
    canvas.height = worldSize;
    const ctx = canvas.getContext('2d');
    // Pobierz obraz grass z loadera Phasera
    const grassImg = this.textures.get('grass').getSourceImage();
    // Wypełnij cały canvas teksturą grass
    for (let x = 0; x < worldSize; x += tileSize) {
      for (let y = 0; y < worldSize; y += tileSize) {
        ctx.drawImage(grassImg, x, y, tileSize, tileSize);
      }
    }
    // Zapisz template globalnie
    window._worldTemplate = canvas;
  }
}