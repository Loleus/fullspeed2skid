export class SkidMarks {
  constructor({ enabled = true, wheelWidth = 12 } = {}) {
    this.enabled = enabled;
    this.wheelWidth = wheelWidth;
    this.lastWheelPos = [null, null, null, null];
    // Dodajemy tablicę do śledzenia czasu rozpoczęcia 'palenia gumy' dla tylnych kół
    this.burnoutStartTime = [null, null, null, null];
    this.burnoutDrawing = [false, false, false, false];
    this._lastLog = [{}, {}, {}, {}, {}]; // Dodajemy tablicę do śledzenia czasu ostatnich logów
  }
  clear() {
    this.lastWheelPos = [null, null, null, null];
  }
  resetWheel(i) {
    this.lastWheelPos[i] = null;
  }
  update(i, curr, slip, steerAngle, tilePool, tileSize, localSpeed, grip = 1, mass = 1200, throttle = 0, maxSpeed = 700) {
    // --- ORYGINALNA LOGIKA POŚLIZGÓW BOCZNYCH (NIE ZMIENIAM!) ---
    if (slip > 0.3 && Math.abs(steerAngle) > 0.1) {
      const prev = this.lastWheelPos[i];
      if (prev) {
        const dx = curr.x - prev.x;
        const dy = curr.y - prev.y;

        if (dx * dx + dy * dy < 900) { // max 30px odcinek
          const drawSegment = (p1, p2, tileX, tileY) => {
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
              ctx.moveTo(p1.x - tileX * tileSize, p1.y - tileY * tileSize);
              ctx.lineTo(p2.x - tileX * tileSize, p2.y - tileY * tileSize);
              ctx.stroke();
              ctx.restore();
              tileObj.texture.refresh();
            }
          };

          const prevTileX = Math.floor(prev.x / tileSize);
          const prevTileY = Math.floor(prev.y / tileSize);
          const currTileX = Math.floor(curr.x / tileSize);
          const currTileY = Math.floor(curr.y / tileSize);

          if (prevTileX === currTileX && prevTileY === currTileY) {
            // Segment w całości na jednym kafelku
            drawSegment(prev, curr, prevTileX, prevTileY);
          } else {
            // Segment przecina granicę - dzielimy go na dwa
            let t = 1.0;
            // Sprawdź przecięcie z pionową granicą
            if (currTileX > prevTileX && dx !== 0) {
              t = Math.min(t, ((prevTileX + 1) * tileSize - prev.x) / dx);
            } else if (currTileX < prevTileX && dx !== 0) {
              t = Math.min(t, (prevTileX * tileSize - prev.x) / dx);
            }
            // Sprawdź przecięcie z poziomą granicą
            if (currTileY > prevTileY && dy !== 0) {
              t = Math.min(t, ((prevTileY + 1) * tileSize - prev.y) / dy);
            } else if (currTileY < prevTileY && dy !== 0) {
              t = Math.min(t, (prevTileY * tileSize - prev.y) / dy);
            }
            
            t = Phaser.Math.Clamp(t, 0.0, 1.0);

            const intersectionPoint = {
              x: prev.x + t * dx,
              y: prev.y + t * dy,
            };

            // Rysuj pierwszą część
            drawSegment(prev, intersectionPoint, prevTileX, prevTileY);
            // Rysuj drugą część
            drawSegment(intersectionPoint, curr, currTileX, currTileY);
          }
        }
      }
      this.lastWheelPos[i] = curr;
    } else {
      // Resetuj tylko dla kół innych niż 0 i 2 (tylne), a dla 0 i 2 resetuj tylko jeśli nie trwa burnout
      if ((i === 0 || i === 2)) {
        if (!this.burnoutDrawing[i]) {
          this.resetWheel(i);
        }
      } else {
        this.resetWheel(i);
      }
    }

    // --- LOGIKA 'PALENIA GUMY' (TYLKO TYLNE KOŁA: 0 i 2) ---
    if ((i === 0 || i === 2)) {
      // Palenie gumy tylko gdy gaz wciśnięty i prędkość do połowy maxSpeed
      if (throttle > 0 && localSpeed >= 0 && localSpeed <= 0.5 * maxSpeed) {
        if (this.burnoutStartTime[i] === null) {
          this.burnoutStartTime[i] = performance.now();
          this.lastWheelPos[i] = curr; // Ustaw prev na curr, by ślad był rysowany od razu
        }
        // Sprawdź, czy minęło 0.1s od wejścia w zakres
        if (!this.burnoutDrawing[i] && performance.now() - this.burnoutStartTime[i] >= 100) {
          this.burnoutDrawing[i] = true;
        }
        // Rysuj ślad jeśli minęło 0.1s
        if (this.burnoutDrawing[i]) {
          const prev = this.lastWheelPos[i];
          if (prev) {
            const dx = curr.x - prev.x;
            const dy = curr.y - prev.y;
            const maxLen = 60 * (1 / grip) * (1200 / mass);
            if (dx*dx + dy*dy < maxLen*maxLen) {
              const tileX = Math.floor(prev.x / tileSize);
              const tileY = Math.floor(prev.y / tileSize);
              const tileId = `tile_${tileX}_${tileY}`;
              const tileObj = tilePool.get(tileId);
              if (tileObj && tileObj.texture && tileObj.texture.getSourceImage) {
                const ctx = tileObj.texture.getSourceImage().getContext('2d');
                ctx.save();
                // Kolor jak w bocznych śladach:
                ctx.strokeStyle = '#222';
                const minAlpha = 0.08, maxAlpha = 0.22;
                const alpha = maxAlpha - (localSpeed / (0.5 * maxSpeed)) * (maxAlpha - minAlpha);
                ctx.globalAlpha = alpha;
                ctx.lineWidth = Math.max(1, this.wheelWidth - 6);
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
          // Wymuszam zawsze aktualizację prev na curr
          this.lastWheelPos[i] = curr;
        }
      } else {
        this.burnoutStartTime[i] = null;
        this.burnoutDrawing[i] = false;
      }
    }
  }
} 