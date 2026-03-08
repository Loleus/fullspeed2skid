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
      .setDepth(3)
      .setScale(1);

    sprite.body.allowRotation = false;
    sprite.setVisible(false);

    const controller = new PlayerCar(this.scene, sprite, this.worldData);
    controller.resetState(x, y);

    // --- WIZUALNY SPRITE AUTA ---
    const visualSprite = this.scene.add.sprite(x, y, "car_p1_sprite", 0)
      .setOrigin(0.5, 0.6)
      .setDepth(3)
      .setScale(0.9, 1.2);

    controller.visualSprite = visualSprite;

    return { controller, sprite };
  }

createAI({ x, y, texture = "car_p2", waypoints }) {
  const sprite = this.scene.physics.add.sprite(x, y, texture)
    .setOrigin(0.5)
    .setDepth(2)
    .setScale(1);

  sprite.body.allowRotation = false;
  sprite.setVisible(false);

  const controller = new AICar(this.scene, sprite, this.worldData, waypoints);

  // 1. TWORZYMY visualSprite
  const visualSprite = this.scene.add.sprite(x, y, "car_p2_sprite", 0)
    .setOrigin(0.5, 0.6)
    .setDepth(3)
    .setScale(0.9, 1.2);


  controller.visualSprite = visualSprite;

  // 2. RESET — TERAZ visualSprite istnieje, więc klatka startowa będzie poprawna
  controller.resetState(x, y, -Math.PI / 2);

  // 3. WYMUSZAMY PRZELICZENIE KLATKI STARTOWEJ
  controller.updateVisualSpriteFromAngle(0);


  return controller;
}

  linkOpponents(c1, c2) {
    if (!c1 || !c2) return;
    c1.opponentController = c2;
    c2.opponentController = c1;
  }
}