import { drawButton, drawShadow } from './menu_drawUtils.js';
export class HiscoreOverlay {
  constructor(scene) {
    this.scene = scene;
    this.blocker = null;
    this.hiscoreContainer = null;
  }
  msToStandardTime(ms) {
    const totalMs = Math.floor(ms * 1000); // konwersja sekund na milisekundy
    const hours = Math.floor(totalMs / 3600000);
    const minutes = Math.floor((totalMs % 3600000) / 60000);
    const seconds = Math.floor((totalMs % 60000) / 1000);
    const centiseconds = Math.floor((totalMs % 1000) / 10);

    return `${hours}:${minutes.toString().padStart(2, '0')}'${seconds.toString().padStart(2, '0')}"${centiseconds.toString().padStart(2, '0')}`;
  }

  // async show() {
  //   if (this.scene.isOverlayOpen) return;

  //   const { width, height } = this.scene.sys.game.canvas;

  //   this.scene.isOverlayOpen = true;
  //   this.disableMenuButtons();

  //   this.blocker = this.scene.add.rectangle(0, 0, width, height, 0x000000, 0.8)
  //     .setOrigin(0, 0)
  //     .setDepth(997)
  //     .setInteractive();

  //   this.hiscoreContainer = this.scene.add.container(width / 2, height / 2);
  //   this.hiscoreContainer.setDepth(999);
  //   const bgP = this.scene.add.image(0, 0, 'bgc').setOrigin(0, 0);
  //   bgP.setDisplaySize(width, height);
  //   bgP.setScrollFactor(0);
  //   bgP.setDepth(998);
  //   const bg = this.scene.add.graphics();
  //   bg.fillStyle(Phaser.Display.Color.RGBStringToColor("rgba(20, 48, 46, 1)").color, 0.9);
  //   bg.fillRoundedRect(-300, -200, 600, 400, 20);
  //   this.hiscoreContainer.add(bg, bgP);

  //   let hiscores = this.scene.hiscores;

  //   const trackKey = `track${this.scene.selectedTrack + 1}`;
  //   const scores = hiscores.tracks?.[trackKey] || [];

  //   const title = this.scene.add.text(0, -136, `HISCORES - ${this.scene.tracks[this.scene.selectedTrack].label}`, {
  //     fontFamily: 'Harting',
  //     fontSize: '43px',
  //     color: '#ed4c16ff'
  //   }).setOrigin(0.5);
  //   this.hiscoreContainer.add(title);

  //   scores.forEach((entry, i) => {
  //     const line = this.scene.add.text(-226, -70 + i * 60,
  //       `${entry.place}. ${entry.nick}  ${this.msToStandardTime(entry.totalTime)}  [${this.msToStandardTime(entry.bestLap)}]`, {
  //       fontFamily: 'Harting',
  //       fontSize: '24px',
  //       color: '#f0b5a1ff'
  //     });
  //     this.hiscoreContainer.add(line);
  //   });

  //   this.blocker.on('pointerdown', () => this.hide());
  // }
async show() {
  if (this.scene.isOverlayOpen) return;

  const { width, height } = this.scene.sys.game.canvas;

  this.scene.isOverlayOpen = true;
  this.disableMenuButtons();

  // blocker (pełne tło pod overlay)
  this.blocker = this.scene.add.rectangle(0, 0, width, height, 0x000000, 0.8)
    .setOrigin(0, 0)
    .setDepth(997)
    .setInteractive();

  // centralny kontener (środek ekranu)
  const containerX = width / 2;
  const containerY = height / 2;
  this.hiscoreContainer = this.scene.add.container(containerX, containerY);
  this.hiscoreContainer.setDepth(999);

  // parametry ramki (jak w oryginale)
  const frameW = 600;
  const frameH = 400;
  const frameRadius = 5;

  // PANEL (lokalny w kontenerze) - kolorowa ramka pod tekstami
  const panel = this.scene.add.graphics();
  panel.fillStyle(Phaser.Display.Color.RGBStringToColor("rgba(0, 0, 0, 1)").color, 0.5);
  // rysujemy RELATYWNIE do środka kontenera: origin kontenera jest w jego środku => -300,-200
  panel.fillRoundedRect(-frameW / 2, -frameH / 2, frameW, frameH, frameRadius);
  panel.setDepth(999);
  this.hiscoreContainer.add(panel);

  // MASKA w przestrzeni świata: rysujemy okrągły prostokąt dokładnie tam, gdzie jest kontener
  const maskGraphics = this.scene.add.graphics();
  maskGraphics.fillStyle(0xffffff);
  maskGraphics.fillRoundedRect(containerX - frameW / 2, containerY - frameH / 2, frameW, frameH, frameRadius);
  maskGraphics.setVisible(false);
  maskGraphics.setDepth(998);
  const geomMask = maskGraphics.createGeometryMask();

  // TŁO (nie skalowane) umieszczone wewnątrz kontenera (0,0) — będzie przycięte maską
  const bgImage = this.scene.add.image(0, 0, 'hiscoreBG').setOrigin(0.5, 0.5);
  bgImage.setScrollFactor(0);
  bgImage.setDepth(996);
  bgImage.setMask(geomMask); // maska działa w world coords i przytnie obraz widoczny w kontenerze
  this.hiscoreContainer.addAt(bgImage, 0);

  // Zapisujemy referencję do maskGraphics, żeby usunąć go później w hide()
  this._maskGraphics = maskGraphics;

  // Tytuł i linie wyników (takie same pozycje jak wcześniej)
  let hiscores = this.scene.hiscores;
  const trackKey = `track${this.scene.selectedTrack + 1}`;
  const scores = hiscores.tracks?.[trackKey] || [];

  const title = this.scene.add.text(0, -136, `HISCORES - ${this.scene.tracks[this.scene.selectedTrack].label}`, {
    fontFamily: 'Harting',
    fontSize: '45px',
    color: '#f4f4f4ff'
  }).setOrigin(0.5).setShadow(2, 2, '#000000ff', 2, false, true);
  title.setDepth(1000);
  this.hiscoreContainer.add(title);

  scores.forEach((entry, i) => {
    const line = this.scene.add.text(0, -55 + i * 60,
      `${entry.place}. ${entry.nick}  ${this.msToStandardTime(entry.totalTime)}  [${this.msToStandardTime(entry.bestLap)}]`, {
        fontFamily: 'Harting',
        fontSize: '26px',
        color: '#f4f4f4ff'
      }).setOrigin(0.5,0.5).setShadow(2, 2, '#000000ff', 2, false, true);;
    line.setDepth(1000);
    this.hiscoreContainer.add(line);
  });

  // kliknięcie poza ramką zamyka overlay
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
if (this._maskGraphics) { this._maskGraphics.destroy(); this._maskGraphics = null; }
    this.scene.isOverlayOpen = false;
    this.enableMenuButtons();
  }

  disableMenuButtons() {
    if (!this.scene.ui?.menuButtons) return;

    this.scene.ui.menuButtons.forEach(btn => {
      const isStart = btn.key === 'start';
      const isMusic = btn.key === 'music';
      const style = isStart ? { ...this.scene.ui.menuStyle, ...this.scene.ui.menuStyle.customStartStyle } : !isMusic ? this.scene.ui.menuStyle : { ...this.scene.ui.menuStyle, ...this.scene.ui.menuStyle.customMusicStyle };

      if (btn.container) {
        btn.container.setAlpha(0.5);
      }
      if (btn.hitCircle) {
        btn.hitCircle.removeInteractive();
        btn.hitCircle.removeAllListeners();
      }
      if (btn.bg) {
        drawButton(
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
      const isMusic = btn.key === 'music';
      const style = isStart ? { ...this.scene.ui.menuStyle, ...this.scene.ui.menuStyle.customStartStyle } : !isMusic ? this.scene.ui.menuStyle : { ...this.scene.ui.menuStyle, ...this.scene.ui.menuStyle.customMusicStyle };

      if (btn.container) {
        btn.container.setAlpha(1);
      }
      if (btn.text) {
        btn.text.setColor(style.buttonTextColor);
      }
      if (btn.hitCircle) {
        btn.hitCircle.setInteractive({ useHandCursor: true });

        btn.hitCircle.on('pointerover', () =>
          drawButton(
            btn.bg,
            style.buttonHoverColor,
            style.buttonAlpha,
            style.buttonStrokeColor,
            style.buttonWidth,
            style.buttonHeight
          )
        );

        btn.hitCircle.on('pointerout', () =>
          drawButton(
            btn.bg,
            style.buttonFillColor,
            style.buttonAlpha,
            style.buttonStrokeColor,
            style.buttonWidth,
            style.buttonHeight
          )
        );

        btn.hitCircle.on('pointerdown', () => {
          drawShadow(
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
          drawShadow(
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