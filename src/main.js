// main.js
import { loadSVGPhaserWorld, createMinimapTextureFromSVG } from './svgPhaserWorldLoader.js';
import { FPVCamera } from './fpvCamera.js';

const tileSize  = 256;
const worldW    = 6144;
const worldH    = 6144;
const viewW     = 1280;
const viewH     = 720;

//   PARAMETRY AUTA

let CAR_WIDTH = 60;
let CAR_HEIGHT = 112;
let wheelBase = 104; // rozstaw osi (px)
let carMass = 1200; // masa auta w kg
let carDragCoefficient = 0.32; // współczynnik oporu aerodynamicznego (Cx)
let carFrontalArea = 2.2; // powierzchnia czołowa auta w m^2
let airDensity = 1.225; // gęstość powietrza (kg/m^3)
let rollingResistance = 5; // współczynnik oporu toczenia

//   PARAMETRY JAZDY

let MAX_STEER_DEG   = 21; // maksymalny kąt skrętu kół (stopnie)
let STEER_SPEED_DEG = 44; // szybkość skręcania kół (stopnie/sek)
let STEER_RETURN_SPEED_DEG = 120; // szybkość powrotu kół do zera (stopnie/sek)
let accel           = 1000; // przyspieszenie
let maxSpeed        = 800; // maksymalna prędkość

//   PARAMETRY DRIFTU / POŚLIZGU

let slipBase = 700; // bazowa siła poślizgu
let SLIP_START_SPEED = 0.6 * maxSpeed; // próg prędkości, od której zaczyna się poślizg
let SLIP_STEER_THRESHOLD_RATIO = 0.3; // próg skrętu (procent maxSteer)
let sideFrictionMultiplier = 3; // SIŁA tłumienia bocznego driftu (im większa, tym szybciej znika poślizg)
let obstacleBounce = 0.25; // SIŁA odbicia od przeszkody/ściany (0 = brak odbicia, 1 = pełne odbicie)
const terrainGripMultiplier = { 'asphalt': 1.0, 'grass': 0.85, 'gravel': 0.6, 'water': 0.2 };


let maxSteer   = Phaser.Math.DegToRad(MAX_STEER_DEG);
let steerSpeed = Phaser.Math.DegToRad(STEER_SPEED_DEG);
let steerReturnSpeed = Phaser.Math.DegToRad(STEER_RETURN_SPEED_DEG);
// --- KONIEC PARAMETRÓW AUTA ---

let car, cursors;
// --- NOWE ZMIENNE DLA MODELU DYNAMICZNEGO ---
let v_x = 0; // prędkość wzdłuż auta (przód/tył)
let v_y = 0; // prędkość boczna (drift)
let carAngle = 0; // orientacja auta (car.rotation)
let carX, carY; // pozycja auta

let trackTiles = [];
let fpsText;
let carWidth = CAR_WIDTH, carHeight = CAR_HEIGHT;
let worldData = null;
let carCollisionRadius = 0.36 * Math.sqrt(CAR_WIDTH * CAR_WIDTH + CAR_HEIGHT * CAR_HEIGHT);
let steerInput = 0; // wygładzony sygnał sterowania

// ===================== MINIMAPA: flaga włączająca minimapę =====================
let minimapa = true; // Ustaw na false, by wyłączyć minimapę
// ===================== /MINIMAPA =====================

// ===================== MINIMAPA: zmienne globalne =====================
let minimapKey = null;
let minimapImage = null;
let minimapOverlay = null;
const minimapSize = 128;
const minimapMargin = 10;
const minimapWorldSize = 1024; // Rozmiar świata SVG dla minimapy (dostosuj jeśli inny!)
// ===================== /MINIMAPA =====================

// --- EKRAN ŁADOWANIA ---
let loadingOverlay, loadingCircle, loadingText;
let loadingProgress = 0;
let loadingFadeOut = false;
// --- ZMIENNA DO OBSŁUGI UKRYWANIA LOADERA ---
let loaderShouldHide = false;

function showLoadingOverlay() {
  // Tworzymy overlay na body (poza Phaserem, bo assety jeszcze się nie wgrały)
  loadingOverlay = document.createElement('div');
  loadingOverlay.className = 'loading-overlay';

  // Koło
  loadingCircle = document.createElement('div');
  loadingCircle.className = 'loading-circle';

  // Tekst procentowy
  loadingText = document.createElement('div');
  loadingText.className = 'loading-text';
  loadingText.innerText = '0%';

  loadingCircle.appendChild(loadingText);
  loadingOverlay.appendChild(loadingCircle);
  document.body.appendChild(loadingOverlay);
}

function setLoadingProgress(percent) {
  loadingProgress = percent;
  if (loadingText) loadingText.innerText = percent + '%';
  if (percent >= 100 && !loadingFadeOut) {
    loadingFadeOut = true;
    loadingOverlay.style.opacity = '0';
    setTimeout(() => {
      if (loadingOverlay && loadingOverlay.parentNode) loadingOverlay.parentNode.removeChild(loadingOverlay);
    }, 300);
  }
}

showLoadingOverlay();

const config = {
  type: Phaser.AUTO,
  width: viewW,
  height: viewH,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: viewW,
    height: viewH
  },
  physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false }},
  scene: { preload, create, update }
};

async function startGame() {
  // --- ŁADOWANIE Z POSTĘPEM ---
  let svgPromise = loadSVGPhaserWorld('assets/levels/scene_1.svg', worldH, 256);
  let fakeProgress = 0;
  // Symulacja postępu (możesz podpiąć pod realne ładowanie assetów, jeśli masz callbacki)
  let progressInterval = setInterval(() => {
    if (fakeProgress < 90) {
      fakeProgress++;
      setLoadingProgress(fakeProgress);
    }
  }, 8);
  worldData = await svgPromise;
  setLoadingProgress(95);
  clearInterval(progressInterval);
  new Phaser.Game(config);
}

startGame();

function preload() {
  for (const tile of worldData.tiles) {
    const cropped = document.createElement('canvas');
    cropped.width = tileSize;
    cropped.height = tileSize;
    cropped.getContext('2d').drawImage(tile.canvas, 0, 0, tileSize, tileSize, 0, 0, tileSize, tileSize);
    this.textures.addCanvas(tile.id, cropped);
  }
  this.load.image('car', 'assets/images/car.png');
}

async function create() {
  console.log('[DEBUG] Phaser create startuje');
  console.log('[DEBUG] minimapa:', minimapa);
  const start = worldData.startPos;
  // Przesunięcie startu auta w dół świata, by auto było 1/5 od dołu ekranu
  const startYOffset = viewH * 3/10; // np. 3/10 wysokości ekranu (możesz zmienić)
  car = this.physics.add.sprite(start.x, start.y + startYOffset, 'car');
  car.setOrigin(0.5).setDepth(2);
  car.body.allowRotation = false;
  car.setDisplaySize(CAR_WIDTH, CAR_HEIGHT);
  carWidth = CAR_WIDTH;
  carHeight = CAR_HEIGHT;
  this.cameras.main.setBounds(0, 0, worldW, worldH);
  this.cameras.main.startFollow(car, true, 0.27, 0.27);
  this.cameras.main.centerOn(car.x, car.y);
  cursors = this.input.keyboard.createCursorKeys();
  // Dodaj obsługę klawisza V do przełączania FPV
  vKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.V);
  fpvCamera = new FPVCamera(this, car);
  fpsText = this.add.text(10, 10, 'FPS: 0', {
    font: '20px monospace',
    fill: '#fff',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: { left: 8, right: 8, top: 4, bottom: 4 },
  }).setScrollFactor(0).setDepth(100);
  resetCarState(start);
  setTimeout(() => {
    setLoadingProgress(100);
  }, 0);

  // ===================== MINIMAPA: inicjalizacja =====================
  if (minimapa) {
    createMinimapTextureFromSVG(this, 'assets/levels/scene_1.svg', minimapSize).then(key => {
      minimapKey = key;
      // Przesunięcie minimapy pod licznik FPS (np. 50px od góry)
      const minimapOffsetX = minimapMargin;
      const minimapOffsetY = minimapMargin + 50;
      minimapImage = this.add.image(minimapOffsetX + minimapSize/2, minimapOffsetY + minimapSize/2, minimapKey)
        .setScrollFactor(0)
        .setDepth(100);
      minimapOverlay = this.add.graphics().setScrollFactor(0).setDepth(101);
    });
  }
  // ===================== /MINIMAPA =====================
}

function resetCarState(start) {
  const startYOffset = viewH * 3/10; // ten sam offset co wyżej
  carX = start.x;
  carY = start.y + startYOffset;
  carAngle = -Math.PI / 2; // Przód auta do góry ekranu (oś Y)
  v_x = 0;
  v_y = 0;
}

function getCarCorners(x, y, rot, width, height) {
  const hw = width / 2, hh = height / 2;
  const corners = [
    { x: -hw, y: -hh },
    { x: hw,  y: -hh },
    { x: hw,  y: hh },
    { x: -hw, y: hh }
  ];
  return corners.map(c => ({
    x: x + c.x * Math.cos(rot) - c.y * Math.sin(rot),
    y: y + c.x * Math.sin(rot) + c.y * Math.cos(rot)
  }));
}

// --- NOWA FUNKCJA: czysty update ruchu auta ---
function updateCarPhysics(dt, steerInput, throttle, params, surface) {
  // params: {maxSteer, steerSpeed, steerReturnSpeed, accel, maxSpeed, dragCoef, wheelBase, grip, inertiaTimer}
  // --- Sterowanie skrętem ---
  let steerAngle = car.steerAngle || 0;
  if (Math.abs(steerInput) > 0.01) {
    steerAngle += steerInput * params.steerSpeed * dt;
    steerAngle = Phaser.Math.Clamp(steerAngle, -params.maxSteer, params.maxSteer);
  } else if (steerAngle !== 0) {
    let speedAbs = Math.abs(v_x);
    if (speedAbs > 1) {
      let factor = speedAbs / params.maxSpeed;
      let steerReturn = params.steerReturnSpeed * factor;
      if (steerAngle > 0) {
        steerAngle -= steerReturn * dt;
        if (steerAngle < 0) steerAngle = 0;
      } else {
        steerAngle += steerReturn * dt;
        if (steerAngle > 0) steerAngle = 0;
      }
    }
  }
  car.steerAngle = steerAngle;

  // --- Przyspieszenie i opory ---
  let grip = params.grip;
  let force = throttle * params.accel * grip;
  v_x += force * dt;
  v_x = Phaser.Math.Clamp(v_x, -params.maxSpeed, params.maxSpeed);

  // --- Model poślizgu: siła boczna (drift) ---
  const SLIP_STEER_THRESHOLD = SLIP_STEER_THRESHOLD_RATIO * params.maxSteer;
  let steerAbs = Math.abs(steerAngle);
  let speedAbs = Math.abs(v_x);
  if (
    speedAbs > SLIP_START_SPEED &&
    steerAbs > SLIP_STEER_THRESHOLD
  ) {
    let slipSteerRatio = (steerAbs - SLIP_STEER_THRESHOLD) / (params.maxSteer - SLIP_STEER_THRESHOLD);
    slipSteerRatio = Phaser.Math.Clamp(slipSteerRatio, 0, 1);
    let slipSign = -Math.sign(steerAngle);
    let slipStrength = slipBase * (speedAbs / params.maxSpeed) * slipSteerRatio * slipSign;
    v_y += slipStrength * dt; // tylko akumulacja na v_y!
    const maxVy = params.maxSpeed * 0.7;
    if (Math.abs(v_y) > maxVy) v_y = maxVy * Math.sign(v_y);
  }
  // Tłumienie boczne – mocniejsze, by drift nie trwał wiecznie
  v_y += -v_y * grip * sideFrictionMultiplier * dt;

  // --- Efekt skrętu: zmiana kierunku jazdy ---
  let angularVel = (v_x / params.wheelBase) * Math.tan(steerAngle);
  carAngle += angularVel * dt;

  // --- Aktualizacja pozycji ---
  let cosA = Math.cos(carAngle);
  let sinA = Math.sin(carAngle);
  carX += (v_x * cosA - v_y * sinA) * dt;
  carY += (v_x * sinA + v_y * cosA) * dt;

  // --- Opory toczenia i aerodynamiczne ---
  // v_x *= params.dragCoef; // stary opór (zakomentowany)
  // Opór aerodynamiczny (proporcjonalny do v^2)
  let F_drag = 0.5 * params.carDragCoefficient * params.carFrontalArea * params.airDensity * v_x * Math.abs(v_x);
  // Opór toczenia (stały, zależny od masy)
  let F_roll = params.rollingResistance * params.carMass * 9.81 * Math.sign(v_x);
  // Suma oporów (działają przeciwnie do kierunku ruchu)
  let F_total = F_drag + F_roll;
  // Aktualizacja prędkości (F = m*a => a = F/m)
  v_x -= (F_total / params.carMass) * dt;

  return {carX, carY, carAngle, v_x, v_y, steerAngle};
}

let throttleLock = false; // blokada gazu po kolizji
// let inertiaTimer = 0; // usunięte
let fpvCamera = null;
let vKey = null;
function update(time, dt) {
  dt = dt / 1000;
  // --- OBSŁUGA PRZEŁĄCZANIA FPV ---
  if (vKey && Phaser.Input.Keyboard.JustDown(vKey)) {
    fpvCamera.toggle();
  }
  // --- 1) Napęd i tarcie ---
  let throttle = 0;
  if (!throttleLock) {
    throttle = cursors.up.isDown ? 1 : cursors.down.isDown ? -1 : 0;
  } else {
    if (!cursors.up.isDown && !cursors.down.isDown) {
      throttleLock = false;
    }
  }
  const steerRaw = cursors.left.isDown ? -1 : cursors.right.isDown ? 1 : 0;
  const steerSmooth = 0.5;
  steerInput = steerInput * steerSmooth + steerRaw * (1 - steerSmooth);

  // --- Pobierz typ nawierzchni ---
  let surface = worldData.getSurfaceTypeAt(carX, carY);
  let grip = terrainGripMultiplier[surface] ?? 1.0;
  let localMaxSpeed = maxSpeed * grip; // maxSpeed zależny od nawierzchni

  // --- Parametry auta ---
  let params = {
    maxSteer: maxSteer,
    steerSpeed: steerSpeed,
    steerReturnSpeed: steerReturnSpeed,
    accel: accel,
    maxSpeed: localMaxSpeed, // <-- tu!
    wheelBase: wheelBase,
    grip: grip,
    carMass: carMass,
    carDragCoefficient: carDragCoefficient,
    carFrontalArea: carFrontalArea,
    airDensity: airDensity,
    rollingResistance: rollingResistance,
  };

  // --- Zapamiętaj pozycję auta przed ruchem ---
  let prevCarX = carX;
  let prevCarY = carY;

  // --- NOWY MODEL RUCHU ---
  let state = updateCarPhysics(dt, steerInput, throttle, params, surface);
  carX = state.carX;
  carY = state.carY;
  carAngle = state.carAngle;
  v_x = state.v_x;
  v_y = state.v_y;
  car.steerAngle = state.steerAngle;

  // --- Ustaw pozycję i rotację sprite'a ---
  car.x = carX;
  car.y = carY;
  car.rotation = carAngle + Math.PI / 2;

  // --- Kolizje z przeszkodami (obstacle) – PO OKRĘGU ---
  let onObstacle = false;
  const steps = 12;
  for (let i = 0; i < steps; i++) {
    const angle = (Math.PI * 2 * i) / steps;
    const px = car.x + Math.cos(angle) * carCollisionRadius;
    const py = car.y + Math.sin(angle) * carCollisionRadius;
    if (worldData.getSurfaceTypeAt(px, py) === 'obstacle') {
      onObstacle = true;
      break;
    }
  }
  if (onObstacle) {
    // Odbicie jak w modelu rowerowym:
    let cosA = Math.cos(carAngle);
    let sinA = Math.sin(carAngle);
    let v_global_x = v_x * cosA - v_y * sinA;
    let v_global_y = v_x * sinA + v_y * cosA;
    v_global_x = -v_global_x * obstacleBounce;
    v_global_y = -v_global_y * obstacleBounce;
    v_x = v_global_x * cosA + v_global_y * sinA;
    v_y = -v_global_x * sinA + v_global_y * cosA;
    // Cofnij auto do pozycji sprzed ruchu
    carX = prevCarX;
    carY = prevCarY;
    car.x = carX;
    car.y = carY;
    throttleLock = true; // blokada gazu po kolizji z przeszkodą (jak po keyUp)
  }

  // --- Kolizje z krawędziami świata po obrysie auta ---
  let worldEdgeCollision = false;
  const carCorners = getCarCorners(car.x, car.y, car.rotation, carWidth, carHeight);
  for (const corner of carCorners) {
    if (corner.x < 0 || corner.x > worldW || corner.y < 0 || corner.y > worldH) {
      worldEdgeCollision = true;
      break;
    }
  }
  if (worldEdgeCollision) {
    // Odbicie jak w modelu rowerowym:
    let cosA = Math.cos(carAngle);
    let sinA = Math.sin(carAngle);
    let v_global_x = v_x * cosA - v_y * sinA;
    let v_global_y = v_x * sinA + v_y * cosA;
    v_global_x = -v_global_x * obstacleBounce;
    v_global_y = -v_global_y * obstacleBounce;
    v_x = v_global_x * cosA + v_global_y * sinA;
    v_y = -v_global_x * sinA + v_global_y * cosA;
    // Cofnij auto do pozycji sprzed ruchu
    carX = prevCarX;
    carY = prevCarY;
    car.x = carX;
    car.y = carY;
    throttleLock = true; // blokada gazu po kolizji ze ścianą świata (jak po keyUp)
  }

  // --- Dynamiczne dorysowywanie kafli świata (bez zmian) ---
  for (const tile of trackTiles) tile.destroy();
  trackTiles = [];
  const radius = 1.1 * 1.5 * Math.max(viewW, viewH) + tileSize;
  const cx = car.x;
  const cy = car.y;
  const minTileX = Math.floor((cx - radius) / tileSize) - 1;
  const maxTileX = Math.floor((cx + radius) / tileSize) + 1;
  const minTileY = Math.floor((cy - radius) / tileSize) - 1;
  const maxTileY = Math.floor((cy + radius) / tileSize) + 1;
  for (let tx = minTileX; tx <= maxTileX; tx++) {
    for (let ty = minTileY; ty <= maxTileY; ty++) {
      let x = tx * tileSize;
      let y = ty * tileSize;
      const dx = x + tileSize/2 - cx;
      const dy = y + tileSize/2 - cy;
      if (dx*dx + dy*dy <= radius*radius) {
        const tileId = `tile_${tx}_${ty}`;
        if (this.textures.exists(tileId)) {
          const tile = this.add.image(x, y, tileId)
            .setOrigin(0)
            .setDepth(0);
          trackTiles.push(tile);
        }
      }
    }
  }
  // —— Licznik FPS
  if (fpsText) {
    const fps = (1 / dt).toFixed(1);
    fpsText.setText('FPS: ' + fps);
  }

  // ===================== MINIMAPA: rysowanie pozycji gracza =====================
  if (minimapa && minimapOverlay) {
    minimapOverlay.clear();
    // Skalowanie pozycji samochodu względem świata gry (6144x6144)
    const px = Phaser.Math.Clamp(car.x, 0, worldW);
    const py = Phaser.Math.Clamp(car.y, 0, worldH);
    const minimapOffsetX = minimapMargin;
    const minimapOffsetY = minimapMargin + 50;
    const carX = minimapOffsetX + (px / worldW * minimapSize);
    const carY = minimapOffsetY + (py / worldH * minimapSize);
    minimapOverlay.fillStyle(0xff0000, 1);
    minimapOverlay.fillCircle(carX, carY, 3);
    minimapOverlay.lineStyle(1, 0xffffff, 1);
    minimapOverlay.strokeCircle(carX, carY, 3);
  }
  // ===================== /MINIMAPA =====================

  // --- AKTUALIZACJA FPV ---
  if (fpvCamera && fpvCamera.isFPVActive()) {
    fpvCamera.update(dt);
  }
}

// --- REJESTRACJA SERVICE WORKERA DLA PWA ---
// if ('serviceWorker' in navigator) {
//   window.addEventListener('load', () => {
//     navigator.serviceWorker.register('/service-worker.js');
//   });
// }
