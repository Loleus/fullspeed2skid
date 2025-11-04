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
  const g = ctx.createLinearGradient(0, 0, 0, height);
  g.addColorStop(0, 'rgba(255, 255, 255, 1)');
  g.addColorStop(gradientState.stop1, 'rgba(255, 255, 255, 0)');
  g.addColorStop(gradientState.stop2, 'rgba(0, 0, 0, 0)');
  g.addColorStop(1, 'rgba(0, 0, 0, 1)');
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
}

export function destroyBackgroundAssets(scene) {
  if (scene.textures.exists('gradientOverlay')) {
    scene.textures.remove('gradientOverlay');
  }
}