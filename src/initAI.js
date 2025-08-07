const aiSprite = this.add.sprite(startX, startY, 'carTexture');
const aiCar = new AICar(this, aiSprite, worldData, waypoints);
aiCar.resetState(startX, startY);

// W update:
aiCar.updateAI(dt, worldWidth, worldHeight);
