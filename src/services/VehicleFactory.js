// factories/VehicleFactory.js
import { PlayerCar, AICar } from "../domain/index.js";

export class VehicleFactory {
  constructor(scene, worldData) {
    this.scene = scene;
    this.worldData = worldData;
  }

createPlayer({ x, y, texture = "car_p1" }) {
  const sprite = this.scene.physics.add.sprite(x, y, texture)
    .setOrigin(0.5)
    .setDepth(2)
    .setScale(1);

  sprite.body.allowRotation = false;
  sprite.setVisible(false);

  const controller = new PlayerCar(this.scene, sprite, this.worldData);
  controller.resetState(x, y);

  // --- CIEŃ POD AUTEM ---
  const shadow = this.scene.add.sprite(x, y, "car_p1_sprite", 0)
    .setOrigin(0.5, 0.5)
    .setDepth(2.5)          // pod autem, ale nad fizycznym sprite
    .setScale(1, 1)   // spłaszczony cień
    .setTint(0x000000)      // czarny
    .setAlpha(0.35);        // półprzezroczysty

  // --- WIZUALNY SPRITE AUTA ---
  const visualSprite = this.scene.add.sprite(x, y, "car_p1_sprite", 0)
    .setOrigin(0.5, 0.5)
    .setDepth(3)
    .setScale(1, 1);

  controller.visualSprite = visualSprite;
  controller.shadowSprite = shadow;

  // Aktualizacja pozycji cienia w update PlayerCar
  const originalUpdate = controller.update.bind(controller);
const SHADOW_OFFSET_X = 0;
const SHADOW_OFFSET_Y = -6;

controller.update = (time, delta) => {
  originalUpdate(time, delta);
visualSprite.y -= 12
  shadow.x = visualSprite.x + SHADOW_OFFSET_X;
  shadow.y = visualSprite.y + SHADOW_OFFSET_Y;

  shadow.rotation = visualSprite.rotation;
  shadow.setFrame(visualSprite.frame.name);
};


  return { controller, sprite };
}


  createAI({ x, y, texture = "car_p2", waypoints }) {
    const sprite = this.scene.physics.add.sprite(x, y, texture).setOrigin(0.5).setDepth(2);
    sprite.body.allowRotation = false;
    const controller = new AICar(this.scene, sprite, this.worldData, waypoints);
    
    controller.resetState(x, y);
    return controller;
  }

  linkOpponents(c1, c2) {
    if (!c1 || !c2) return;
    c1.opponentController = c2;
    c2.opponentController = c1;
  }
}