import { Car } from './car.js';

export class PlayerCar extends Car {
  constructor(scene, carSprite, worldData, playerIndex = 1) {
    super(scene, carSprite, worldData);
    this.isAI = false;
    this.isPlayer = true;
    this.playerIndex = playerIndex; // 1 lub 2
  }
}


