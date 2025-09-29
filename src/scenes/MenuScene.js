export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });

    this.menuStyle = {
      buttonWidth: 256,
      buttonHeight: 62,
      buttonMargin: 10,
      buttonPadding: 8,
      buttonAlpha: 0.26,
      buttonFillColor: Phaser.Display.Color.RGBStringToColor("rgba(25, 104, 120, 1)").color,
      shadowButtonFillColor: 0x000000,
      buttonHoverColor: Phaser.Display.Color.RGBStringToColor("rgba(33, 143, 153, 1)").color,
      buttonStrokeColor: Phaser.Display.Color.RGBStringToColor("rgb(0, 43, 36)").color,
      buttonFontSize: '26px',
      buttonFontFamily: 'Stormfaze',
      buttonTextColor: '#83b1afff',
      buttonDisabledColor: '#666',
      offsetY: 52,
      shadowOffsetDefault: { x: 5, y: 5 },
      shadowOffsetPressed: { x: -3, y: -3 },
      customStartStyle: {
        buttonWidth: 300,
        buttonHeight: 80,
        buttonFillColor: Phaser.Display.Color.RGBStringToColor("rgba(255, 100, 100, 1)").color,
        buttonHoverColor: Phaser.Display.Color.RGBStringToColor("rgba(255, 150, 150, 1)").color,
        buttonStrokeColor: Phaser.Display.Color.RGBStringToColor("rgb(100, 0, 0)").color,
        buttonTextColor: '#ffffff',
        interactionRadiusOffset: 50 // dodatkowy promień dla hitCircle
      }
    };

    this.gradientState = { stop1: 0.2, stop2: 0.5 };
    this.gradientTween = null;

    this.tracks = window._tracks || [];
    this.selectedTrack = window._selectedTrack ?? 0;
    this.gameMode = window._gameMode || 'PRACTICE';
  }

  async create() {
    const { width, height } = this.sys.game.canvas;
    this.add.tileSprite(0, 0, width, height, 'tile').setOrigin(0, 0);

    if (this.gradientTween) this.gradientTween.stop();
    this.gradientState = { stop1: 0.2, stop2: 0.5 };

    if (this.textures.exists('gradientOverlay')) this.textures.remove('gradientOverlay');
    const gradientCanvas = this.textures.createCanvas('gradientOverlay', width, height);
    const ctx = gradientCanvas.getContext();
    this.updateGradient(ctx, width, height);
    gradientCanvas.refresh();
    this.add.image(0, 0, 'gradientOverlay').setOrigin(0, 0).setAlpha(1);

    this.gradientTween = this.tweens.add({
      targets: this.gradientState,
      stop1: 0.5,
      stop2: 0.8,
      duration: 4000,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
      onUpdate: () => {
        this.updateGradient(ctx, width, height);
        gradientCanvas.refresh();
      }
    });

    if (!this.tracks.length) this.tracks = await this.fetchTracks();
    if (!this.tracks.length) this.tracks = [{ label: 'TRACK 1', file: 'scene_1.svg' }];
    if (this.selectedTrack < 0 || this.selectedTrack >= this.tracks.length) this.selectedTrack = 0;

    const buttons = [
      { label: this.gameMode, key: 'mode' },
      { label: this.tracks[this.selectedTrack].label, key: 'track' },
      { label: 'START', key: 'start' },
      { label: 'HISCORE', key: 'hiscore' },
      { label: 'FSCREEN', key: 'fullscreen' }
    ];

    this.menuButtons = [];
    const {
      buttonWidth: w, buttonHeight: h, buttonMargin: m, buttonPadding: p,
      buttonAlpha: a, buttonFillColor: f, buttonHoverColor: hf, buttonStrokeColor: s,
      buttonFontSize: fs, buttonFontFamily: ff, buttonTextColor: tc, buttonDisabledColor: dc,
      shadowButtonFillColor: sf, offsetY: oy, shadowOffsetDefault: so, shadowOffsetPressed: sp
    } = this.menuStyle;
    const startIndex = buttons.findIndex(b => b.key === 'start');
    const totalWidth = buttons.length * w + (buttons.length - 1) * m;
    let x = width / 2 - totalWidth / 2;
    const y = height / 2 + oy;

    buttons.forEach((btn, i) => {
      const isStart = btn.key === 'start';
      const style = isStart ? { ...this.menuStyle, ...this.menuStyle.customStartStyle } : this.menuStyle;

      const shadow = this.add.graphics();
      this.drawShadow(shadow, style.shadowOffsetDefault, style.buttonWidth, style.buttonHeight, style.shadowButtonFillColor, style.buttonAlpha);

      const bg = this.add.graphics();
      this.drawButton(bg, style.buttonFillColor, style.buttonAlpha, style.buttonStrokeColor, style.buttonWidth, style.buttonHeight);

      const text = this.add.text(0, 0, btn.label, {
        fontFamily: style.buttonFontFamily,
        fontSize: style.buttonFontSize,
        color: btn.disabled ? style.buttonDisabledColor : style.buttonTextColor,
        align: 'center',
        padding: { left: style.buttonPadding, right: style.buttonPadding, top: style.buttonPadding, bottom: style.buttonPadding }
      }).setOrigin(0.5).setShadow(2, 2, '#000', 3, false, true);

      const container = this.add.container(x + style.buttonWidth / 2, y, [shadow, bg, text]);

      if (!btn.disabled) {
        const radius = Math.min(style.buttonWidth, style.buttonHeight) / 2 + 38 + (style.interactionRadiusOffset || 0);
        const hitCircle = this.add.circle(0, 0, radius, 0x000000, 0);
        hitCircle.setInteractive({ useHandCursor: true });

        hitCircle.on('pointerover', () => this.drawButton(bg, style.buttonHoverColor, style.buttonAlpha, style.buttonStrokeColor, style.buttonWidth, style.buttonHeight));
        hitCircle.on('pointerout', () => this.drawButton(bg, style.buttonFillColor, style.buttonAlpha, style.buttonStrokeColor, style.buttonWidth, style.buttonHeight));
        hitCircle.on('pointerdown', () => this.drawShadow(shadow, style.shadowOffsetPressed, style.buttonWidth, style.buttonHeight, style.shadowButtonFillColor, style.buttonAlpha));
        hitCircle.on('pointerup', () => {
          this.drawShadow(shadow, style.shadowOffsetDefault, style.buttonWidth, style.buttonHeight, style.shadowButtonFillColor, style.buttonAlpha);
          this.handleButton(btn.key);
        });

        container.addAt(hitCircle, 0);
      }

      this.menuButtons.push({ container, key: btn.key, shadow, bg, text });
      const isAfterStart = i > startIndex;
      x += style.buttonWidth + (isAfterStart ? style.buttonMargin : 0);
    });


    const titleY = y - h - 200;
    const text1 = this.add.text(0, 0, 'Full Speed 2', {
      fontFamily: 'skid',
      fontSize: '44px',
      color: '#D72638',
      align: 'center'
    }).setShadow(2, 2, '#000', 4, false, true);

    const text2 = this.add.text(0, 0, 'Skid', {
      fontFamily: 'punk_kid',
      fontSize: '72px',
      color: 'rgba(248, 248, 242, 0.79)',
      align: 'center'
    });

    const totalTitleWidth = text1.width + text2.width;
    const startX = width / 2 - totalTitleWidth / 2;
    text1.setPosition(startX, titleY).setOrigin(0, 0.5);
    text2.setPosition(startX + text1.width + 30, titleY + (text1.height - text2.height) / 2 - 60).setOrigin(0, 0.5);
  }

  updateGradient(ctx, width, height) {
    const g = ctx.createLinearGradient(0, 0, 0, height);
    g.addColorStop(0, 'rgba(30, 61, 85, 1)');
    g.addColorStop(this.gradientState.stop1, 'rgba(43, 82, 114, 0.3)');
    g.addColorStop(this.gradientState.stop2, 'rgba(44, 44, 44, 0.3)');
    g.addColorStop(1, 'rgba(44, 44, 44, 1)');
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
  }

  drawButton(g, fill, alpha, stroke, w, h) {
    g.clear();
    const radius = Math.min(w, h) / 2 + 38;
    g.fillStyle(fill, alpha);
    g.lineStyle(2, stroke);
    g.fillCircle(0, 0, radius);
    g.strokeCircle(0, 0, radius);
  }

  drawShadow(g, offset, w, h, fill, alpha) {
    g.clear();
    const radius = Math.min(w, h) / 2 + 38;
    g.fillStyle(fill, alpha);
    g.lineStyle(0, 0x000000, 0);
    g.fillCircle(offset.x, offset.y, radius);
  }
  async fetchTracks() {
    try {
      const res = await fetch('assets/levels/tracks.json');
      const data = await res.json();
      return data.filter((t, i, arr) => arr.findIndex(x => x.file === t.file) === i);
    } catch {
      return [
        { label: 'TRACK 1', file: 'scene_1.svg' },
        { label: 'TRACK 2', file: 'scene_2.svg' }
      ];
    }
  }

  async showHiscoreOverlay() {
    const { width, height } = this.sys.game.canvas;
    const blocker = this.add.rectangle(0, 0, width, height, 0x000000, 0.8)
      .setOrigin(0, 0)
      .setInteractive()
      .on('pointerdown', () => {
        blocker.destroy();
        container.destroy();
      });

    let hiscores = {};
    try {
      const res = await fetch('assets/levels/hiscores.json');
      hiscores = await res.json();
    } catch (e) {
      console.warn('Nie udało się wczytać hiscores.json', e);
    }

    const trackKey = `track${this.selectedTrack + 1}`;
    const scores = hiscores.tracks?.[trackKey] || [];

    const container = this.add.container(width / 2, height / 2);
    const bg = this.add.graphics();
    bg.fillStyle(0x1f2f3f, 0.9);
    bg.fillRoundedRect(-300, -200, 600, 400, 20);
    container.add(bg);

    const title = this.add.text(0, -160, `HISCORE - ${this.tracks[this.selectedTrack].label}`, {
      fontFamily: 'Stormfaze',
      fontSize: '32px',
      color: '#ffffff'
    }).setOrigin(0.5);
    container.add(title);

    scores.forEach((entry, i) => {
      const line = this.add.text(-250, -100 + i * 60,
        `${entry.place}. ${entry.nick}  ${entry.totalTime}  [${entry.bestLap}]`, {
        fontFamily: 'Stormfaze',
        fontSize: '24px',
        color: '#83b1afff'
      });
      container.add(line);
    });
  }

  handleButton(key) {
    if (key === 'start') {
      this.scene.start('LoadingScene', {
        trackFile: this.tracks[this.selectedTrack].file,
        gameMode: this.gameMode,
        startFix: this.tracks[this.selectedTrack].startFix
      });
    } else if (key === 'fullscreen') {
      document.fullscreenElement
        ? document.exitFullscreen()
        : document.body.requestFullscreen();
    } else if (key === 'track') {
      this.selectedTrack = (this.selectedTrack + 1) % this.tracks.length;
      window._selectedTrack = this.selectedTrack;
      const btn = this.menuButtons.find(b => b.key === 'track');
      if (btn) btn.text.setText(this.tracks[this.selectedTrack].label);
    } else if (key === 'mode') {
      this.gameMode = this.gameMode === 'PRACTICE' ? 'RACE' : 'PRACTICE';
      window._gameMode = this.gameMode;
      const btn = this.menuButtons.find(b => b.key === 'mode');
      if (btn) btn.text.setText(this.gameMode);
    } else if (key === 'hiscore') {
      this.showHiscoreOverlay();
    }
  }

  shutdown() {
    if (this.gradientTween) {
      this.gradientTween.stop();
      this.gradientTween = null;
    }
    this.tweens.killAll();
    if (this.textures.exists('gradientOverlay')) {
      this.textures.remove('gradientOverlay');
    }
    console.log('[MenuScene] Scene shutdown - cleaned up gradient animation');
  }
}
