export function createBackground(scene) {
  const { width, height } = scene.sys.game.canvas;

  if (scene.textures.exists('bgc')) {
    const bg = scene.add.image(0, 0, 'bgc').setOrigin(0, 0);
    bg.setDisplaySize(width, height);
    bg.setScrollFactor(0);
    bg.setDepth(-1000);
  } else if (scene.textures.exists('tile')) {
    const ts = scene.add.tileSprite(0, 0, width, height, 'tile').setOrigin(0, 0);
    ts.setScrollFactor(0);
    ts.setDepth(-1000);
  } else {
    console.warn('[backgroundUtils] Brak tekstury bgc i tile, nie dodano tła');
  }
}

export function createGradientOverlay(scene, gradientState) {
  const { width, height } = scene.sys.game.canvas;

  if (scene.textures.exists('gradientOverlay')) {
    scene.textures.remove('gradientOverlay');
  }

  const gradientCanvas = scene.textures.createCanvas('gradientOverlay', width, height);
  const ctx = gradientCanvas.getContext();
  updateGradient(ctx, width, height, gradientState);
  gradientCanvas.refresh();

  const overlayImage = scene.add.image(0, 0, 'gradientOverlay').setOrigin(0, 0).setAlpha(1);
  overlayImage.setDepth(0);

  return gradientCanvas;
}
export function updateGradient(ctx, width, height, gradientState) {
  ctx.clearRect(0, 0, width, height);

  // Gradient poziomy
  const horizontal = ctx.createLinearGradient(0, 0, width, 0);
  horizontal.addColorStop(0, 'rgb(0, 0, 0)');
  horizontal.addColorStop(gradientState.stop1, 'rgba(255, 255, 255, 0)');
  horizontal.addColorStop(gradientState.stop2, 'rgba(0, 0, 0, 0)');
  horizontal.addColorStop(1, 'rgba(0, 0, 0, 1)');

  ctx.fillStyle = horizontal;
  ctx.fillRect(0, 0, width, height);

  // Gradient pionowy
  const vertical = ctx.createLinearGradient(0, 0, 0, height);
  vertical.addColorStop(0, 'rgb(0, 0, 0)');
  vertical.addColorStop(gradientState.stop1, 'rgba(255, 255, 255, 0)');
  vertical.addColorStop(gradientState.stop2, 'rgba(0, 0, 0, 0)');
  vertical.addColorStop(1, 'rgba(0, 0, 0, 1)');

  // Mnożenie gradientów = efekt prostokątny
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = vertical;
  ctx.fillRect(0, 0, width, height);

  // Przywrócenie normalnego trybu
  ctx.globalCompositeOperation = 'source-over';
}


export function destroyBackgroundAssets(scene) {
  if (scene.textures.exists('gradientOverlay')) {
    scene.textures.remove('gradientOverlay');
  }
}