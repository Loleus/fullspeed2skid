export class MenuScene extends window.Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });

    // 🔧 Parametry stylu menu
    this.menuStyle = {
      buttonWidth: 256,
      buttonHeight: 62,
      buttonMargin: 10,
      buttonPadding: 8,
      buttonAlpha: 0.67,
      buttonFillColor: 0x254334,
      shadowButtonFillColor: 0x000000,
      buttonHoverColor: 0x26503b,
      buttonStrokeColor: 0x222222,
      buttonFontSize: '24px',
      buttonFontFamily: 'Stormfaze',
      buttonTextColor: '#87911fff',
      buttonDisabledColor: '#666',
      offsetY: 72
    };

    // 🔧 Dane globalne
    if (!window._tracks) window._tracks = [];
    if (typeof window._selectedTrack !== 'number') window._selectedTrack = 0;
    if (!window._gameMode) window._gameMode = 'PRACTICE';

    this.tracks = window._tracks;
    this.selectedTrack = window._selectedTrack;
    this.gameMode = window._gameMode;
  }

  async create() {
    const { width, height } = this.sys.game.canvas;

    // 🔹 Tło kafelkowe
    this.add.tileSprite(0, 0, width, height, 'tile').setOrigin(0, 0);
    if (this.textures.exists('gradientOverlay')) {
      this.textures.remove('gradientOverlay');
    }
    // 🔹 Gradient pionowy
    const gradientCanvas = this.textures.createCanvas('gradientOverlay', width, height);
    const gradientCtx = gradientCanvas.getContext();
    const gradient = gradientCtx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, 'rgba(75, 30, 77, 1)');
    gradient.addColorStop(0.6, 'rgba(0, 0, 0, 0.3)');
    gradient.addColorStop(0.75, 'rgba(0, 0, 0, 0.3)');
    gradient.addColorStop(1.0, 'rgba(25,43,34, 1)');
    gradientCtx.fillStyle = gradient;
    gradientCtx.fillRect(0, 0, width, height);
    gradientCanvas.refresh();
    this.add.image(0, 0, 'gradientOverlay').setOrigin(0, 0);

    // 🔹 Pobieranie tras
    if (!this.tracks || this.tracks.length === 0) {
      this.tracks = await this.fetchTracks();
      window._tracks = this.tracks;
    }
    if (this.tracks.length === 0) {
      this.tracks = [{ label: 'TRACK 1', file: 'scene_1.svg' }];
      window._tracks = this.tracks;
    }
    if (typeof this.selectedTrack !== 'number' || this.selectedTrack < 0 || this.selectedTrack >= this.tracks.length) {
      this.selectedTrack = 0;
      window._selectedTrack = 0;
    }

    // 🔹 Definicja przycisków
    const buttons = [
      { label: 'START', key: 'start' },
      { label: this.gameMode, key: 'mode' },
      { label: this.tracks[this.selectedTrack].label, key: 'track' },
      { label: 'FULLSCREEN', key: 'fullscreen' }
    ];

    this.menuButtons = [];
    const {
      buttonWidth: btnWidth,
      buttonHeight: btnHeight,
      buttonMargin: margin,
      buttonPadding: padding,
      buttonAlpha,
      buttonFillColor,
      buttonHoverColor,
      buttonStrokeColor,
      buttonFontSize,
      buttonFontFamily,
      buttonTextColor,
      buttonDisabledColor,
      shadowButtonFillColor,
      offsetY: menuOffsetY
    } = this.menuStyle;

    const totalHeight = buttons.length * btnHeight + (buttons.length - 1) * margin;
    let y = height / 2 - totalHeight / 2 + menuOffsetY;

    // 🔹 Tworzenie przycisków
    buttons.forEach((btn) => {
      const shadow = this.add.rectangle(
        5 + width / 2, 5 + y + btnHeight / 2,
        btnWidth, btnHeight,
        shadowButtonFillColor, btn.disabled ? 0.5 : 1).setOrigin(0.5).setAlpha(0.7);

      const bg = this.add.rectangle(
        width / 2, y + btnHeight / 2,
        btnWidth, btnHeight,
        buttonFillColor, btn.disabled ? 0.5 : 1).setStrokeStyle(2, buttonStrokeColor).setOrigin(0.5).setAlpha(buttonAlpha);

      const text = this.add.text(width / 2, y + btnHeight / 2, btn.label, {
        fontFamily: buttonFontFamily,
        fontSize: buttonFontSize,
        color: btn.disabled ? buttonDisabledColor : buttonTextColor,
        align: 'center',
        padding: { left: padding, right: padding, top: padding, bottom: padding },
      }).setOrigin(0.5);

      if (!btn.disabled) {
        bg.setInteractive({ useHandCursor: true });
        bg.on('pointerdown', () => this.handleButton(btn.key));
        bg.on('pointerover', () => bg.setFillStyle(buttonHoverColor, 1));
        bg.on('pointerout', () => bg.setFillStyle(buttonFillColor, 1));
      }

      this.menuButtons.push({shadow, bg, text, key: btn.key });
      y += btnHeight + margin;
    });

    // 🔹 Tytuł gry
    const titleY = height / 2 - totalHeight / 2 - 70;

    const text1 = this.add.text(0, 0, 'Full Speed 2', {
      fontFamily: 'skid',
      fontSize: '42px',
      color: '#f00',
      align: 'center',
    }).setShadow(2, 2, '#000', 4, false, true);

    const text2 = this.add.text(0, 0, 'Skid', {
      fontFamily: 'punk_kid',
      fontSize: '64px',
      color: '#99a',
      align: 'center',
    });

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

  async fetchTracks() {
    try {
      const response = await fetch('assets/levels/tracks.json');
      const tracks = await response.json();
      return tracks.filter((t, i, arr) => arr.findIndex(x => x.file === t.file) === i);
    } catch (e) {
      return [
        { label: 'TRACK 1', file: 'scene_1.svg' },
        { label: 'TRACK 2', file: 'scene_2.svg' }
      ];
    }
  }

  handleButton(key) {
    console.log('Klik:', key, 'selectedTrack:', this.selectedTrack);

    if (key === 'start') {
      this.scene.start('LoadingScene', {
        trackFile: this.tracks[this.selectedTrack].file,
        gameMode: this.gameMode
      });
    } else if (key === 'fullscreen') {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        document.body.requestFullscreen();
      }
    } else if (key === 'track') {
      this.selectedTrack = (this.selectedTrack + 1) % this.tracks.length;
      window._selectedTrack = this.selectedTrack;

      const trackBtn = this.menuButtons.find(btn => btn.key === 'track');
      if (trackBtn) {
        trackBtn.text.setText(this.tracks[this.selectedTrack].label);
      }
    } else if (key === 'mode') {
      this.gameMode = this.gameMode === 'PRACTICE' ? 'RACE' : 'PRACTICE';
      window._gameMode = this.gameMode;

      const modeBtn = this.menuButtons.find(btn => btn.key === 'mode');
      if (modeBtn) {
        modeBtn.text.setText(this.gameMode);
      }
    }
  }
}
