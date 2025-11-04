export function drawButton(graphics, fill, alpha, stroke, width, height) {
  graphics.clear();
  const radius = Math.min(width, height) / 2;
  graphics.fillStyle(fill, alpha);
  graphics.lineStyle(3, stroke);
  graphics.fillCircle(0, 0, radius);
  graphics.strokeCircle(0, 0, radius);
}

export function drawShadow(graphics, offset, width, height, fill, alpha) {
  graphics.clear();
  const radius = Math.min(width, height) / 2;
  graphics.fillStyle(fill, alpha);
  graphics.lineStyle(0, 0x000000, 0);
  graphics.fillCircle(offset.x, offset.y, radius);
}
