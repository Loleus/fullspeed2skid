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
  const layoutGroup = svgElem.querySelector('#layout');

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
    }
  });

  // 3. Załaduj wszystkie obrazy przed rasteryzacją
  // Zbierz wszystkie surfaceType z ROAD
  let surfaceTypes = new Set(['asphalt']);
  if (roadGroup) {
    const tracks = roadGroup.querySelectorAll('path');
    for (const track of tracks) {
      if (track.id) {
        const match = track.id.match(/_([a-zA-Z0-9]+)$/);
        if (match) surfaceTypes.add(match[1].toLowerCase());
      }
    }
  }
  // Dodaj typ tła
  surfaceTypes.add(bgTexture);
  // Przygotuj mapę Promise'ów tekstur
  const texturePromises = {};
  for (const type of surfaceTypes) {
    texturePromises[type] = loadImage(`assets/images/${type}.jpg`).catch(() => null);
  }
  // Załaduj wszystkie tekstury
  const textureImgs = await Promise.all(Object.values(texturePromises));
  const textureMap = {};
  let i = 0;
  for (const type of Object.keys(texturePromises)) {
    textureMap[type] = textureImgs[i++];
  }
  // Tło
  const bgImg = textureMap[bgTexture] || null;
  // Przeszkody: przygotuj mapę Promise'ów na podstawie id przeszkód
  let obstacleTypes = new Set();
  let allObstacles = [];
  if (obstaclesGroup) {
    allObstacles = Array.from(obstaclesGroup.querySelectorAll('path, ellipse, circle, rect, polygon, polyline, line'));
    for (const obs of allObstacles) {
      let type = 'stone';
      if (obs.id) {
        const parts = obs.id.split('_');
        if (parts.length > 1) type = parts[parts.length - 1].toLowerCase();
      }
      obstacleTypes.add(type);
    }
  }
  const obstacleTexturePromises = {};
  for (const type of obstacleTypes) {
    obstacleTexturePromises[type] = loadImage(`assets/images/${type}.jpg`).catch(() => null);
  }
  const obstacleImgs = await Promise.all(Object.values(obstacleTexturePromises));
  const obstacleTextureCache = {};
  i = 0;
  for (const type of Object.keys(obstacleTexturePromises)) {
    obstacleTextureCache[type] = obstacleImgs[i++];
  }
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
      // Rozpoznaj typ nawierzchni po sufiksie id
      let surfaceType = 'asphalt';
      if (track.id) {
        const match = track.id.match(/_([a-zA-Z0-9]+)$/);
        if (match) surfaceType = match[1].toLowerCase();
      }
      let textureImg = textureMap[surfaceType] || textureMap['asphalt'];
      const path2d = new Path2D(scaleSvgPath(d, scale));
      worldCtx.save();
      worldCtx.clip(path2d);
      if (textureImg) {
        const pattern = worldCtx.createPattern(textureImg, 'repeat');
        worldCtx.fillStyle = pattern;
        worldCtx.fillRect(0, 0, worldSize, worldSize);
      } else {
        worldCtx.fillStyle = '#222';
        worldCtx.fillRect(0, 0, worldSize, worldSize);
      }
      worldCtx.restore();
    }
  }
  // Przeszkody (z teksturą, rasteryzacja po tile'ach)
  if (obstaclesGroup) {
    for (const obs of allObstacles) {
      let texName = 'stone';
      if (obs.id) {
        const parts = obs.id.split('_');
        if (parts.length > 1) texName = parts[parts.length - 1].toLowerCase();
      }
      let texImg = obstacleTextureCache[texName] || obstacleTextureCache['stone'];
      let path2d = svgElementToPath2D(obs, scale);
      if (!path2d) continue;
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
  // Rasteryzuj przeszkody do collisionCanvas
  if (obstaclesGroup) {
    for (const obs of allObstacles) {
      let path2d = svgElementToPath2D(obs, collisionMapSize / 1024);
      if (!path2d) continue;
      collisionCtx.save();
      collisionCtx.clip(path2d);
      collisionCtx.fillStyle = '#fff';
      collisionCtx.fillRect(0, 0, collisionMapSize, collisionMapSize);
      collisionCtx.restore();
    }
  }
  // 4c. Generuj surfaceAreaMap na podstawie id pathów (optymalizacja: rasteryzacja na canvasie i odczyt pikseli)
  const surfaceAreaMap = new Array(collisionMapSize * collisionMapSize).fill('grass');
  // Mapowanie typów powierzchni na unikalne kolory (R,G,B)
  const surfaceTypeColors = {
    asphalt: [0, 0, 0],
    cobblestone: [128, 128, 128],
    gravel: [180, 180, 0],
    grass: [0, 255, 0],
    water: [0, 0, 255],
    obstacle: [255, 255, 255],
  };
  // Odwrotna mapa kolorów na typ powierzchni
  const colorToSurfaceType = {};
  for (const [type, rgb] of Object.entries(surfaceTypeColors)) {
    colorToSurfaceType[rgb.join(',')] = type;
  }
// ...

// Rasteryzacja warstwy "layout"

if (layoutGroup) {
    const layoutElements = Array.from(layoutGroup.children);
    layoutElements.forEach((element) => {
      const path2d = svgElementToPath2D(element, scale);
      if (path2d) {
        const className = element.getAttribute('class');
        if (className) {
          const styleSheet = doc.querySelector('style');
          const rules = styleSheet.innerHTML.split('}');
          const rule = rules.find(rule => rule.includes(`.${className}`));
          if (rule) {
            const fillValue = rule.match(/fill:\s*([^;]+)/);
            if (fillValue) {
              worldCtx.fillStyle = fillValue[1];
            } else {
              worldCtx.fillStyle = 'black';
            }
          } else {
            worldCtx.fillStyle = 'black';
          }
        } else {
          worldCtx.fillStyle = 'black';
        }
        worldCtx.fill(path2d);
      }
    });
  }

// ...


  // Przygotuj canvas do rasteryzacji
  const surfCanvas = document.createElement('canvas');
  surfCanvas.width = collisionMapSize;
  surfCanvas.height = collisionMapSize;
  const surfCtx = surfCanvas.getContext('2d');
  // Najpierw tło
  surfCtx.fillStyle = 'rgb(' + surfaceTypeColors.grass.join(',') + ')';
  surfCtx.fillRect(0, 0, collisionMapSize, collisionMapSize);
  // Rasteryzuj każdy typ powierzchni
  if (roadGroup) {
    // Grupuj pathy po typie powierzchni
    const typeToPaths = {};
    const tracks = roadGroup.querySelectorAll('path');
    for (const track of tracks) {
      const d = track.getAttribute('d');
      if (!d) continue;
      let surfaceType = 'asphalt';
      if (track.id) {
        const match = track.id.match(/_([a-zA-Z0-9]+)$/);
        if (match) surfaceType = match[1].toLowerCase();
      }
      if (!typeToPaths[surfaceType]) typeToPaths[surfaceType] = [];
      typeToPaths[surfaceType].push(scaleSvgPath(d, collisionMapSize / 1024));
    }
    for (const [type, paths] of Object.entries(typeToPaths)) {
      surfCtx.save();
      surfCtx.beginPath();
      for (const d of paths) {
        const path2d = new Path2D(d);
        surfCtx.fillStyle = 'rgb(' + (surfaceTypeColors[type] || surfaceTypeColors.asphalt).join(',') + ')';
        surfCtx.fill(path2d);
      }
      surfCtx.restore();
    }
  }
  // Przeszkody (nadpisują wszystko)
  if (obstaclesGroup) {
    const allObs = Array.from(obstaclesGroup.querySelectorAll('path, ellipse, circle, rect, polygon, polyline, line'));
    for (const obs of allObs) {
      let path2d = svgElementToPath2D(obs, collisionMapSize / 1024);
      if (!path2d) continue;
      surfCtx.save();
      surfCtx.fillStyle = 'rgb(' + surfaceTypeColors.obstacle.join(',') + ')';
      surfCtx.fill(path2d);
      surfCtx.restore();
    }
  }
  // Odczytaj bufor pikseli i przypisz typ powierzchni
  const imgData = surfCtx.getImageData(0, 0, collisionMapSize, collisionMapSize).data;
  for (let y = 0; y < collisionMapSize; y++) {
    for (let x = 0; x < collisionMapSize; x++) {
      const idx = (x + y * collisionMapSize) * 4;
      const rgb = [imgData[idx], imgData[idx + 1], imgData[idx + 2]];
      const type = colorToSurfaceType[rgb.join(',')] || 'grass';
      surfaceAreaMap[x + y * collisionMapSize] = type;
    }
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

  // 5a. Checkpointy (ROAD -> CHECK, rect z id jako numer)
  const checkpoints = [];
  if (roadGroup) {
    const checkGroup = roadGroup.querySelector('#CHECK');
    if (checkGroup) {
      const rects = Array.from(checkGroup.querySelectorAll('rect'));
      for (const r of rects) {
        const idStr = (r.id || '').trim();
        const idNum = parseInt(idStr, 10);
        if (!Number.isFinite(idNum)) continue;
        const x = parseFloat(r.getAttribute('x')) * scale;
        const y = parseFloat(r.getAttribute('y')) * scale;
        const w = parseFloat(r.getAttribute('width')) * scale;
        const h = parseFloat(r.getAttribute('height')) * scale;
        checkpoints.push({ id: idNum, x, y, w, h });
      }
      checkpoints.sort((a, b) => a.id - b.id);
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

  // Domyślne parametry nawierzchni (możesz je potem edytować globalnie)
  const surfaceParams = {
    asphalt: { grip: 1.0 },
    cobblestone: { grip: 0.9 }, // przykładowa wartość
    gravel: { grip: 0.8 },
    grass: { grip: 0.6 },
    water: { grip: 0.3 },
  };

  // Funkcja do szybkiego sprawdzania typu powierzchni
  function getSurfaceTypeAt(x, y) {
    const ix = Math.floor(x * collisionMapSize / worldSize);
    const iy = Math.floor(y * collisionMapSize / worldSize);
    if (ix < 0 || iy < 0 || ix >= collisionMapSize || iy >= collisionMapSize) return 'grass';
    return surfaceAreaMap[ix + iy * collisionMapSize];
  }

  const drivePathElem = svgElem.querySelector('#drive');
  const waypoints = [];

  if (drivePathElem) {
    const d = drivePathElem.getAttribute('d');
    if (d) {
      const numberRegex = /[+\-]?(?:[0-9]*\.)?[0-9]+(?:[eE][+\-]?[0-9]+)?/g;
      const commands = d.match(/[MCLcml][^MCLcml]*/g);
      let currentX = 0;
      let currentY = 0;
      let lastCommandType = null;
      let lastControlX = null;
      let lastControlY = null;

      commands.forEach(cmd => {
        const type = cmd[0];
        const paramStr = cmd.substring(1).trim();
        const params = (paramStr.match(numberRegex) || []).map(Number);

        let reflectedControlX = currentX;
        let reflectedControlY = currentY;

        // Calculate reflected control point for 'S' and 's' commands
        if (lastCommandType === 'C' || lastCommandType === 'c' || lastCommandType === 'S' || lastCommandType === 's') {
          if (lastControlX !== null && lastControlY !== null) {
            reflectedControlX = currentX + (currentX - lastControlX);
            reflectedControlY = currentY + (currentY - lastControlY);
          }
        }

        switch (type) {
          case 'M': // Moveto (absolute)
            currentX = params[0];
            currentY = params[1];
            waypoints.push({ x: currentX * scale, y: currentY * scale });
            lastControlX = null;
            lastControlY = null;
            break;
          case 'm': // Moveto (relative)
            currentX += params[0];
            currentY += params[1];
            waypoints.push({
              x: Math.ceil(currentX * scale * 100) / 100,
              y: Math.ceil(currentY * scale * 100) / 100
            });
            lastControlX = null;
            lastControlY = null;
            break;
          case 'C': // Cubic Bézier curve (absolute)
            // C x1 y1 x2 y2 x y
            lastControlX = params[2]; // Second control point
            lastControlY = params[3];
            currentX = params[4]; // End point
            currentY = params[5];
            waypoints.push({
              x: Math.ceil(currentX * scale * 100) / 100,
              y: Math.ceil(currentY * scale * 100) / 100
            });
            break;
          case 'c': // Cubic Bézier curve (relative)
            // c dx1 dy1 dx2 dy2 dx dy
            lastControlX = currentX + params[2]; // Second control point (relative to currentX)
            lastControlY = currentY + params[3]; // Second control point (relative to currentY)
            currentX += params[4]; // End point (relative)
            currentY += params[5];
            waypoints.push({
              x: Math.ceil(currentX * scale * 100) / 100,
              y: Math.ceil(currentY * scale * 100) / 100
            });
            break;
          case 'S': // Shorthand smooth cubic Bezier (absolute)
            // S x2 y2 x y
            // The first control point is the reflection of the second control point of the previous command.
            lastControlX = params[0]; // Second control point
            lastControlY = params[1];
            currentX = params[2]; // End point
            currentY = params[3];
            waypoints.push({
              x: Math.ceil(currentX * scale * 100) / 100,
              y: Math.ceil(currentY * scale * 100) / 100
            });
            break;
          case 's': // Shorthand smooth cubic Bezier (relative)
            // s dx2 dy2 dx dy
            // The first control point is the reflection of the second control point of the previous command.
            lastControlX = currentX + params[0]; // Second control point (relative)
            lastControlY = currentY + params[1]; // Second control point (relative)
            currentX += params[2]; // End point (relative)
            currentY += params[3];
            waypoints.push({
              x: Math.ceil(currentX * scale * 100) / 100,
              y: Math.ceil(currentY * scale * 100) / 100
            });
            break;
          case 'L': // Lineto (absolute)
            currentX = params[0];
            currentY = params[1];
            waypoints.push({
              x: Math.ceil(currentX * scale * 100) / 100,
              y: Math.ceil(currentY * scale * 100) / 100
            });
            lastControlX = null; // Reset control point for non-Bezier commands
            lastControlY = null;
            break;
          case 'l': // Lineto (relative)
            currentX += params[0];
            currentY += params[1];
            waypoints.push({
              x: Math.ceil(currentX * scale * 100) / 100,
              y: Math.ceil(currentY * scale * 100) / 100
            });
            lastControlX = null;
            lastControlY = null;
            break;
          case 'H': // Horizontal lineto (absolute)
            currentX = params[0];
            waypoints.push({
              x: Math.ceil(currentX * scale * 100) / 100,
              y: Math.ceil(currentY * scale * 100) / 100
            });
            lastControlX = null;
            lastControlY = null;
            break;
          case 'h': // Horizontal lineto (relative)
            currentX += params[0];
            waypoints.push({
              x: Math.ceil(currentX * scale * 100) / 100,
              y: Math.ceil(currentY * scale * 100) / 100
            });
            lastControlX = null;
            lastControlY = null;
            break;
          case 'V': // Vertical lineto (absolute)
            currentY = params[0];
            waypoints.push({
              x: Math.ceil(currentX * scale * 100) / 100,
              y: Math.ceil(currentY * scale * 100) / 100
            });
            lastControlX = null;
            lastControlY = null;
            break;
          case 'v': // Vertical lineto (relative)
            currentY += params[0];
            waypoints.push({
              x: Math.ceil(currentX * scale * 100) / 100,
              y: Math.ceil(currentY * scale * 100) / 100
            });
            lastControlX = null;
            lastControlY = null;
            break;
          case 'Z': // Close path
          case 'z':
            // Z/z closes the path to the starting point of the current subpath.
            // For waypoints, we might not need to add a point here if the path naturally leads back.
            // For simplicity, we'll just reset control points and not add a waypoint.
            lastControlX = null;
            lastControlY = null;
            break;
          default:
            console.warn('Unhandled SVG path command:', type, params);
            lastControlX = null;
            lastControlY = null;
            break;
        }
        lastCommandType = type; // Update last command type for 'S' and 's'
      });
    }
    console.log(waypoints);
  }

  return { tiles, getSurfaceTypeAt, obstaclePolys, startPos, surfaceParams, worldSize, waypoints, checkpoints };
}

// ===================== MINIMAPA: generowanie tekstury z SVG =====================
/**
 * Tworzy minimapę na podstawie SVG i rejestruje ją jako teksturę Phaser.
 * @param {Phaser.Scene} scene - scena Phaser, do której dodajemy teksturę
 * @param {string} svgUrl - ścieżka do pliku SVG
 * @param {number} outputSize - rozmiar minimapy (domyślnie 128)
 * @returns {Promise<string>} - klucz tekstury Phaser
 */
export function createMinimapTextureFromSVG(scene, svgUrl, outputSize = 128) {
  return createMinimapFromSVG(svgUrl, outputSize).then(canvas => {
    const key = 'minimap-' + Date.now();
    scene.textures.addCanvas(key, canvas);
    return key;
  });
}

// Pomocnicza funkcja do generowania minimapy na canvasie (przeniesiona ze starej wersji)
function createMinimapFromSVG(svgUrl, outputSize = 128) {
  return new Promise((resolve, reject) => {
    fetch(svgUrl)
      .then(response => {
        if (!response.ok) throw new Error(`Failed to load SVG: ${response.status}`);
        return response.text();
      })
      .then(svgText => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgText, 'image/svg+xml');
        const roadGroup = doc.querySelector('#ROAD');
        if (!roadGroup) throw new Error('ROAD group not found in SVG');
        const trackPaths = Array.from(roadGroup.querySelectorAll('path')).filter(pathElem => pathElem.id && pathElem.id.startsWith('TRACK_'));
        if (!trackPaths.length) throw new Error('No TRACK_ path in ROAD group in SVG');

        const canvas = document.createElement('canvas');
        canvas.width = outputSize;
        canvas.height = outputSize;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'rgba(128, 128, 128, 0.5)';
        ctx.fillRect(0, 0, outputSize, outputSize);


        let pathsSVG = '';
        trackPaths.forEach(pathElem => {
          pathsSVG += `<path d="${pathElem.getAttribute('d')}" fill="#111" stroke="none"/>`;
        });
        const scaledSVG = `
          <svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
            ${pathsSVG}
          </svg>
        `;
        const svgBlob = new Blob([scaledSVG], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(svgBlob);
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0, outputSize, outputSize);
          URL.revokeObjectURL(url);
          resolve(canvas);
        };
        img.onerror = (e) => {
          reject('Minimap image load error');
        };
        img.src = url;
      })
      .catch(error => {
        const fallback = document.createElement('canvas');
        fallback.width = fallback.height = 128;
        const ctx = fallback.getContext('2d');
        ctx.fillStyle = 'rgba(231, 231, 231, 1)';
        ctx.fillRect(0, 0, 128, 128);
        ctx.strokeStyle = 'rgba(100, 100, 100, 1)';
        ctx.strokeRect(0, 0, 128, 128);
        resolve(fallback);
      });
  });
}
// ===================== /MINIMAPA =====================

// Pomocnicza: skalowanie ścieżki SVG (d) o podany mnożnik
function scaleSvgPath(d, scale) {
  return d.replace(/([0-9.]+(?:e[\-+]?[0-9]+)?)/gi, (m) => parseFloat(m) * scale);
}

// Pomocnicza: zamiana dowolnego elementu SVG na Path2D (obsługuje path, ellipse, circle, rect, polygon, polyline, line)
function svgElementToPath2D(elem, scale) {
  let path2d = null;
  if (elem.tagName === 'path') {
    const d = elem.getAttribute('d');
    if (!d) return null;
    path2d = new Path2D(scaleSvgPath(d, scale));
  } else if (elem.tagName === 'ellipse') {
    const cx = parseFloat(elem.getAttribute('cx')) * scale;
    const cy = parseFloat(elem.getAttribute('cy')) * scale;
    const rx = parseFloat(elem.getAttribute('rx')) * scale;
    const ry = parseFloat(elem.getAttribute('ry')) * scale;
    path2d = new Path2D();
    path2d.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
  } else if (elem.tagName === 'circle') {
    const cx = parseFloat(elem.getAttribute('cx')) * scale;
    const cy = parseFloat(elem.getAttribute('cy')) * scale;
    const r = parseFloat(elem.getAttribute('r')) * scale;
    path2d = new Path2D();
    path2d.arc(cx, cy, r, 0, 2 * Math.PI);
  } else if (elem.tagName === 'rect') {
    const x = parseFloat(elem.getAttribute('x')) * scale;
    const y = parseFloat(elem.getAttribute('y')) * scale;
    const w = parseFloat(elem.getAttribute('width')) * scale;
    const h = parseFloat(elem.getAttribute('height')) * scale;
    path2d = new Path2D();
    path2d.rect(x, y, w, h);
  } else if (elem.tagName === 'polygon' || elem.tagName === 'polyline') {
    const points = (elem.getAttribute('points') || '').trim().split(/\s+/).map(pt => pt.split(',').map(Number));
    if (points.length > 1) {
      path2d = new Path2D();
      path2d.moveTo(points[0][0] * scale, points[0][1] * scale);
      for (let j = 1; j < points.length; j++) {
        path2d.lineTo(points[j][0] * scale, points[j][1] * scale);
      }
      if (elem.tagName === 'polygon') path2d.closePath();
    }
  } else if (elem.tagName === 'line') {
    const x1 = parseFloat(elem.getAttribute('x1')) * scale;
    const y1 = parseFloat(elem.getAttribute('y1')) * scale;
    const x2 = parseFloat(elem.getAttribute('x2')) * scale;
    const y2 = parseFloat(elem.getAttribute('y2')) * scale;
    path2d = new Path2D();
    path2d.moveTo(x1, y1);
    path2d.lineTo(x2, y2);
  }
  return path2d;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
} 