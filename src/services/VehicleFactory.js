// factories/VehicleFactory.js
import { PlayerCar, AICar } from "../domain/index.js";

export class VehicleFactory {
  constructor(scene, worldData) {
    this.scene = scene;
    this.worldData = worldData;
  }

  createPlayer({ x, y, texture = "car_p1" }) {
    const sprite = this.scene.physics.add.sprite(x, y, texture).setOrigin(0.5).setDepth(2);
    sprite.body.allowRotation = false;
    const controller = new PlayerCar(this.scene, sprite, this.worldData);
    controller.resetState(x, y);
    return { controller, sprite};
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