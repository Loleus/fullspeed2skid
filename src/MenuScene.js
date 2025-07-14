// import Phaser from './phaser.js';

export class MenuScene extends window.Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
    this.tracks = [];
    this.selectedTrack = 0;
  }

  async create() {
    const { width, height } = this.sys.game.canvas;
    this.cameras.main.setBackgroundColor('#888');

    // Pobierz dynamicznie listę torów z assets/levels
    this.tracks = await this.fetchTracks();
    if (this.tracks.length === 0) {
      this.tracks = [{ label: 'TRACK 1', file: 'scene_1.svg' }];
    }
    this.selectedTrack = 0;

    // Dane przycisków
    const buttons = [
      { label: 'START', key: 'start' },
      { label: 'CAR', key: 'car', disabled: true },
      { label: this.tracks[this.selectedTrack].label, key: 'track' },
      { label: 'FULLSCREEN', key: 'fullscreen' }
    ];
    this.menuButtons = [];
    const btnWidth = 300;
    const btnHeight = 60;
    const margin = 10;
    const padding = 5;
    const totalHeight = buttons.length * btnHeight + (buttons.length - 1) * margin;
    let y = height / 2 - totalHeight / 2;

    buttons.forEach((btn, i) => {
      const bg = this.add.rectangle(width / 2, y + btnHeight / 2, btnWidth, btnHeight, 0x444444, btn.disabled ? 0.5 : 1)
        .setStrokeStyle(2, 0x222222)
        .setOrigin(0.5);
      const text = this.add.text(width / 2, y + btnHeight / 2, btn.label, {
        fontFamily: 'Arial',
        fontSize: '32px',
        color: btn.disabled ? '#888' : '#fff',
        align: 'center',
        padding: { left: padding, right: padding, top: padding, bottom: padding },
      }).setOrigin(0.5);
      if (!btn.disabled) {
        bg.setInteractive({ useHandCursor: true });
        bg.on('pointerdown', () => this.handleButton(btn.key));
        bg.on('pointerover', () => bg.setFillStyle(0x666666, 1));
        bg.on('pointerout', () => bg.setFillStyle(0x444444, 1));
        text.setInteractive({ useHandCursor: true });
        text.on('pointerdown', () => this.handleButton(btn.key));
        text.on('pointerover', () => bg.setFillStyle(0x666666, 1));
        text.on('pointerout', () => bg.setFillStyle(0x444444, 1));
      }
      this.menuButtons.push({ bg, text, key: btn.key });
      y += btnHeight + margin;
    });
  }

  async fetchTracks() {
    // Pobierz listę plików z assets/levels przez zapytanie do katalogu (działa lokalnie na serwerze lub na github.io z indexem)
    try {
      const response = await fetch('assets/levels/');
      const text = await response.text();
      // Wyciągnij nazwy plików SVG
      const matches = [...text.matchAll(/scene_(\d+)\.svg/g)];
      return matches.map(m => ({
        label: `TRACK ${m[1]}`,
        file: `scene_${m[1]}.svg`
      }));
    } catch (e) {
      // Fallback: dwa tory
      return [
        { label: 'TRACK 1', file: 'scene_1.svg' },
        { label: 'TRACK 2', file: 'scene_2.svg' }
      ];
    }
  }

  handleButton(key) {
    if (key === 'start') {
      this.scene.start('LoadingScene', { trackFile: this.tracks[this.selectedTrack].file });
    } else if (key === 'fullscreen') {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        document.body.requestFullscreen();
      }
    } else if (key === 'track') {
      this.selectedTrack = (this.selectedTrack + 1) % this.tracks.length;
      const trackBtn = this.menuButtons.find(btn => btn.key === 'track');
      if (trackBtn) {
        trackBtn.text.setText(this.tracks[this.selectedTrack].label);
      }
    }
    // CAR jest nieaktywny na razie
  }
} 