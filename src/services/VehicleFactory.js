// factories/VehicleFactory.js
import { PlayerCar, AICar } from "../domain/index.js";

export class VehicleFactory {
  constructor(scene, worldData) {
    this.scene = scene;
    this.worldData = worldData;
  }

  createPlayer({ x, y, texture = "car_p1" }) {
    // Fizyczny sprite auta (kolizje, dym itp.) – zachowujemy jak było
    const sprite = this.scene.physics.add.sprite(x, y, texture).setOrigin(0.5).setDepth(2).setScale(0.5);
    sprite.body.allowRotation = false;
    // sprite.setVisible(false); // Fizyka działa, grafika znika
    const controller = new PlayerCar(this.scene, sprite, this.worldData);
    controller.resetState(x, y);

    // Nakładka wizualna z kierunkami ze spritesheetu
    const visualSprite = this.scene.add.sprite(x, y, "car_p1_sprite", 0)
      .setOrigin(0.5, 0.5)
      .setDepth(3)
      .setScale(0.6, 0.8);
    controller.visualSprite = visualSprite;

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