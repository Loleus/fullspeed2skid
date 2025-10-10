export class MenuUI {
  constructor(scene) {
    this.scene = scene;
    this.menuButtons = [];
    this.gradientState = { stop1: 0.3, stop2: 0.7 };
    this.gradientTween = null;
    this.gradientCanvas = null;
    this.logo = null;

    this.menuStyle = {
      buttonWidth: 220,
      buttonHeight: 170,
      buttonMargin: 0,
      buttonPadding: 1,
      buttonAlpha: 0.67,
      buttonFillColor: Phaser.Display.Color.RGBStringToColor("rgba(91, 137, 0, 1)").color,
      shadowButtonFillColor: Phaser.Display.Color.RGBStringToColor("rgba(0, 0, 0, 1)").color,
      buttonHoverColor: Phaser.Display.Color.RGBStringToColor("rgba(122, 163, 17, 1)").color,
      buttonStrokeColor: Phaser.Display.Color.RGBStringToColor("rgba(38, 57, 0, 1)").color,
      buttonFontSize: '28px',
      buttonFontFamily: 'Harting',
      buttonTextColor: 'rgba(141, 211, 0, 1)',
      buttonDisabledColor: '#666',
      offsetY: 30,
      shadowOffsetDefault: { x: 6, y: 4 },
      shadowOffsetPressed: { x: -4, y: -5 },
      customStartStyle: {
        buttonWidth: 210,
        buttonHeight: 210,
        buttonFillColor: Phaser.Display.Color.RGBStringToColor("rgba(225, 60, 0, 1)").color,
        buttonHoverColor: Phaser.Display.Color.RGBStringToColor("rgba(255, 81, 0, 1)").color,
        buttonStrokeColor: Phaser.Display.Color.RGBStringToColor("rgba(83, 37, 0, 1)").color,
        buttonTextColor: '#ff821cff',
        interactionRadiusOffset: 0,
        buttonFontSize: '58px',
      }
    };
  }

  createBackground() {
    const { width, height } = this.scene.sys.game.canvas;

    // Preferuj 'bgc' jako pełnoekranowe tło jeśli dostępne, w przeciwnym razie użyj 'tile' tylko gdy istnieje
    if (this.scene.textures.exists('bgc')) {
      const bg = this.scene.add.image(0, 0, 'bgc').setOrigin(0, 0);
      bg.setDisplaySize(width, height);
      bg.setScrollFactor(0);
      bg.setDepth(-1000);
    } else if (this.scene.textures.exists('tile')) {
      // Jeśli tile istnieje użyj tileSprite tak jak wcześniej
      const ts = this.scene.add.tileSprite(0, 0, width, height, 'tile').setOrigin(0, 0);
      ts.setScrollFactor(0);
      ts.setDepth(-1000);
    } else {
      // Nie dodaj nic jeśli żadna z tekstur nie istnieje, aby uniknąć placeholderów Phaser
      console.warn('[MenuUI] Brak tekstury bgc i tile, nie dodano tła');
    }
  }

  createGradientOverlay() {
    const { width, height } = this.scene.sys.game.canvas;

    if (this.scene.textures.exists('gradientOverlay')) {
      this.scene.textures.remove('gradientOverlay');
    }

    this.gradientCanvas = this.scene.textures.createCanvas('gradientOverlay', width, height);
    const ctx = this.gradientCanvas.getContext();
    this.updateGradient(ctx, width, height);
    this.gradientCanvas.refresh();

    const overlayImage = this.scene.add.image(0, 0, 'gradientOverlay').setOrigin(0, 0).setAlpha(1);
    overlayImage.setDepth(0); // powinno być nad tłem, pod UI
  }

  updateGradient(ctx, width, height) {
    const g = ctx.createLinearGradient(0, 0, 0, height);
    g.addColorStop(0, 'rgba(255, 255, 255, 1)');
    g.addColorStop(this.gradientState.stop1, 'rgba(255, 255, 255, 0)');
    g.addColorStop(this.gradientState.stop2, 'rgba(0, 0, 0, 0)');
    g.addColorStop(1, 'rgba(0, 0, 0, 1)');
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
      }).setOrigin(0.5).setShadow(2, 2, '#000', 1, false, true);

      const container = this.scene.add.container(x + style.buttonWidth / 2, y, [shadow, bg, text]);
      container.setDepth(1);

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

        container.addAt(hitCircle, 0).setDepth(2);
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
    const y = height / 2 + oy - h - 70;
    const text1Glow = this.scene.add.text(0, 0, 'Full Speed 2', {
      fontFamily: 'skid',
      fontSize: '54px',
      color: '#ae0000ff',
      align: 'center'
    }).setShadow(0, -2, '#ffe5c7ff', 3 , false, true);

    const text1Shadow = this.scene.add.text(0, 0, 'Full Speed 2', {
      fontFamily: 'skid',
      fontSize: '54px',
      color: '#000000ff',
      align: 'center'
    }).setShadow(3, 4, '#330a00ff', 1, false, true);

    const text2Glow = this.scene.add.text(0, 0, 'Skid', {
      fontFamily: 'punk_kid',
      fontSize: '80px',
      color: 'rgba(0, 0, 0, 0)',
      align: 'center'
    }).setShadow(3, -3, '#fff1e5ff', 6 , false, true);

    const text2Shadow = this.scene.add.text(0, 0, 'Skid', {
      fontFamily: 'punk_kid',
      fontSize: '80px',
      color: 'rgba(0, 0, 0, 1)',
      align: 'center'
    }).setShadow(-3, 3, '#c2b0abff', 1, false, true);

    const totalTitleWidth = text1Shadow.width + text2Shadow.width;
    const startX = width / 2 - totalTitleWidth / 2;

    text1Shadow.setPosition(startX, y).setOrigin(0, 0.5);
    text1Glow.setPosition(startX, y).setOrigin(0, 0.5);

    text2Shadow.setPosition(startX + text1Shadow.width + 30, y + (text1Shadow.height - text2Shadow.height) / 2 - 60).setOrigin(0, 0.5);
    text2Glow.setPosition(startX + text1Shadow.width + 30, y + (text1Shadow.height - text2Shadow.height) / 2 - 60).setOrigin(0, 0.5);

    this.logo = {
      text1: text1Shadow,
      text2: text2Shadow,
      text1Glow,
      text2Glow
    };

    // Ustaw logo nad UI
    this.logo.text1.setDepth(2);
    this.logo.text1Glow.setDepth(3);
    this.logo.text2.setDepth(2);
    this.logo.text2Glow.setDepth(3);
  }

  drawButton(g, fill, alpha, stroke, w, h) {
    g.clear();
    const radius = Math.min(w, h) / 2;
    g.fillStyle(fill, alpha);
    g.lineStyle(3, stroke);
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
      key !== "track" ? btn.text.setText("MODE\n" + newText) : btn.text.setText("SELECT\n" + newText);
    }
  }

  destroy() {
    if (this.gradientTween) {
      this.gradientTween.stop();
      this.gradientTween = null;
    }
    if (this.scene.textures.exists('gradientOverlay')) {
      this.scene.textures.remove('gradientOverlay');
    }
    this.menuButtons.forEach(b => {
      b.container?.destroy();
      b.shadow?.destroy();
      b.bg?.destroy();
      b.text?.destroy();
      b.hitCircle?.destroy();
    });
    this.menuButtons = [];
    if (this.logo) {
      this.logo.text1?.destroy();
      this.logo.text2?.destroy();
      this.logo.text1Glow?.destroy();
      this.logo.text2Glow?.destroy();
      this.logo = null;
    }
  }
}
