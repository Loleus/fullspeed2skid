// // Klasa MenuScene definiuje scenę menu głównego gry
// export class MenuScene extends window.Phaser.Scene {
//   constructor() {
//     super({ key: 'MenuScene' });

//     // Inicjalizacja danych globalnych – lista tras i aktywnie wybrana trasa
//     if (!window._tracks) window._tracks = [];
//     if (typeof window._selectedTrack !== 'number') window._selectedTrack = 0;

//     this.tracks = window._tracks;
//     this.selectedTrack = window._selectedTrack;
//   }

//   async create() {
//     const { width, height } = this.sys.game.canvas;

//     // Ustaw czarne tło dla głównej kamery
//     this.cameras.main.setBackgroundColor('#000');

//     // Jeśli brak tras – pobierz je z pliku JSON
//     if (!this.tracks || this.tracks.length === 0) {
//       this.tracks = await this.fetchTracks();
//       window._tracks = this.tracks;
//     }

//     // Jeśli nadal brak tras – ustaw domyślną
//     if (this.tracks.length === 0) {
//       this.tracks = [{ label: 'TRACK 1', file: 'scene_1.svg' }];
//       window._tracks = this.tracks;
//     }

//     // Poprawność indeksu wybranej trasy
//     if (typeof this.selectedTrack !== 'number' || this.selectedTrack < 0 || this.selectedTrack >= this.tracks.length) {
//       this.selectedTrack = 0;
//       window._selectedTrack = 0;
//     }

//     // Definicja przycisków menu
//     const buttons = [
//       { label: 'START', key: 'start' },
//       { label: 'CAR', key: 'car', disabled: true }, // Placeholder
//       { label: this.tracks[this.selectedTrack].label, key: 'track' },
//       { label: 'FULLSCREEN', key: 'fullscreen' }
//     ];

//     this.menuButtons = [];
//     const btnWidth = 300;
//     const btnHeight = 60;
//     const margin = 10;
//     const padding = 8;
//     const totalHeight = buttons.length * btnHeight + (buttons.length - 1) * margin;
//     const menuOffsetY = 100;
//     let y = height / 2 - totalHeight / 2 + menuOffsetY;

//     // Tworzenie graficznych przycisków menu
//     buttons.forEach((btn) => {
//       // Tło przycisku
//       const bg = this.add.rectangle(
//         width / 2, y + btnHeight / 2,
//         btnWidth, btnHeight,
//         0x444444, btn.disabled ? 0.5 : 1
//       ).setStrokeStyle(2, 0x222222).setOrigin(0.5);

//       // Tekst etykiety przycisku
//       const text = this.add.text(width / 2, y + btnHeight / 2, btn.label, {
//         fontFamily: 'Stormfaze',
//         fontSize: '24px',
//         color: btn.disabled ? '#666' : '#ccc',
//         align: 'center',
//         padding: { left: padding, right: padding, top: padding, bottom: padding },
//       }).setOrigin(0.5);

//       // Interakcje dla aktywnych przycisków
//       if (!btn.disabled) {
//         bg.setInteractive({ useHandCursor: true });
//         bg.on('pointerdown', () => this.handleButton(btn.key));       // obsługa kliknięcia
//         bg.on('pointerover', () => bg.setFillStyle(0x666666, 1));     // efekt najechania
//         bg.on('pointerout', () => bg.setFillStyle(0x444444, 1));      // powrót koloru
//       }

//       // Zapisz przycisk do tablicy
//       this.menuButtons.push({ bg, text, key: btn.key });
//       y += btnHeight + margin;
//     });

//     // Pozycjonowanie tytułu gry
//     const titleY = height / 2 - totalHeight / 2 - 70;

//     // Pierwsza część tytułu – "Full Speed 2"
//     const text1 = this.add.text(0, 0, 'Full Speed 2', {
//       fontFamily: 'skid',
//       fontSize: '40px',
//       color: '#f00',
//       align: 'center',
//     });

//     // Druga część tytułu – "Skid"
//     const text2 = this.add.text(0, 0, 'Skid', {
//       fontFamily: 'punk_kid',
//       fontSize: '70px',
//       color: '#ffd',
//       align: 'center',
//     });

//     // Pozycjonowanie obu tekstów, z lekkim przesunięciem i centrowaniem
//     const totalTitleWidth = text1.width + text2.width;
//     const startX = width / 2 - totalTitleWidth / 2;
//     text1.setPosition(startX, titleY).setOrigin(0, 0.5);

//     const verticalOffset = -60;
//     const horizontalOffset = 30;
//     text2.setPosition(
//       startX + text1.width + horizontalOffset,
//       titleY + (text1.height - text2.height) / 2 + verticalOffset
//     ).setOrigin(0, 0.5);
//   }

//   // Pobiera listę tras z pliku JSON i usuwa duplikaty
//   async fetchTracks() {
//     try {
//       const response = await fetch('assets/levels/tracks.json');
//       const tracks = await response.json();
//       return tracks.filter((t, i, arr) => arr.findIndex(x => x.file === t.file) === i);
//     } catch (e) {
//       // W razie błędu – domyślne trasy fallback
//       return [
//         { label: 'TRACK 1', file: 'scene_1.svg' },
//         { label: 'TRACK 2', file: 'scene_2.svg' }
//       ];
//     }
//   }

//   // Obsługuje kliknięcie przycisku z menu
//   handleButton(key) {
//     console.log('Klik:', key, 'selectedTrack:', this.selectedTrack);

//     if (key === 'start') {
//       // Przejście do sceny ładowania z wybraną trasą
//       this.scene.start('LoadingScene', { trackFile: this.tracks[this.selectedTrack].file });
//     } else if (key === 'fullscreen') {
//       // Przełączanie fullscreen
//       if (document.fullscreenElement) {
//         document.exitFullscreen();
//       } else {
//         document.body.requestFullscreen();
//       }
//     } else if (key === 'track') {
//       // Przejście do kolejnej trasy
//       this.selectedTrack = (this.selectedTrack + 1) % this.tracks.length;
//       window._selectedTrack = this.selectedTrack;

//       // Zaktualizuj etykietę przycisku
//       const trackBtn = this.menuButtons.find(btn => btn.key === 'track');
//       if (trackBtn) {
//         trackBtn.text.setText(this.tracks[this.selectedTrack].label);
//       }
//     }
//   }
// }

// Klasa MenuScene definiuje scenę menu głównego gry
export class MenuScene extends window.Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });

    // Inicjalizacja danych globalnych – lista tras i aktywnie wybrana trasa
    if (!window._tracks) window._tracks = [];
    if (typeof window._selectedTrack !== 'number') window._selectedTrack = 0;
    if (!window._gameMode) window._gameMode = 'PRACTICE'; // dodajemy tryb gry

    this.tracks = window._tracks;
    this.selectedTrack = window._selectedTrack;
    this.gameMode = window._gameMode;
  }

  async create() {
    const { width, height } = this.sys.game.canvas;

    // Ustaw czarne tło dla głównej kamery
    this.cameras.main.setBackgroundColor('#000');

    // Jeśli brak tras – pobierz je z pliku JSON
    if (!this.tracks || this.tracks.length === 0) {
      this.tracks = await this.fetchTracks();
      window._tracks = this.tracks;
    }

    // Jeśli nadal brak tras – ustaw domyślną
    if (this.tracks.length === 0) {
      this.tracks = [{ label: 'TRACK 1', file: 'scene_1.svg' }];
      window._tracks = this.tracks;
    }

    // Poprawność indeksu wybranej trasy
    if (typeof this.selectedTrack !== 'number' || this.selectedTrack < 0 || this.selectedTrack >= this.tracks.length) {
      this.selectedTrack = 0;
      window._selectedTrack = 0;
    }

    // Definicja przycisków menu
    const buttons = [
      { label: 'START', key: 'start' },
      { label: this.gameMode, key: 'mode' }, // zmieniony przycisk CAR na tryb gry
      { label: this.tracks[this.selectedTrack].label, key: 'track' },
      { label: 'FULLSCREEN', key: 'fullscreen' }
    ];

    this.menuButtons = [];
    const btnWidth = 300;
    const btnHeight = 60;
    const margin = 10;
    const padding = 8;
    const totalHeight = buttons.length * btnHeight + (buttons.length - 1) * margin;
    const menuOffsetY = 100;
    let y = height / 2 - totalHeight / 2 + menuOffsetY;

    // Tworzenie graficznych przycisków menu
    buttons.forEach((btn) => {
      // Tło przycisku
      const bg = this.add.rectangle(
        width / 2, y + btnHeight / 2,
        btnWidth, btnHeight,
        0x444444, btn.disabled ? 0.5 : 1
      ).setStrokeStyle(2, 0x222222).setOrigin(0.5);

      // Tekst etykiety przycisku
      const text = this.add.text(width / 2, y + btnHeight / 2, btn.label, {
        fontFamily: 'Stormfaze',
        fontSize: '24px',
        color: btn.disabled ? '#666' : '#ccc',
        align: 'center',
        padding: { left: padding, right: padding, top: padding, bottom: padding },
      }).setOrigin(0.5);

      // Interakcje dla aktywnych przycisków
      if (!btn.disabled) {
        bg.setInteractive({ useHandCursor: true });
        bg.on('pointerdown', () => this.handleButton(btn.key));       // obsługa kliknięcia
        bg.on('pointerover', () => bg.setFillStyle(0x666666, 1));     // efekt najechania
        bg.on('pointerout', () => bg.setFillStyle(0x444444, 1));      // powrót koloru
      }

      // Zapisz przycisk do tablicy
      this.menuButtons.push({ bg, text, key: btn.key });
      y += btnHeight + margin;
    });

    // Pozycjonowanie tytułu gry
    const titleY = height / 2 - totalHeight / 2 - 70;

    // Pierwsza część tytułu – "Full Speed 2"
    const text1 = this.add.text(0, 0, 'Full Speed 2', {
      fontFamily: 'skid',
      fontSize: '40px',
      color: '#f00',
      align: 'center',
    });

    // Druga część tytułu – "Skid"
    const text2 = this.add.text(0, 0, 'Skid', {
      fontFamily: 'punk_kid',
      fontSize: '70px',
      color: '#ffd',
      align: 'center',
    });

    // Pozycjonowanie obu tekstów, z lekkim przesunięciem i centrowaniem
    const totalTitleWidth = text1.width + text2.width;
    const startX = width / 2 - totalTitleWidth / 2;
    text1.setPosition(startX, titleY).setOrigin(0, 0.5);

    const verticalOffset = -60;
    const horizontalOffset = 30;
    text2.setPosition(
      startX + text1.width + horizontalOffset,
      titleY + (text1.height - text2.height) / 2 + verticalOffset
    ).setOrigin(0, 0.5);
  }

  // Pobiera listę tras z pliku JSON i usuwa duplikaty
  async fetchTracks() {
    try {
      const response = await fetch('assets/levels/tracks.json');
      const tracks = await response.json();
      return tracks.filter((t, i, arr) => arr.findIndex(x => x.file === t.file) === i);
    } catch (e) {
      // W razie błędu – domyślne trasy fallback
      return [
        { label: 'TRACK 1', file: 'scene_1.svg' },
        { label: 'TRACK 2', file: 'scene_2.svg' }
      ];
    }
  }

  // Obsługuje kliknięcie przycisku z menu
  handleButton(key) {
    console.log('Klik:', key, 'selectedTrack:', this.selectedTrack);

    if (key === 'start') {
      // Przejście do sceny ładowania z wybraną trasą i trybem gry
      this.scene.start('LoadingScene', { 
        trackFile: this.tracks[this.selectedTrack].file,
        gameMode: this.gameMode 
      });
    } else if (key === 'fullscreen') {
      // Przełączanie fullscreen
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        document.body.requestFullscreen();
      }
    } else if (key === 'track') {
      // Przejście do kolejnej trasy
      this.selectedTrack = (this.selectedTrack + 1) % this.tracks.length;
      window._selectedTrack = this.selectedTrack;

      // Zaktualizuj etykietę przycisku
      const trackBtn = this.menuButtons.find(btn => btn.key === 'track');
      if (trackBtn) {
        trackBtn.text.setText(this.tracks[this.selectedTrack].label);
      }
    } else if (key === 'mode') {
      // Przełączanie trybu gry
      this.gameMode = this.gameMode === 'PRACTICE' ? 'RACE' : 'PRACTICE';
      window._gameMode = this.gameMode;

      // Zaktualizuj etykietę przycisku
      const modeBtn = this.menuButtons.find(btn => btn.key === 'mode');
      if (modeBtn) {
        modeBtn.text.setText(this.gameMode);
      }
    }
  }
}