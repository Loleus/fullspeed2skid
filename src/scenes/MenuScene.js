const btnHoverColor = Phaser.Display.Color.RGBStringToColor("rgba(33, 143, 153, 1)");
const btnColor = Phaser.Display.Color.RGBStringToColor("rgba(25, 104, 120, 1)");
const btnStrokeColor = Phaser.Display.Color.RGBStringToColor("rgb(0, 43, 36)");

export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
    this.menuStyle = {
      buttonWidth: 256,
      buttonHeight: 62,
      buttonMargin: 10,
      buttonPadding: 8,
      buttonAlpha: 0.26,
      buttonFillColor: btnColor.color,
      shadowButtonFillColor: 0x000000,
      buttonHoverColor: btnHoverColor.color,
      buttonStrokeColor: btnStrokeColor.color,
      buttonFontSize: '26px',
      buttonFontFamily: 'Stormfaze',
      buttonTextColor: '#83b1afff',
      buttonDisabledColor: '#666',
      offsetY: 52,
      shadowOffsetDefault: { x: 5, y: 5 },
      shadowOffsetPressed: { x: -3, y: -3 }
    };
    // Resetuj stan gradientu do wartości początkowych
    this.gradientState = { stop1: 0.2, stop2: 0.5 };
    this.gradientTween = null; // Referencja do tweena dla łatwego zatrzymania
    if (!window._tracks) window._tracks = [];
    if (typeof window._selectedTrack !== 'number') window._selectedTrack = 0;
    if (!window._gameMode) window._gameMode = 'PRACTICE';
    this.tracks = window._tracks;
    this.selectedTrack = window._selectedTrack;
    this.gameMode = window._gameMode;
  }

  async create() {
    const { width, height } = this.sys.game.canvas;
    this.add.tileSprite(0, 0, width, height, 'tile').setOrigin(0, 0);

    // Zatrzymaj poprzedni tween jeśli istnieje
    if (this.gradientTween) {
      this.gradientTween.stop();
      this.gradientTween = null;
    }

    // Resetuj stan gradientu do wartości początkowych
    this.gradientState = { stop1: 0.2, stop2: 0.5 };

    if (this.textures.exists('gradientOverlay')) this.textures.remove('gradientOverlay');
    const gradientCanvas = this.textures.createCanvas('gradientOverlay', width, height);
    const ctx = gradientCanvas.getContext();
    this.updateGradient(ctx, width, height);
    gradientCanvas.refresh();
    this.add.image(0, 0, 'gradientOverlay').setOrigin(0, 0).setAlpha(1);

    // Utwórz nowy tween i zapisz referencję
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
      { label: 'START', key: 'start' },
      { label: this.gameMode, key: 'mode' },
      { label: this.tracks[this.selectedTrack].label, key: 'track' },
      { label: 'FULLSCREEN', key: 'fullscreen' },
      { label: 'HISCORE', key: 'hiscore' } // ⬅️ nowy przycisk
    ];

    this.menuButtons = [];
    const {
      buttonWidth: w, buttonHeight: h, buttonMargin: m, buttonPadding: p,
      buttonAlpha: a, buttonFillColor: f, buttonHoverColor: hf, buttonStrokeColor: s,
      buttonFontSize: fs, buttonFontFamily: ff, buttonTextColor: tc, buttonDisabledColor: dc,
      shadowButtonFillColor: sf, offsetY: oy, shadowOffsetDefault: so, shadowOffsetPressed: sp
    } = this.menuStyle;

    const totalHeight = buttons.length * h + (buttons.length - 1) * m;
    let y = height / 2 - totalHeight / 2 + oy;

    buttons.forEach(btn => {
      const shadow = this.add.graphics();
      this.drawShadow(shadow, so, w, h, sf, a);
      const bg = this.add.graphics();
      this.drawButton(bg, f, a, s, w, h);
      const text = this.add.text(0, 0, btn.label, {
        fontFamily: ff, fontSize: fs, color: btn.disabled ? dc : tc, align: 'center',
        padding: { left: p, right: p, top: p, bottom: p }
      }).setOrigin(0.5).setShadow(2, 2, '#000', 3, false, true);
      const container = this.add.container(width / 2, y + h / 2, [shadow, bg, text]);

      if (!btn.disabled) {
        container.setSize(w, h).setInteractive({ useHandCursor: true });
        container.on('pointerover', () => {
          this.drawButton(bg, hf, a, s, w, h);
        });
        container.on('pointerout', () => {
          this.drawButton(bg, f, a, s, w, h);
        });
        container.on('pointerdown', () => {
          this.drawShadow(shadow, sp, w, h, sf, a);
          this.handleButton(btn.key);
        });
        container.on('pointerup', () => {
          this.drawShadow(shadow, so, w, h, sf, a);
        });
      }

      this.menuButtons.push({ container, key: btn.key });
      y += h + m;
    });

    const titleY = height / 2 - totalHeight / 2 - 80;
    const text1 = this.add.text(0, 0, 'Full Speed 2', {
      fontFamily: 'skid', fontSize: '44px', color: '#D72638', align: 'center'
    }).setShadow(2, 2, '#000', 4, false, true);
    const text2 = this.add.text(0, 0, 'Skid', {
      fontFamily: 'punk_kid', fontSize: '72px', color: 'rgba(248, 248, 242, 0.79)', align: 'center'
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
    g.fillStyle(fill, alpha);
    g.lineStyle(0, stroke);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 10);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, 10);
  }

  drawShadow(g, offset, w, h, fill, alpha) {
    g.clear();
    g.fillStyle(fill, alpha);
    g.lineStyle(0, 0x000000, 0);
    g.fillRoundedRect(-w / 2 + offset.x, -h / 2 + offset.y, w, h, 10);
  }

  async fetchTracks() {
    try {
      const res = await fetch('assets/levels/tracks.json');
      const data = await res.json();
      return data.filter((t, i, arr) => arr.findIndex(x => x.file === t.file) === i);
    } catch {
      return [{ label: 'TRACK 1', file: 'scene_1.svg' }, { label: 'TRACK 2', file: 'scene_2.svg' }];
    }
  }
async showHiscoreOverlay() {
  const { width, height } = this.sys.game.canvas;

  // Blokujący overlay
  const blocker = this.add.rectangle(0, 0, width, height, 0x000000, 0.8)
    .setOrigin(0, 0)
    .setInteractive()
    .on('pointerdown', () => {
      blocker.destroy();
      container.destroy();
    });

  // Wczytaj dane
  let hiscores = {};
  try {
    const res = await fetch('assets/levels/hiscores.json');
    hiscores = await res.json();
  } catch (e) {
    console.warn('Nie udało się wczytać hiscores.json', e);
  }

  const trackKey = `track${this.selectedTrack + 1}`;
  const scores = hiscores.tracks?.[trackKey] || [];

  // Kontener z wynikami
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
      document.fullscreenElement ? document.exitFullscreen() : document.body.requestFullscreen();
    } else if (key === 'track') {
      this.selectedTrack = (this.selectedTrack + 1) % this.tracks.length;
      window._selectedTrack = this.selectedTrack;
      const btn = this.menuButtons.find(b => b.key === 'track');
      if (btn) btn.container.getAt(2).setText(this.tracks[this.selectedTrack].label);
    } else if (key === 'mode') {
      this.gameMode = this.gameMode === 'PRACTICE' ? 'RACE' : 'PRACTICE';
      window._gameMode = this.gameMode;
      const btn = this.menuButtons.find(b => b.key === 'mode');
      if (btn) btn.container.getAt(2).setText(this.gameMode);
    } else if (key === 'hiscore') {
      this.showHiscoreOverlay();
      const btn = this.menuButtons.find(b => b.key === key);
if (btn) this.drawShadow(btn.container.getAt(0), this.menuStyle.shadowOffsetDefault, this.menuStyle.buttonWidth, this.menuStyle.buttonHeight, this.menuStyle.shadowButtonFillColor, this.menuStyle.buttonAlpha);

}
  }

  // Metoda wywoływana przy niszczeniu sceny - czyści zasoby
  shutdown() {
    // Zatrzymaj animację gradientu
    if (this.gradientTween) {
      this.gradientTween.stop();
      this.gradientTween = null;
    }
    
    // Wyczyść wszystkie tweens w tej scenie
    this.tweens.killAll();
    
    // Usuń teksturę gradientu
    if (this.textures.exists('gradientOverlay')) {
      this.textures.remove('gradientOverlay');
    }
    
    console.log('[MenuScene] Scene shutdown - cleaned up gradient animation');
  }
}
