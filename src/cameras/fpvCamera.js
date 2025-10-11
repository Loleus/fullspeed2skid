// FPVCamera.js - System kamery FPV (First Person View)
// Kamera leci w helikopterze nad autem i próbuje je dogonić z opóźnieniem

export class FPVCamera {
  constructor(scene, car) {
    this.scene = scene;
    this.car = car;
    this.isActive = false;
    
    // Parametry kamery FPV
    this.height = 300; // Wysokość kamery nad autem
    this.followSpeed = 0.03; // mocniejsze opóźnienie
    this.rotationSpeed = 0.07; // opóźnienie na rotacji
    
    // Pozycja kamery FPV
    this.fpvX = 0;
    this.fpvY = 0;
    this.cameraAngle = 0; // lerpowany kąt kamery (radiany)
    this.lastCarAngle = 0; // poprzedni kąt auta
    this.rotationDelayTimer = 0; // licznik opóźnienia gonienia rotacji
    this.rotationDelayDuration = 0.5; // czas opóźnienia w sekundach
    
    // Pozycja docelowa (nad autem)
    this.targetX = 0;
    this.targetY = 0;
    this.targetRotation = 0;
    
    // Zapamiętaj oryginalną kamerę
    this.originalCamera = scene.cameras.main;
    this.originalFollowTarget = car; // <- zawsze auto
    this.originalFollowConfig = {
      lerpX: this.originalCamera.lerpX,
      lerpY: this.originalCamera.lerpY
    };
    // Bufor historii pozycji i rotacji auta do opóźnienia czasowego
    this.history = [];
    this.historyDelay = 0.1; // opóźnienie w sekundach
    // Zmienna do throttlingu logów
    this.lastLogTime = 0;
  }
  
  // Aktywuj kamerę FPV
  activate() {
    if (this.isActive) return;
    console.log('[FPV] Aktywacja kamery FPV');
    this.isActive = true;
    this.originalFollowTarget = this.originalCamera.followTarget;
    this.originalFollowConfig = {
      lerpX: this.originalCamera.lerpX,
      lerpY: this.originalCamera.lerpY
    };
    this.fpvX = this.car.x;
    this.fpvY = this.car.y;
    this.cameraAngle = 0; // Kamera na starcie nie jest obrócona
    this.originalCamera.stopFollow();
    // Przelicz scroll kamery względem rotacji, by auto było na środku na starcie
    const cam = this.originalCamera;
    const cx = this.fpvX;
    const cy = this.fpvY;
    const angle = this.cameraAngle;
    const w = cam.width;
    const h = cam.height;
    // Profesjonalne przesunięcie: auto na 4/5 ekranu niezależnie od rotacji
    const screenOffsetY = h/2 - h*4/5; // ile pikseli przesunąć w osi Y (ujemne)
    const worldOffsetX = -screenOffsetY * Math.sin(angle);
    const worldOffsetY =  screenOffsetY * Math.cos(angle);
    cam.setScroll(cx - w/2 + worldOffsetX, cy - h/2 + worldOffsetY);
    cam.setRotation(-angle);
  }
  
  // Deaktywuj kamerę FPV
  deactivate() {
    if (!this.isActive) return;
    
    console.log('[FPV] Deaktywacja kamery FPV');
    this.isActive = false;
    
    // Resetuj rotację kamery po wyjściu z FPV
    this.originalCamera.setRotation(0);
  }
  

  
  // Aktualizuj kamerę FPV
  update(dt) {
    if (!this.isActive) return;
    // Docelowa pozycja auta
    const targetX = this.car.x;
    const targetY = this.car.y;
    // Pobierz carAngle z obiektu auta (przechowuje orientację względem świata)
    const carAngle = this.car.carAngle !== undefined ? this.car.carAngle : this.car.rotation;
    const now = this.scene.time.now / 1000; // czas w sekundach

    // Dodaj bieżący stan do historii
    this.history.push({ x: targetX, y: targetY, angle: carAngle, t: now });
    // Usuń stare wpisy z historii (starsze niż potrzebne)
    while (this.history.length > 2 && this.history[1].t < now - this.historyDelay) {
      this.history.shift();
    }

    // Szukaj w historii pozycji/rotacji sprzed opóźnienia
    let delayed = this.history[0];
    for (let i = 1; i < this.history.length; i++) {
      if (this.history[i].t >= now - this.historyDelay) {
        // Interpolacja liniowa między dwoma wpisami
        const a = this.history[i-1];
        const b = this.history[i];
        const t = (now - this.historyDelay - a.t) / (b.t - a.t);
        delayed = {
          x: Phaser.Math.Linear(a.x, b.x, t),
          y: Phaser.Math.Linear(a.y, b.y, t),
          angle: Phaser.Math.Angle.Wrap(a.angle + Phaser.Math.Angle.ShortestBetween(a.angle, b.angle) * t),
          t: a.t + t * (b.t - a.t)
        };
        break;
      }
    }

    // Ustaw pozycję i rotację kamery na opóźnioną
    this.fpvX = delayed.x;
    this.fpvY = delayed.y;
    this.cameraAngle = delayed.angle;

    const cam = this.originalCamera;
    const cx = this.fpvX;
    const cy = this.fpvY;
    const angle = this.cameraAngle;
    const w = cam.width;
    const h = cam.height;
    // Profesjonalne przesunięcie: auto na 4/5 ekranu niezależnie od rotacji
    const screenOffsetY2 = h/2 - h*4/5;
    const worldOffsetX2 = -screenOffsetY2 * Math.sin(angle);
    const worldOffsetY2 =  screenOffsetY2 * Math.cos(angle);
    cam.setScroll(this.fpvX - w/2 + worldOffsetX2, this.fpvY - h/2 + worldOffsetY2);
    cam.setRotation(-angle);

    // HUD zostaje przyklejony do ekranu (w main.js już jest setScrollFactor(0))
  }
  
  // Pobierz lerpowaną pozycję kamery
  getCameraPos() {
    return { x: this.fpvX, y: this.fpvY };
  }
  
  // Pobierz lerpowany kąt kamery
  getCameraAngle() {
    return this.cameraAngle;
  }
  
  // Pobierz status aktywacji
  isFPVActive() {
    return this.isActive;
  }
  
  reset() {
    if (this.isActive) {
      // Resetuj pozycję kamery do pozycji auta
      this.fpvX = this.car.x;
      this.fpvY = this.car.y;
      this.cameraAngle = this.car.carAngle !== undefined ? this.car.carAngle : this.car.rotation;
      
      // Wyczyść historię
      this.history = [];
      
      // Ustaw kamerę na pozycję auta
      const cam = this.originalCamera;
      const w = cam.width;
      const h = cam.height;
      const screenOffsetY = h/2 - h*4/5;
      const worldOffsetX = -screenOffsetY * Math.sin(this.cameraAngle);
      const worldOffsetY = screenOffsetY * Math.cos(this.cameraAngle);
      cam.setScroll(this.fpvX - w/2 + worldOffsetX, this.fpvY - h/2 + worldOffsetY);
      cam.setRotation(-this.cameraAngle);
    }
  }
}