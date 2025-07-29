// HudScene.js - scena dedykowana HUD, przyciski gazu i hamulca na ekranie mobilnym

export class HudScene extends window.Phaser.Scene {
  constructor() {
    super({ key: 'HudScene', active: true, visible: false });
  }

  create() {
    console.log('HudScene create called');
    const gameScene = this.scene.get('GameScene');

    gameScene.events.on('game-scene-start', () => {
      console.log('Received game-scene-start event');
      this.scene.setVisible(true);
      this.scene.setActive(true);
    });

    gameScene.events.on('game-scene-shutdown', () => {
      console.log('Received game-scene-shutdown event');
      this.scene.setVisible(false);
      this.scene.setActive(false);
    });

    if (!this.sys.game.device.os.android && !this.sys.game.device.os.iOS) {
      console.log('Not mobile device, skipping button creation');
      return;
    }

    const viewW = this.sys.game.config.width;
    const viewH = this.sys.game.config.height;

    const btnRadius = 60;
    const margin = 30;
    const y = viewH - btnRadius - margin - 40;

    this.gasBtn = this.add.circle(btnRadius + margin, y, btnRadius, 0x00cc00)
      .setAlpha(0.3)
      .setStrokeStyle(3, 0xffffff)
      .setInteractive();
    console.log('Created gasBtn');

    this.brakeBtn = this.add.circle(viewW - btnRadius - margin, y, btnRadius, 0xcc0000)
      .setAlpha(0.3)
      .setStrokeStyle(3, 0xffffff)
      .setInteractive();
    console.log('Created brakeBtn');

    this.gasText = this.add.text(btnRadius + margin, y, '↑', { font: '48px Arial', color: '#fff' })
      .setOrigin(0.5);

    this.brakeText = this.add.text(viewW - btnRadius - margin, y, '↓', { font: '48px Arial', color: '#fff' })
      .setOrigin(0.5);

    this.control = {};

    this.gasBtn.on('pointerdown', () => { this.control.up = true; this.emitControl(); });
    this.gasBtn.on('pointerup', () => { this.control.up = false; this.emitControl(); });
    this.gasBtn.on('pointerout', () => { this.control.up = false; this.emitControl(); });

    this.brakeBtn.on('pointerdown', () => { this.control.down = true; this.emitControl(); });
    this.brakeBtn.on('pointerup', () => { this.control.down = false; this.emitControl(); });
    this.brakeBtn.on('pointerout', () => { this.control.down = false; this.emitControl(); });
  }

  emitControl() {
    this.game.events.emit('hud-control', this.control);
  }
}
