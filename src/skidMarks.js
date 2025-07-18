export class SkidMarks {
  constructor({ enabled = true, wheelWidth = 12 } = {}) {
    this.enabled = enabled;
    this.wheelWidth = wheelWidth;
    this.lastWheelPos = [null, null, null, null];
  }
  clear() {
    this.lastWheelPos = [null, null, null, null];
  }
  resetWheel(i) {
    this.lastWheelPos[i] = null;
  }
  update(i, curr, slip, steerAngle, tilePool, tileSize) {
    if (slip > 0.1 && Math.abs(steerAngle) > 0.05) {
      const prev = this.lastWheelPos[i];
      if (prev) {
        const dx = curr.x - prev.x;
        const dy = curr.y - prev.y;
        if (dx*dx + dy*dy < 900) { // max 30px odcinek
          const tileX = Math.floor(prev.x / tileSize);
          const tileY = Math.floor(prev.y / tileSize);
          const tileId = `tile_${tileX}_${tileY}`;
          const tileObj = tilePool.get(tileId);
          if (tileObj && tileObj.texture && tileObj.texture.getSourceImage) {
            const ctx = tileObj.texture.getSourceImage().getContext('2d');
            ctx.save();
            ctx.strokeStyle = 'black';
            ctx.globalAlpha = 0.18;
            ctx.lineWidth = Math.max(1, this.wheelWidth - 5);
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(prev.x - tileX * tileSize, prev.y - tileY * tileSize);
            ctx.lineTo(curr.x - tileX * tileSize, curr.y - tileY * tileSize);
            ctx.stroke();
            ctx.restore();
            tileObj.texture.refresh();
          }
        }
      }
      this.lastWheelPos[i] = curr;
    } else {
      this.resetWheel(i);
    }
  }
} 