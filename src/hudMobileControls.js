export default class HudMobileControls {
    constructor(scene) {
      this.scene = scene;
    }
  
    createButton(x, y, label, callback) {
      const fontSize = 40;
      const padding = 12;
  
      const text = this.scene.add.text(0, 0, label, {
        fontFamily: 'Stormfaze',
        fontSize: `${fontSize}px`,
        color: '#ffffff'
      }).setOrigin(0.5);
  
      const diameter = Math.max(text.width, text.height) + padding * 2;
      const circle = this.scene.add.circle(x, y, diameter / 2, 0x1f1f1f)
        .setStrokeStyle(3, 0xffffff)
        .setInteractive()
        .setScrollFactor(0)
        .setDepth(100);
  
      text.setPosition(x, y).setDepth(101).setScrollFactor(0);
      circle.on('pointerdown', callback);
    }
  
    createAll() {
      const spacing = 80;
      const margin = 30;
      const y = 30;
  
      this.createButton(margin + 0 * spacing, y, 'V', () => this.scene.cameraManager.toggle());
      this.createButton(margin + 1 * spacing, y, 'R', () => this.scene.resetGame());
      this.createButton(margin + 2 * spacing, y, 'X', () => this.scene.exitToMenu());
    }
  }
  