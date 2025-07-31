export function preloadWorldTextures(scene, tiles, tileSize) {
  for (const tile of tiles) {
    if (scene.textures.exists(tile.id)) {
      scene.textures.remove(tile.id);
    }
  }

  for (const tile of tiles) {
    const canvas = document.createElement("canvas");
    canvas.width = tileSize;
    canvas.height = tileSize;
    canvas.getContext("2d").drawImage(tile.canvas, 0, 0, tileSize, tileSize, 0, 0, tileSize, tileSize);
    scene.textures.addCanvas(tile.id, canvas);
  }
}
