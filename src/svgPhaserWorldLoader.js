// svgPhaserWorldLoader.js – nowoczesny loader świata SVG do Phasera
// Użycie: const worldData = await loadSVGPhaserWorld('assets/scene_1.svg', 4096, 256);

export async function loadSVGPhaserWorld(svgUrl, worldSize = 4096, tileSize = 256) {
  // Debug: log start
  // console.log('[SVG LOADER] Start ładowania i rasteryzacji SVG:', svgUrl);

  // 1. Pobierz SVG jako tekst
  const response = await fetch(svgUrl);
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  const svgText = await response.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, 'image/svg+xml');
  const svgElem = doc.documentElement;
  if (!svgElem || svgElem.tagName !== 'svg') throw new Error('Invalid SVG');

  // 2. Wyciągnij warstwy
  const roadGroup = svgElem.querySelector('#ROAD');
  const obstaclesGroup = svgElem.querySelector('#OBSTACLES');
  const startElem = svgElem.querySelector('#START');

  // 2a. Pobierz domyślną nawierzchnię z BACKGROUND_*
  let bgTexture = 'grass';
  const bgElem = svgElem.querySelector('[id^="BACKGROUND"]');
  if (bgElem) {
    const parts = bgElem.id.split('_');
    if (parts.length > 1) bgTexture = parts[1].toLowerCase();
    bgElem.parentNode.removeChild(bgElem);
    // console.log('[SVG LOADER] Usunięto BACKGROUND, domyślna nawierzchnia:', bgTexture);
  }
  // Usuń przezroczyste prostokąty i path z SVG, które NIE mają id
  [...svgElem.querySelectorAll('rect, path, polygon')].forEach(el => {
    const fill = el.getAttribute('fill');
    const fillOpacity = el.getAttribute('fill-opacity');
    const id = el.id || '';
    if (!id && (fill === 'none' || fillOpacity === '0')) {
      el.parentNode.removeChild(el);
      console.log('[SVG LOADER] Usunięto przezroczysty element bez id:', el);
    }
  });

  // 3. Załaduj wszystkie obrazy przed rasteryzacją
  const [bgImg, asphaltImg, cobblestoneImg] = await Promise.all([
    loadImage(`assets/images/${bgTexture}.jpg`).catch(() => null),
    loadImage('assets/images/asphalt.jpg').catch(() => null),
    loadImage('assets/images/cobblestone.jpg').catch(() => null)
  ]);
  const obstacleTextureCache = {};
  // console.log('[SVG LOADER] Załadowano tekstury:', { bgImg, asphaltImg, cobblestoneImg });

  // 4. Przygotuj canvas świata i kafle
  const numTiles = worldSize / tileSize;
  const scale = worldSize / 1024;
  const overlap = 1; // 1px overlap na szwy

  // 4a. Rasteryzuj cały świat na worldCanvas (do renderowania)
  const worldCanvas = document.createElement('canvas');
  worldCanvas.width = worldSize;
  worldCanvas.height = worldSize;
  const worldCtx = worldCanvas.getContext('2d');
  // Tło
  if (bgImg) {
    for (let x = 0; x < worldSize; x += tileSize) {
      for (let y = 0; y < worldSize; y += tileSize) {
        worldCtx.drawImage(bgImg, x, y, tileSize, tileSize);
      }
    }
  } else {
    worldCtx.fillStyle = '#3a5d2c';
    worldCtx.fillRect(0, 0, worldSize, worldSize);
  }
  // Drogi
  if (roadGroup) {
    const tracks = roadGroup.querySelectorAll('path');
    for (const track of tracks) {
      const d = track.getAttribute('d');
      if (!d) continue;
      const path2d = new Path2D(scaleSvgPath(d, scale));
      worldCtx.save();
      worldCtx.clip(path2d);
      if (track.id && track.id.includes('COBBLESTONE')) {
        if (cobblestoneImg) {
          const pattern = worldCtx.createPattern(cobblestoneImg, 'repeat');
          worldCtx.fillStyle = pattern;
          worldCtx.fillRect(0, 0, worldSize, worldSize);
        } else {
          worldCtx.fillStyle = '#888';
          worldCtx.fillRect(0, 0, worldSize, worldSize);
        }
      } else {
        if (asphaltImg) {
          const pattern = worldCtx.createPattern(asphaltImg, 'repeat');
          worldCtx.fillStyle = pattern;
          worldCtx.fillRect(0, 0, worldSize, worldSize);
        } else {
          worldCtx.fillStyle = '#222';
          worldCtx.fillRect(0, 0, worldSize, worldSize);
        }
      }
      worldCtx.restore();
    }
  }
  // Przeszkody (z teksturą, rasteryzacja po tile'ach)
  if (obstaclesGroup) {
    const obstacles = obstaclesGroup.querySelectorAll('path');
    for (const obs of obstacles) {
      const d = obs.getAttribute('d');
      if (!d) continue;
      const path2d = new Path2D(scaleSvgPath(d, scale));
      // Ustal nazwę tekstury na podstawie id przeszkody
      let texName = 'obstacle';
      if (obs.id) {
        const parts = obs.id.split('_');
        if (parts.length > 1) texName = parts[parts.length - 1].toLowerCase();
      }
      let texImg = obstacleTextureCache[texName];
      if (!texImg) {
        try {
          texImg = await loadImage(`assets/images/${texName}.jpg`);
          obstacleTextureCache[texName] = texImg;
        } catch {
          texImg = null;
        }
      }
      // Rasteryzuj przeszkodę w pętli po tile'ach
      for (let x = 0; x < worldSize; x += tileSize) {
        for (let y = 0; y < worldSize; y += tileSize) {
          worldCtx.save();
          worldCtx.beginPath();
          worldCtx.rect(x, y, tileSize, tileSize);
          worldCtx.clip();
          worldCtx.clip(path2d);
          if (texImg) {
            const pattern = worldCtx.createPattern(texImg, 'repeat');
            worldCtx.fillStyle = pattern;
            worldCtx.fillRect(x, y, tileSize, tileSize);
          } else {
            worldCtx.fillStyle = '#fff';
            worldCtx.fillRect(x, y, tileSize, tileSize);
          }
          worldCtx.restore();
        }
      }
    }
  }

  // 4b. Rasteryzuj SVG do collisionCanvas (np. 1024x1024) – mapa kolizji
  const collisionMapSize = 1024;
  const collisionCanvas = document.createElement('canvas');
  collisionCanvas.width = collisionMapSize;
  collisionCanvas.height = collisionMapSize;
  const collisionCtx = collisionCanvas.getContext('2d');
  // Rasteryzuj tło
  collisionCtx.fillStyle = '#3a5d2c';
  collisionCtx.fillRect(0, 0, collisionMapSize, collisionMapSize);
  // Rasteryzuj drogi
  if (roadGroup) {
    const tracks = roadGroup.querySelectorAll('path');
    for (const track of tracks) {
      const d = track.getAttribute('d');
      if (!d) continue;
      const path2d = new Path2D(scaleSvgPath(d, collisionMapSize / 1024));
      collisionCtx.save();
      collisionCtx.clip(path2d);
      if (track.id && track.id.includes('COBBLESTONE')) {
        collisionCtx.fillStyle = '#888';
      } else {
        collisionCtx.fillStyle = '#222';
      }
      collisionCtx.fillRect(0, 0, collisionMapSize, collisionMapSize);
      collisionCtx.restore();
    }
  }
  // Rasteryzuj przeszkody
  if (obstaclesGroup) {
    const obstacles = obstaclesGroup.querySelectorAll('path');
    for (const obs of obstacles) {
      const d = obs.getAttribute('d');
      if (!d) continue;
      const path2d = new Path2D(scaleSvgPath(d, collisionMapSize / 1024));
      collisionCtx.save();
      collisionCtx.clip(path2d);
      collisionCtx.fillStyle = '#fff';
      collisionCtx.fillRect(0, 0, collisionMapSize, collisionMapSize);
      collisionCtx.restore();
    }
  }
  // 4c. Generuj collisionTypeMap na podstawie kolorów
  const collisionTypeMap = new Array(collisionMapSize * collisionMapSize).fill('grass');
  const imgData = collisionCtx.getImageData(0, 0, collisionMapSize, collisionMapSize).data;
  for (let i = 0; i < imgData.length; i += 4) {
    const r = imgData[i], g = imgData[i+1], b = imgData[i+2];
    const idx = i / 4;
    if (r === 255 && g === 255 && b === 255) collisionTypeMap[idx] = 'obstacle';
    else if (r === 136 && g === 136 && b === 136) collisionTypeMap[idx] = 'cobblestone';
    else if (r === 34 && g === 34 && b === 34) collisionTypeMap[idx] = 'asphalt';
    else collisionTypeMap[idx] = 'grass';
  }
  // 4d. Podziel worldCanvas na kafle
  const tiles = [];
  for (let ty = 0; ty < numTiles; ty++) {
    for (let tx = 0; tx < numTiles; tx++) {
      const tileCanvas = document.createElement('canvas');
      tileCanvas.width = tileSize;
      tileCanvas.height = tileSize;
      tileCanvas.getContext('2d').drawImage(
        worldCanvas,
        tx * tileSize, ty * tileSize, tileSize, tileSize,
        0, 0, tileSize, tileSize
      );
      tiles.push({ x: tx * tileSize, y: ty * tileSize, canvas: tileCanvas, id: `tile_${tx}_${ty}` });
    }
  }
  console.log('[SVG LOADER] Utworzono kafle:', tiles.length);

  // 5. Pozycja startowa
  let startPos = { x: worldSize / 2, y: worldSize / 2 };
  if (startElem) {
    if (startElem.tagName === 'circle') {
      startPos.x = parseFloat(startElem.getAttribute('cx')) * scale;
      startPos.y = parseFloat(startElem.getAttribute('cy')) * scale;
    } else if (startElem.tagName === 'rect') {
      startPos.x = parseFloat(startElem.getAttribute('x')) * scale;
      startPos.y = parseFloat(startElem.getAttribute('y')) * scale;
    }
  }

  // 6. Obstacles jako polygony
  const obstaclePolys = [];
  if (obstaclesGroup) {
    obstaclesGroup.querySelectorAll('path').forEach(pathElem => {
      const d = pathElem.getAttribute('d');
      if (!d) return;
      // Przeskaluj punkty polygona
      const path = new Path2D(scaleSvgPath(d, scale));
      const len = pathElem.getTotalLength ? pathElem.getTotalLength() : 0;
      const points = [];
      const steps = Math.max(8, Math.floor(len * 0.25));
      for (let i = 0; i <= steps; ++i) {
        const l = len * i / steps;
        let pt;
        if (pathElem.getPointAtLength) {
          pt = pathElem.getPointAtLength(l);
        } else {
          pt = null;
        }
        if (pt) {
          points.push({ x: pt.x * scale, y: pt.y * scale });
        }
      }
      if (points.length > 2) obstaclePolys.push(points);
    });
  }

  // Funkcja do szybkiego sprawdzania typu powierzchni
  function getSurfaceTypeAt(x, y) {
    const ix = Math.floor(x * collisionMapSize / worldSize);
    const iy = Math.floor(y * collisionMapSize / worldSize);
    if (ix < 0 || iy < 0 || ix >= collisionMapSize || iy >= collisionMapSize) return 'grass';
    return collisionTypeMap[ix + iy * collisionMapSize];
  }

  return { tiles, collisionTypeMap, getSurfaceTypeAt, obstaclePolys, startPos };
}

// Pomocnicza: skalowanie ścieżki SVG (d) o podany mnożnik
function scaleSvgPath(d, scale) {
  return d.replace(/([0-9.]+(?:e[\-+]?[0-9]+)?)/gi, (m) => parseFloat(m) * scale);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
} 