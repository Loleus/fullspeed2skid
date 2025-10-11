export class ClassicCamera {
  constructor(scene, car, params = {}) {
    this.scene = scene;
    this.car = car;
    this.params = {
      followOffset: { x: 0.27, y: 0.27 },
      bounds: { x: 0, y: 0, width: 6144, height: 6144 },
      ...params
    };
    this.isActive = false;
  }
  
  activate() {
    if (this.isActive) return;
    
    // Ustaw granice świata
    this.scene.cameras.main.setBounds(
      this.params.bounds.x,
      this.params.bounds.y,
      this.params.bounds.width,
      this.params.bounds.height
    );
    
    // Ustaw śledzenie auta
    this.scene.cameras.main.startFollow(
      this.car,
      true,
      this.params.followOffset.x,
      this.params.followOffset.y
    );
    
    // Wycentruj kamerę na aucie
    this.scene.cameras.main.centerOn(this.car.x, this.car.y);
    
    this.isActive = true;
  }
  
  deactivate() {
    if (!this.isActive) return;
    
    // Zatrzymaj śledzenie
    this.scene.cameras.main.stopFollow();
    
    this.isActive = false;
  }
  
  update(dt) {
    // Kamera klasyczna nie wymaga specjalnej aktualizacji
    // Phaser automatycznie aktualizuje śledzenie
  }
  
  reset() {
    if (this.isActive) {
      // Wycentruj kamerę na aucie
      this.scene.cameras.main.centerOn(this.car.x, this.car.y);
    }
  }
  
  isClassicActive() {
    return this.isActive;
  }
}
