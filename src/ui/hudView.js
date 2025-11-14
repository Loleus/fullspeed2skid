// src/ui/HudView.js
export class HudView {
  constructor(scene) {
    this.scene = scene;
    this.game = scene.game;
    this.control = {};
    this._elements = [];         // wszystkie display objects do łatwego show/hide/destroy
    this._pointerHandlers = [];  // referencje do handlerów żeby odpiąć później
    this.visible = true;
  }

  create() {
    // identyczna logika sprawdzająca urządzenie mobilne jak w oryginale
    if (!this.scene.sys.game.device.os.android && !this.scene.sys.game.device.os.iOS) {
      // nie tworzymy nic na desktopie
      return;
    }

    const viewW = this.scene.sys.game.config.width;
    const viewH = this.scene.sys.game.config.height;

    const btnRadius = 80;
    const margin = 10;
    const y = viewH - btnRadius - margin - 10;

    this.gasBtn = this._circle(btnRadius + margin, y, btnRadius, 0x00cc00, 0.2);
    this.brakeBtn = this._circle(viewW - btnRadius - margin, y, btnRadius, 0xcc0000, 0.2);

    this.gasText = this._text(btnRadius + margin, y, '↑');
    this.brakeText = this._text(viewW - btnRadius - margin, y, '↓');

    const startX = 10;
    const startY = 10;
    const btnSpacing = 10;
    const buttonRadius = 40;

    this.vBtn = this._circle(startX + buttonRadius, startY + buttonRadius, buttonRadius, 0x000099, 0.3);
    this.vText = this._text(startX + buttonRadius, startY + buttonRadius, 'V');

    this.rBtn = this._circle(startX + buttonRadius * 3 + btnSpacing, startY + buttonRadius, buttonRadius, 0x009900, 0.3);
    this.rText = this._text(startX + buttonRadius * 3 + btnSpacing, startY + buttonRadius, 'R');

    this.xBtn = this._circle(startX + buttonRadius * 5 + btnSpacing * 2, startY + buttonRadius, buttonRadius, 0x990000, 0.3);
    this.xText = this._text(startX + buttonRadius * 5 + btnSpacing * 2, startY + buttonRadius, 'X');

    // zainicjalizuj stan kontrolerów
    this.control = { up: false, down: false, v: false, r: false, x: false };

    // podłącz pointery ale NIE EMITUJEMY globalnie - tylko aktualizujemy this.control
    this._hookBtn(this.gasBtn, 'up');
    this._hookBtn(this.brakeBtn, 'down');
    this._hookBtn(this.vBtn, 'v');
    this._hookBtn(this.rBtn, 'r');
    this._hookBtn(this.xBtn, 'x');
  }

  // helper tworzący circle i rejestrujący w elements
  _circle(x, y, radius, color, alpha = 0.3) {
    const c = this.scene.add.circle(x, y, radius, color)
      .setAlpha(alpha)
      .setStrokeStyle(3, 0xffadff)
      .setInteractive();
    this._elements.push(c);
    return c;
  }

  // helper tworzący text i rejestrujący w elements
  _text(x, y, txt) {
    const t = this.scene.add.text(x, y, txt, { font: '48px Arial', color: '#fffaddff' }).setOrigin(0.5);
    this._elements.push(t);
    return t;
  }

  // podłącza pointery do obiektu i zapisuje handlery do późniejszego odpinania
  _hookBtn(obj, key) {
    const down = () => { this.control[key] = true; };
    const up = () => { this.control[key] = false; };
    obj.on('pointerdown', down);
    obj.on('pointerup', up);
    obj.on('pointerout', up);
    this._pointerHandlers.push({ obj, down, up });
  }

  // tylko show/hide grafiki
  setVisible(flag) {
    this.visible = flag;
    for (const el of this._elements) {
      el.setVisible(flag);
    }
  }

  // cleanup: usuń handlery i obiekty
  destroy() {
    for (const { obj, down, up } of this._pointerHandlers) {
      obj.off('pointerdown', down);
      obj.off('pointerup', up);
      obj.off('pointerout', up);
      if (!obj.destroyed) obj.destroy();
    }
    this._pointerHandlers = [];

    for (const e of this._elements) {
      if (!e.destroyed) e.destroy();
    }
    this._elements = [];
    this.control = {};
  }
}
