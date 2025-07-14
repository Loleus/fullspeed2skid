// import Phaser from './phaser.js';

export class MenuScene extends window.Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
    // Przenoszę tracks i selectedTrack do window, by zachować stan
    if (!window._tracks) window._tracks = [];
    if (typeof window._selectedTrack !== 'number') window._selectedTrack = 0;
    this.tracks = window._tracks;
    this.selectedTrack = window._selectedTrack;
  }

  async create() {
    console.log('MenuScene create', Date.now());
    const { width, height } = this.sys.game.canvas;
    this.cameras.main.setBackgroundColor('#000');

    // Pobierz dynamicznie listę torów z assets/levels
    if (!this.tracks || this.tracks.length === 0) {
      this.tracks = await this.fetchTracks();
      // NIE ograniczaj liczby torów
      window._tracks = this.tracks;
    }
    if (this.tracks.length === 0) {
      this.tracks = [{ label: 'TRACK 1', file: 'scene_1.svg' }];
      window._tracks = this.tracks;
    }
    // Nie resetuj selectedTrack jeśli już istnieje
    if (typeof this.selectedTrack !== 'number' || this.selectedTrack < 0 || this.selectedTrack >= this.tracks.length) {
      this.selectedTrack = 0;
      window._selectedTrack = 0;
    }

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
    const padding = 8;
    const totalHeight = buttons.length * btnHeight + (buttons.length - 1) * margin;
    // --- PRZESUNIĘCIE MENU W DÓŁ ---
    const menuOffsetY = 100; // większy margines od loga
    let y = height / 2 - totalHeight / 2 + menuOffsetY;

    buttons.forEach((btn, i) => {
      const bg = this.add.rectangle(width / 2, y + btnHeight / 2, btnWidth, btnHeight, 0x444444, btn.disabled ? 0.5 : 1)
        .setStrokeStyle(2, 0x222222)
        .setOrigin(0.5);
      const text = this.add.text(width / 2, y + btnHeight / 2, btn.label, {
        fontFamily: 'punk kid',
        fontSize: '24px',
        color: btn.disabled ? '#666' : '#ccc',
        align: 'center',
        padding: { left: padding, right: padding, top: padding, bottom: padding },
      }).setOrigin(0.5);
      if (!btn.disabled) {
        bg.setInteractive({ useHandCursor: true });
        bg.on('pointerdown', () => this.handleButton(btn.key));
        bg.on('pointerover', () => bg.setFillStyle(0x666666, 1));
        bg.on('pointerout', () => bg.setFillStyle(0x444444, 1));
        // NIE ustawiaj interaktywności na text!
        // NIE dodawaj eventów na text!
      }
      this.menuButtons.push({ bg, text, key: btn.key });
      y += btnHeight + margin;
    });

    // --- NAPIS NAD MENU (jeden wiersz, dwa fonty) ---
    const titleY = height / 2 - totalHeight / 2 - 70;
    const text1 = this.add.text(0, 0, 'Full Speed 2', {
      fontFamily: 'skid',
      fontSize: '40px',
      color: '#f00',
      align: 'center',
    });
    const text2 = this.add.text(0, 0, 'Skid', {
      fontFamily: 'punk kid',
      fontSize: '50px',
      color: '#ffd',
      align: 'center',
    });
    // Oblicz szerokość całości i wyśrodkuj
    const totalTitleWidth = text1.width + text2.width;
    const startX = width / 2 - totalTitleWidth / 2;
    text1.setPosition(startX, titleY).setOrigin(0, 0.5);
    const verticalOffset = -80; // Korekta pionowa dla Skid
    const horizontalOffset = 20; // Korekta pozioma dla 2 Skid
    text2.setPosition(startX + text1.width + horizontalOffset, titleY + (text1.height - text2.height) / 2 + verticalOffset).setOrigin(0, 0.5);
  }

  async fetchTracks() {
    // Pobierz listę plików z assets/levels przez zapytanie do katalogu (działa lokalnie na serwerze lub na github.io z indexem)
    try {
      const response = await fetch('assets/levels/');
      const text = await response.text();
      // Wyciągnij nazwy plików SVG
      const matches = [...text.matchAll(/scene_(\d+)\.svg/g)];
      console.log('Wykryte tory:', matches.map(m => m[0]));
      let tracks = matches.map(m => ({
        label: `TRACK ${m[1]}`,
        file: `scene_${m[1]}.svg`
      }));
      // Usuń duplikaty po file
      tracks = tracks.filter((t, i, arr) => arr.findIndex(x => x.file === t.file) === i);
      // NIE ograniczaj liczby torów
      return tracks;
    } catch (e) {
      // Fallback: dwa tory
      return [
        { label: 'TRACK 1', file: 'scene_1.svg' },
        { label: 'TRACK 2', file: 'scene_2.svg' }
      ];
    }
  }

  handleButton(key) {
    console.log('Klik:', key, 'selectedTrack:', this.selectedTrack);
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
      window._selectedTrack = this.selectedTrack;
      console.log('Nowy selectedTrack:', this.selectedTrack);
      const trackBtn = this.menuButtons.find(btn => btn.key === 'track');
      if (trackBtn) {
        trackBtn.text.setText(this.tracks[this.selectedTrack].label);
      }
    }
    // CAR jest nieaktywny na razie
  }
} 