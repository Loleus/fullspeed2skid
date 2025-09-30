export class HiscoreOverlay {
  constructor(scene) {
    this.scene = scene;
    this.blocker = null;
    this.hiscoreContainer = null;
  }

  async show() {
    if (this.scene.isOverlayOpen) return;

    const { width, height } = this.scene.sys.game.canvas;

    this.scene.isOverlayOpen = true;
    this.disableMenuButtons();

    this.blocker = this.scene.add.rectangle(0, 0, width, height, 0x000000, 0.8)
      .setOrigin(0, 0)
      .setDepth(998)
      .setInteractive();

    this.hiscoreContainer = this.scene.add.container(width / 2, height / 2);
    this.hiscoreContainer.setDepth(999);

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x1f2f3f, 0.9);
    bg.fillRoundedRect(-300, -200, 600, 400, 20);
    this.hiscoreContainer.add(bg);

    let hiscores = {};
    try {
      const res = await fetch('assets/levels/hiscores.json');
      hiscores = await res.json();
    } catch (e) {
      console.warn('Nie udało się wczytać hiscores.json', e);
    }

    const trackKey = `track${this.scene.selectedTrack + 1}`;
    const scores = hiscores.tracks?.[trackKey] || [];

    const title = this.scene.add.text(0, -160, `HISCORE - ${this.scene.tracks[this.scene.selectedTrack].label}`, {
      fontFamily: 'Stormfaze',
      fontSize: '32px',
      color: '#ffffff'
    }).setOrigin(0.5);
    this.hiscoreContainer.add(title);

    scores.forEach((entry, i) => {
      const line = this.scene.add.text(-250, -100 + i * 60,
        `${entry.place}. ${entry.nick}  ${entry.totalTime}  [${entry.bestLap}]`, {
        fontFamily: 'Stormfaze',
        fontSize: '24px',
        color: '#83b1afff'
      });
      this.hiscoreContainer.add(line);
    });

    this.blocker.on('pointerdown', () => this.hide());
  }

  hide() {
    if (this.blocker) {
      this.blocker.destroy();
      this.blocker = null;
    }
    if (this.hiscoreContainer) {
      this.hiscoreContainer.destroy();
      this.hiscoreContainer = null;
    }

    this.scene.isOverlayOpen = false;
    this.enableMenuButtons();
  }

  disableMenuButtons() {
    if (!this.scene.ui?.menuButtons) return;
    
    this.scene.ui.menuButtons.forEach(btn => {
      const isStart = btn.key === 'start';
      const style = isStart ? { ...this.scene.ui.menuStyle, ...this.scene.ui.menuStyle.customStartStyle } : this.scene.ui.menuStyle;

      if (btn.container) {
        btn.container.setAlpha(0.5);
      }
      if (btn.hitCircle) {
        btn.hitCircle.removeInteractive();
        btn.hitCircle.removeAllListeners();
      }
      if (btn.bg) {
        this.scene.ui.drawButton(
          btn.bg, 
          style.buttonFillColor, 
          style.buttonAlpha,
          style.buttonStrokeColor,
          style.buttonWidth,
          style.buttonHeight
        );
      }
      if (btn.text) {
        btn.text.setColor(style.buttonTextColor);
      }
    });
  }

  enableMenuButtons() {
    if (!this.scene.ui?.menuButtons) return;
    
    this.scene.ui.menuButtons.forEach(btn => {
      const isStart = btn.key === 'start';
      const style = isStart ? { ...this.scene.ui.menuStyle, ...this.scene.ui.menuStyle.customStartStyle } : this.scene.ui.menuStyle;

      if (btn.container) {
        btn.container.setAlpha(1);
      }
      if (btn.text) {
        btn.text.setColor(style.buttonTextColor);
      }
      if (btn.hitCircle) {
        btn.hitCircle.setInteractive({ useHandCursor: true });
        
        btn.hitCircle.on('pointerover', () =>
          this.scene.ui.drawButton(
            btn.bg,
            style.buttonHoverColor,
            style.buttonAlpha,
            style.buttonStrokeColor,
            style.buttonWidth,
            style.buttonHeight
          )
        );

        btn.hitCircle.on('pointerout', () =>
          this.scene.ui.drawButton(
            btn.bg,
            style.buttonFillColor,
            style.buttonAlpha,
            style.buttonStrokeColor,
            style.buttonWidth,
            style.buttonHeight
          )
        );

        btn.hitCircle.on('pointerdown', () => {
          this.scene.ui.drawShadow(
            btn.shadow,
            style.shadowOffsetPressed,
            style.buttonWidth,
            style.buttonHeight,
            style.shadowButtonFillColor,
            style.buttonAlpha
          );
          this.scene.handleButton(btn.key);
        });

        btn.hitCircle.on('pointerup', () =>
          this.scene.ui.drawShadow(
            btn.shadow,
            style.shadowOffsetDefault,
            style.buttonWidth,
            style.buttonHeight,
            style.shadowButtonFillColor,
            style.buttonAlpha
          )
        );
      }
    });
  }
}