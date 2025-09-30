export class MenuUI {
  constructor(scene) {
    this.scene = scene;
    this.menuButtons = [];
    this.gradientState = { stop1: 0.2, stop2: 0.5 };
    this.gradientTween = null;
    this.gradientCanvas = null;
    this.logo = null;

    this.menuStyle = {
      buttonWidth: 256,
      buttonHeight: 130,
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
      offsetY: 0,
      shadowOffsetDefault: { x: 5, y: 5 },
      shadowOffsetPressed: { x: -3, y: -3 },
      customStartStyle: {
        buttonWidth: 280,
        buttonHeight: 180,
        buttonFillColor: Phaser.Display.Color.RGBStringToColor("rgba(255, 100, 100, 1)").color,
        buttonHoverColor: Phaser.Display.Color.RGBStringToColor("rgba(255, 150, 150, 1)").color,
        buttonStrokeColor: Phaser.Display.Color.RGBStringToColor("rgb(100, 0, 0)").color,
        buttonTextColor: '#ffffff',
        interactionRadiusOffset: 0,
        buttonFontSize: '46px',
      }
    };
  }

  createBackground() {
    const { width, height } = this.scene.sys.game.canvas;
    this.scene.add.tileSprite(0, 0, width, height, 'tile').setOrigin(0, 0);
  }

  createGradientOverlay() {
    const { width, height } = this.scene.sys.game.canvas;

    if (this.gradientTween) this.gradientTween.stop();
    this.gradientState = { stop1: 0.2, stop2: 0.5 };

    if (this.scene.textures.exists('gradientOverlay')) {
      this.scene.textures.remove('gradientOverlay');
    }

    this.gradientCanvas = this.scene.textures.createCanvas('gradientOverlay', width, height);
    const ctx = this.gradientCanvas.getContext();
    this.updateGradient(ctx, width, height);
    this.gradientCanvas.refresh();

    this.scene.add.image(0, 0, 'gradientOverlay').setOrigin(0, 0).setAlpha(1);

    this.gradientTween = this.scene.tweens.add({
      targets: this.gradientState,
      stop1: 0.5,
      stop2: 0.8,
      duration: 4000,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
      onUpdate: () => {
        this.updateGradient(ctx, width, height);
        this.gradientCanvas.refresh();
      }
    });
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

  createButtons(buttons, onButtonClick) {
    const { width, height } = this.scene.sys.game.canvas;
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

    this.menuButtons = [];

    buttons.forEach((btn, i) => {
      const isStart = btn.key === 'start';
      const style = isStart ? { ...this.menuStyle, ...this.menuStyle.customStartStyle } : this.menuStyle;

      const shadow = this.scene.add.graphics();
      this.drawShadow(shadow, style.shadowOffsetDefault, style.buttonWidth, style.buttonHeight, style.shadowButtonFillColor, style.buttonAlpha);

      const bg = this.scene.add.graphics();
      this.drawButton(bg, style.buttonFillColor, style.buttonAlpha, style.buttonStrokeColor, style.buttonWidth, style.buttonHeight);

      const text = this.scene.add.text(0, 0, btn.label, {
        fontFamily: style.buttonFontFamily,
        fontSize: style.buttonFontSize,
        color: btn.disabled ? style.buttonDisabledColor : style.buttonTextColor,
        align: 'center',
        padding: { left: style.buttonPadding, right: style.buttonPadding, top: style.buttonPadding, bottom: style.buttonPadding }
      }).setOrigin(0.5).setShadow(2, 2, '#000', 3, false, true);

      const container = this.scene.add.container(x + style.buttonWidth / 2, y, [shadow, bg, text]);

      let hitCircle = null;
      if (!btn.disabled) {
        const radius = Math.min(style.buttonWidth, style.buttonHeight) / 2 + (style.interactionRadiusOffset || 0);
        hitCircle = this.scene.add.circle(0, 0, radius, 0x000000, 0);
        hitCircle.setInteractive({ useHandCursor: true });

        hitCircle.on('pointerover', () =>
          this.drawButton(bg, style.buttonHoverColor, style.buttonAlpha, style.buttonStrokeColor, style.buttonWidth, style.buttonHeight)
        );

        hitCircle.on('pointerout', () =>
          this.drawButton(bg, style.buttonFillColor, style.buttonAlpha, style.buttonStrokeColor, style.buttonWidth, style.buttonHeight)
        );

        hitCircle.on('pointerdown', () =>
          this.drawShadow(shadow, style.shadowOffsetPressed, style.buttonWidth, style.buttonHeight, style.shadowButtonFillColor, style.buttonAlpha)
        );

        hitCircle.on('pointerup', () => {
          this.drawShadow(shadow, style.shadowOffsetDefault, style.buttonWidth, style.buttonHeight, style.shadowButtonFillColor, style.buttonAlpha);
          if (onButtonClick) {
            onButtonClick(btn.key);
          }
        });

        container.addAt(hitCircle, 0).setDepth(1);
      }

      this.menuButtons.push({
        container,
        key: btn.key,
        shadow,
        bg,
        text,
        hitCircle,
        style
      });

      const isAfterStart = i > startIndex;
      x += style.buttonWidth + (isAfterStart ? style.buttonMargin : 0);
    });

    return this.menuButtons;
  }

  createLogo() {
    const { width, height } = this.scene.sys.game.canvas;
    const { buttonHeight: h, offsetY: oy } = this.menuStyle;
    const y = height / 2 + oy - h - 100;

    const text1 = this.scene.add.text(0, 0, 'Full Speed 2', {
      fontFamily: 'skid',
      fontSize: '44px',
      color: '#D72638',
      align: 'center'
    }).setShadow(2, 2, '#000', 4, false, true);

    const text2 = this.scene.add.text(0, 0, 'Skid', {
      fontFamily: 'punk_kid',
      fontSize: '72px',
      color: 'rgba(248, 248, 242, 0.79)',
      align: 'center'
    });

    const totalTitleWidth = text1.width + text2.width;
    const startX = width / 2 - totalTitleWidth / 2;
    text1.setPosition(startX, y).setOrigin(0, 0.5);
    text2.setPosition(startX + text1.width + 30, y + (text1.height - text2.height) / 2 - 60).setOrigin(0, 0.5);

    this.logo = { text1, text2 };
  }

  drawButton(g, fill, alpha, stroke, w, h) {
    g.clear();
    const radius = Math.min(w, h) / 2;
    g.fillStyle(fill, alpha);
    g.lineStyle(2, stroke);
    g.fillCircle(0, 0, radius);
    g.strokeCircle(0, 0, radius);
  }

  drawShadow(g, offset, w, h, fill, alpha) {
    g.clear();
    const radius = Math.min(w, h) / 2;
    g.fillStyle(fill, alpha);
    g.lineStyle(0, 0x000000, 0);
    g.fillCircle(offset.x, offset.y, radius);
  }

  updateButtonText(key, newText) {
    const btn = this.menuButtons.find(b => b.key === key);
    if (btn && btn.text) {
      btn.text.setText(newText);
    }
  }

  disableAllButtons() {
    this.menuButtons.forEach(btn => {
      if (btn.hitCircle) {
        btn.hitCircle.removeAllListeners();
        btn.hitCircle.disableInteractive();
      }
      if (btn.bg) {
        btn.bg.clear();
        this.drawButton(
          btn.bg,
          this.menuStyle.buttonDisabledColor,
          this.menuStyle.buttonAlpha,
          this.menuStyle.buttonStrokeColor,
          btn.style.buttonWidth,
          btn.style.buttonHeight
        );
      }
      if (btn.key === 'start' && btn.shadow) {
        this.drawShadow(
          btn.shadow,
          this.menuStyle.shadowOffsetDefault,
          btn.style.buttonWidth,
          btn.style.buttonHeight,
          this.menuStyle.shadowButtonFillColor,
          this.menuStyle.buttonAlpha
        );
      }
    });
  }

enableAllButtons(onButtonClick) {
    this.menuButtons.forEach(btn => {
      if (btn.hitCircle) {
        btn.hitCircle.setInteractive({ useHandCursor: true });

        const isStart = btn.key === 'start';
        const style = isStart ? { ...this.menuStyle, ...this.menuStyle.customStartStyle } : this.menuStyle;

        btn.hitCircle.removeAllListeners();
        btn.hitCircle.on('pointerover', () =>
          this.drawButton(btn.bg, style.buttonHoverColor, style.buttonAlpha, style.buttonStrokeColor, style.buttonWidth, style.buttonHeight)
        );
        btn.hitCircle.on('pointerout', () =>
          this.drawButton(btn.bg, style.buttonFillColor, style.buttonAlpha, style.buttonStrokeColor, style.buttonWidth, style.buttonHeight)
        );
        btn.hitCircle.on('pointerdown', () =>
          this.drawShadow(btn.shadow, style.shadowOffsetPressed, style.buttonWidth, style.buttonHeight, style.shadowButtonFillColor, style.buttonAlpha)
        );
        btn.hitCircle.on('pointerup', () => {
          this.drawShadow(btn.shadow, style.shadowOffsetDefault, style.buttonWidth, style.buttonHeight, style.shadowButtonFillColor, style.buttonAlpha);
          if (onButtonClick) {
            onButtonClick(btn.key);
          }
        });
      }

      if (btn.bg) {
        btn.bg.clear();
        const isStart = btn.key === 'start';
        const fillColor = isStart ? this.menuStyle.customStartStyle.buttonFillColor : this.menuStyle.buttonFillColor;
        this.drawButton(
          btn.bg,
          fillColor,
          this.menuStyle.buttonAlpha,
          this.menuStyle.buttonStrokeColor,
          btn.style.buttonWidth,
          btn.style.buttonHeight
        );
      }
    });
  }

  destroy() {
    if (this.gradientTween) {
      this.gradientTween.stop();
      this.gradientTween = null;
    }
    if (this.scene.textures.exists('gradientOverlay')) {
      this.scene.textures.remove('gradientOverlay');
    }
    this.menuButtons = [];
    if (this.logo) {
      this.logo.text1?.destroy();
      this.logo.text2?.destroy();
      this.logo = null;
    }
  }
}