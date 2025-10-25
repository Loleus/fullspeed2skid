export function destroyMenuButtons(menuButtons) {
  menuButtons.forEach(b => {
    b.container?.destroy();
    b.shadow?.destroy();
    b.bg?.destroy();
    b.text?.destroy();
    b.hitCircle?.destroy();
  });
}

import { drawButton, drawShadow } from './menuUI_createButtons_drawUtils.js';

export function createButtons(scene, menuStyle, buttons, onButtonClick) {
  const { width, height } = scene.sys.game.canvas;
  const {
    buttonWidth: w, buttonHeight: h, buttonMargin: m, buttonPadding: p,
    buttonAlpha: a, buttonFillColor: f, buttonHoverColor: hf, buttonStrokeColor: s,
    buttonFontSize: fs, buttonFontFamily: ff, buttonTextColor: tc, buttonDisabledColor: dc,
    shadowButtonFillColor: sf, offsetY: oy, shadowOffsetDefault: so, shadowOffsetPressed: sp
  } = menuStyle;

  const startIndex = buttons.findIndex(b => b.key === 'start');
  const musicIndex = buttons.findIndex(b => b.key === 'music');

  const filteredButtons = buttons.filter(b => b.key !== 'music');
  const totalWidth = filteredButtons.length * w + (filteredButtons.length - 1) * m;
  let x = width / 2 - totalWidth / 2;
  const y = height / 2 + oy;

  const menuButtons = [];

  // Rysowanie przycisków poziomo
  filteredButtons.forEach((btn, i) => {
    const isStart = btn.key === 'start';
    const style = isStart ? { ...menuStyle, ...menuStyle.customStartStyle } : menuStyle;

    const shadow = scene.add.graphics();
    drawShadow(shadow, style.shadowOffsetDefault, style.buttonWidth, style.buttonHeight, style.shadowButtonFillColor, style.buttonAlpha);

    const bg = scene.add.graphics();
    drawButton(bg, style.buttonFillColor, style.buttonAlpha, style.buttonStrokeColor, style.buttonWidth, style.buttonHeight);

    const text = scene.add.text(0, 0, btn.label, {
      fontFamily: style.buttonFontFamily,
      fontSize: style.buttonFontSize,
      color: btn.disabled ? style.buttonDisabledColor : style.buttonTextColor,
      align: 'center',
      padding: { left: style.buttonPadding, right: style.buttonPadding, top: style.buttonPadding, bottom: style.buttonPadding }
    }).setOrigin(0.5).setShadow(2, 2, '#000', 1, false, true);

    const container = scene.add.container(x + style.buttonWidth / 2, y, [shadow, bg, text]);
    container.setDepth(1);

    let hitCircle = null;
    if (!btn.disabled) {
      const radius = Math.min(style.buttonWidth, style.buttonHeight) / 2 + (style.interactionRadiusOffset || 0);
      hitCircle = scene.add.circle(0, 0, radius, 0x000000, 0);
      hitCircle.setInteractive({ useHandCursor: true });

      hitCircle.on('pointerover', () =>
        drawButton(bg, style.buttonHoverColor, style.buttonAlpha, style.buttonStrokeColor, style.buttonWidth, style.buttonHeight)
      );

      hitCircle.on('pointerout', () =>
        drawButton(bg, style.buttonFillColor, style.buttonAlpha, style.buttonStrokeColor, style.buttonWidth, style.buttonHeight)
      );

      hitCircle.on('pointerdown', () =>
        drawShadow(shadow, style.shadowOffsetPressed, style.buttonWidth, style.buttonHeight, style.shadowButtonFillColor, style.buttonAlpha)
      );

      hitCircle.on('pointerup', () => {
        drawShadow(shadow, style.shadowOffsetDefault, style.buttonWidth, style.buttonHeight, style.shadowButtonFillColor, style.buttonAlpha);
        if (onButtonClick) {
          onButtonClick(btn.key);
        }
      });

      container.addAt(hitCircle, 0).setDepth(2);
    }

    menuButtons.push({
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

  // Rysowanie przycisku 'music' pod 'start'
  const musicBtn = buttons[musicIndex];
  if (musicBtn) {
    const style = { ...menuStyle, ...menuStyle.customMusicStyle };
    const startBtn = menuButtons.find(b => b.key === 'start');
    const musicX = startBtn?.container?.x ?? width / 2;
    const musicY = y + style.buttonHeight + style.offsetY;

    const shadow = scene.add.graphics();
    drawShadow(shadow, style.shadowOffsetDefault, style.buttonWidth, style.buttonHeight, style.shadowButtonFillColor, style.buttonAlpha);

    const bg = scene.add.graphics();
    drawButton(bg, style.buttonFillColor, style.buttonAlpha, style.buttonStrokeColor, style.buttonWidth, style.buttonHeight);

    const text = scene.add.text(0, 0, musicBtn.label, {
      fontFamily: style.buttonFontFamily,
      fontSize: style.buttonFontSize,
      color: musicBtn.disabled ? style.buttonDisabledColor : style.buttonTextColor,
      align: 'center',
      padding: { left: style.buttonPadding, right: style.buttonPadding, top: style.buttonPadding, bottom: style.buttonPadding }
    }).setOrigin(0.5).setShadow(2, 2, '#000', 1, false, true);

    const container = scene.add.container(musicX, musicY, [shadow, bg, text]);
    container.setDepth(1);

    let hitCircle = null;
    if (!musicBtn.disabled) {
      const radius = Math.min(style.buttonWidth, style.buttonHeight) / 2 + (style.interactionRadiusOffset || 0);
      hitCircle = scene.add.circle(0, 0, radius, 0x000000, 0);
      hitCircle.setInteractive({ useHandCursor: true });

      hitCircle.on('pointerover', () =>
        drawButton(bg, style.buttonHoverColor, style.buttonAlpha, style.buttonStrokeColor, style.buttonWidth, style.buttonHeight)
      );

      hitCircle.on('pointerout', () =>
        drawButton(bg, style.buttonFillColor, style.buttonAlpha, style.buttonStrokeColor, style.buttonWidth, style.buttonHeight)
      );

      hitCircle.on('pointerdown', () =>
        drawShadow(shadow, style.shadowOffsetPressed, style.buttonWidth, style.buttonHeight, style.shadowButtonFillColor, style.buttonAlpha)
      );

      hitCircle.on('pointerup', () => {
        drawShadow(shadow, style.shadowOffsetDefault, style.buttonWidth, style.buttonHeight, style.shadowButtonFillColor, style.buttonAlpha);
        if (onButtonClick) {
          onButtonClick(musicBtn.key);
        }
      });

      container.addAt(hitCircle, 0).setDepth(2);
    }

    menuButtons.push({
      container,
      key: musicBtn.key,
      shadow,
      bg,
      text,
      hitCircle,
      style
    });
  }

  return menuButtons;
}
