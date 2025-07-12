// car.js - moduł auta z fizyką, sterowaniem i kolizjami
export class Car {
  constructor(scene, carSprite, worldData) {
    this.scene = scene;
    this.carSprite = carSprite;
    this.worldData = worldData;
    
    // Parametry auta
    this.CAR_WIDTH = 52;
    this.CAR_HEIGHT = 96;
    this.wheelBase = 104; // rozstaw osi (px)
    this.carMass = 1200; // masa auta w kg
    this.carDragCoefficient = 0.42; // współczynnik oporu aerodynamicznego (Cx)
    this.carFrontalArea = 2.2; // powierzchnia czołowa auta w m^2
    this.airDensity = 1.225; // gęstość powietrza (kg/m^3)
    this.rollingResistance = 5; // współczynnik oporu toczenia
    
    // Parametry jazdy
    this.MAX_STEER_DEG = 23; // maksymalny kąt skrętu kół (stopnie)
    this.STEER_SPEED_DEG = 38; // szybkość skręcania kół (stopnie/sek)
    this.STEER_RETURN_SPEED_DEG = 120; // szybkość powrotu kół do zera (stopnie/sek)
    this.accel = 1000; // przyspieszenie
    this.maxSpeed = 800; // maksymalna prędkość
    
    // Parametry driftu / poślizgu
    this.slipBase = 700; // bazowa siła poślizgu
    this.SLIP_START_SPEED = 0.6 * this.maxSpeed; // próg prędkości, od której zaczyna się poślizg
    this.SLIP_STEER_THRESHOLD_RATIO = 0.3; // próg skrętu (procent maxSteer)
    this.sideFrictionMultiplier = 3; // SIŁA tłumienia bocznego driftu
    this.obstacleBounce = 0.3; // SIŁA odbicia od przeszkody/ściany
    this.terrainGripMultiplier = { 'asphalt': 1.0, 'grass': 0.85, 'gravel': 0.6, 'water': 0.2 };
    
    // Przeliczone parametry
    this.maxSteer = Phaser.Math.DegToRad(this.MAX_STEER_DEG);
    this.steerSpeed = Phaser.Math.DegToRad(this.STEER_SPEED_DEG);
    this.steerReturnSpeed = Phaser.Math.DegToRad(this.STEER_RETURN_SPEED_DEG);
    
    // Stan auta
    this.v_x = 0; // prędkość wzdłuż auta (przód/tył)
    this.v_y = 0; // prędkość boczna (drift)
    this.carAngle = 0; // orientacja auta
    this.carX = 0;
    this.carY = 0;
    this.steerInput = 0; // wygładzony sygnał sterowania
    this.steerAngle = 0; // aktualny kąt skrętu
    
    // Kolizje
    this.throttleLock = false; // blokada gazu po kolizji
    this.collisionCount = 0; // licznik kolizji w jednej klatce
    this.MAX_COLLISIONS_PER_FRAME = 3; // maksymalna liczba kolizji na klatkę
    
    // Ustaw rozmiar sprite'a
    this.carSprite.setDisplaySize(this.CAR_WIDTH, this.CAR_HEIGHT);
  }
  
  // Resetuj stan auta
  resetState(startX, startY, startAngle = -Math.PI / 2) {
    this.carX = startX;
    this.carY = startY;
    this.carAngle = startAngle;
    this.v_x = 0;
    this.v_y = 0;
    this.steerAngle = 0;
    this.throttleLock = false;
    this.collisionCount = 0;
    
    // Ustaw pozycję sprite'a
    this.carSprite.x = this.carX;
    this.carSprite.y = this.carY;
    this.carSprite.rotation = this.carAngle + Math.PI / 2;
  }
  
  // Pobierz rogi auta dla kolizji
  getCarCorners(x, y, rot, width, height) {
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
  
  // Aktualizuj fizykę auta
  updatePhysics(dt, steerInput, throttle, surface) {
    // Pobierz parametry nawierzchni
    let grip = this.terrainGripMultiplier[surface] ?? 1.0;
    let localMaxSpeed = this.maxSpeed * grip;
    
    // Parametry auta
    let params = {
      maxSteer: this.maxSteer,
      steerSpeed: this.steerSpeed,
      steerReturnSpeed: this.steerReturnSpeed,
      accel: this.accel,
      maxSpeed: localMaxSpeed,
      wheelBase: this.wheelBase,
      grip: grip,
      carMass: this.carMass,
      carDragCoefficient: this.carDragCoefficient,
      carFrontalArea: this.carFrontalArea,
      airDensity: this.airDensity,
      rollingResistance: this.rollingResistance,
    };
    
    // Sterowanie skrętem
    if (Math.abs(steerInput) > 0.01) {
      this.steerAngle += steerInput * params.steerSpeed * dt;
      this.steerAngle = Phaser.Math.Clamp(this.steerAngle, -params.maxSteer, params.maxSteer);
    } else if (this.steerAngle !== 0) {
      let speedAbs = Math.abs(this.v_x);
      if (speedAbs > 1) {
        let factor = speedAbs / params.maxSpeed;
        let steerReturn = params.steerReturnSpeed * factor;
        if (this.steerAngle > 0) {
          this.steerAngle -= steerReturn * dt;
          if (this.steerAngle < 0) this.steerAngle = 0;
        } else {
          this.steerAngle += steerReturn * dt;
          if (this.steerAngle > 0) this.steerAngle = 0;
        }
      }
    }
    
    // Przyspieszenie i opory
    let force = throttle * params.accel * grip;
    this.v_x += force * dt;
    this.v_x = Phaser.Math.Clamp(this.v_x, -params.maxSpeed, params.maxSpeed);
    
    // Model poślizgu: siła boczna (drift)
    const SLIP_STEER_THRESHOLD = this.SLIP_STEER_THRESHOLD_RATIO * params.maxSteer;
    let steerAbs = Math.abs(this.steerAngle);
    let speedAbs = Math.abs(this.v_x);
    if (
      speedAbs > this.SLIP_START_SPEED &&
      steerAbs > SLIP_STEER_THRESHOLD
    ) {
      let slipSteerRatio = (steerAbs - SLIP_STEER_THRESHOLD) / (params.maxSteer - SLIP_STEER_THRESHOLD);
      slipSteerRatio = Phaser.Math.Clamp(slipSteerRatio, 0, 1);
      let slipSign = -Math.sign(this.steerAngle);
      let slipStrength = this.slipBase * (speedAbs / params.maxSpeed) * slipSteerRatio * slipSign;
      this.v_y += slipStrength * dt;
      const maxVy = params.maxSpeed * 0.7;
      if (Math.abs(this.v_y) > maxVy) this.v_y = maxVy * Math.sign(this.v_y);
    }
    
    // Tłumienie boczne
    this.v_y += -this.v_y * grip * this.sideFrictionMultiplier * dt;
    
    // Efekt skrętu: zmiana kierunku jazdy
    let angularVel = (this.v_x / params.wheelBase) * Math.tan(this.steerAngle);
    this.carAngle += angularVel * dt;
    
    // Aktualizacja pozycji
    let cosA = Math.cos(this.carAngle);
    let sinA = Math.sin(this.carAngle);
    this.carX += (this.v_x * cosA - this.v_y * sinA) * dt;
    this.carY += (this.v_x * sinA + this.v_y * cosA) * dt;
    
    // Opory toczenia i aerodynamiczne
    let F_drag = 0.5 * params.carDragCoefficient * params.carFrontalArea * params.airDensity * this.v_x * Math.abs(this.v_x);
    let F_roll = params.rollingResistance * params.carMass * 9.81 * Math.sign(this.v_x);
    let F_total = F_drag + F_roll;
    this.v_x -= (F_total / params.carMass) * dt;
    
    // Aktualizuj sprite
    this.carSprite.x = this.carX;
    this.carSprite.y = this.carY;
    this.carSprite.rotation = this.carAngle + Math.PI / 2;
    this.carSprite.steerAngle = this.steerAngle;
  }
  
  // Sprawdź kolizje z przeszkodami (elipsa)
  checkEllipseCollision() {
    const speedMagnitude = Math.sqrt(this.v_x * this.v_x + this.v_y * this.v_y);
    
    // Precyzyjny bufor bezpieczeństwa
    let safetyMargin = 0;
    if (speedMagnitude > 30) {
      safetyMargin = 2;
    } else if (speedMagnitude > 10) {
      safetyMargin = 1;
    }
    
    // Półosie elipsy
    const a = this.CAR_WIDTH / 2 + safetyMargin;
    const b = this.CAR_HEIGHT / 2 + safetyMargin;
    
    // Sprawdź środek auta
    if (this.worldData.getSurfaceTypeAt(this.carX, this.carY) === 'obstacle') {
      return true;
    }
    
    // Sprawdź punkty na elipsie
    const steps = 32;
    for (let i = 0; i < steps; i++) {
      const angle = (Math.PI * 2 * i) / steps;
      const px = this.carX + a * Math.cos(angle) * Math.cos(this.carAngle) - b * Math.sin(angle) * Math.sin(this.carAngle);
      const py = this.carY + a * Math.cos(angle) * Math.sin(this.carAngle) + b * Math.sin(angle) * Math.cos(this.carAngle);
      
      if (this.worldData.getSurfaceTypeAt(px, py) === 'obstacle') {
        return true;
      }
    }
    
    return false;
  }
  
  // Sprawdź kolizje z krawędziami świata
  checkWorldEdgeCollision(worldW, worldH) {
    const carCorners = this.getCarCorners(this.carX, this.carY, this.carAngle, this.CAR_WIDTH, this.CAR_HEIGHT);
    for (const corner of carCorners) {
      if (corner.x < 0 || corner.x > worldW || corner.y < 0 || corner.y > worldH) {
        return true;
      }
    }
    return false;
  }
  
  // Obsłuż kolizję
  handleCollision(prevX, prevY, worldW, worldH) {
    if (this.collisionCount >= this.MAX_COLLISIONS_PER_FRAME) {
      return;
    }
    
    this.collisionCount++;
    
    // Odbicie
    let cosA = Math.cos(this.carAngle);
    let sinA = Math.sin(this.carAngle);
    let v_global_x = this.v_x * cosA - this.v_y * sinA;
    let v_global_y = this.v_x * sinA + this.v_y * cosA;
    
    // Słabsze odbicie przy małych prędkościach
    const speedMagnitude = Math.sqrt(v_global_x * v_global_x + v_global_y * v_global_y);
    const bounceStrength = speedMagnitude < 50 ? 0.1 : this.obstacleBounce;
    
    v_global_x = -v_global_x * bounceStrength;
    v_global_y = -v_global_y * bounceStrength;
    this.v_x = v_global_x * cosA + v_global_y * sinA;
    this.v_y = -v_global_x * sinA + v_global_y * cosA;
    
    // Cofnij auto do pozycji sprzed ruchu
    this.carX = prevX;
    this.carY = prevY;
    this.carSprite.x = this.carX;
    this.carSprite.y = this.carY;
    
    this.throttleLock = true;
  }
  
  // Aktualizuj sterowanie
  updateInput(cursors) {
    // Reset licznika kolizji
    this.collisionCount = 0;
    
    // Gas
    let throttle = 0;
    if (!this.throttleLock) {
      throttle = cursors.up.isDown ? 1 : cursors.down.isDown ? -1 : 0;
    } else {
      if (!cursors.up.isDown && !cursors.down.isDown) {
        this.throttleLock = false;
      }
    }
    
    // Skręt
    const steerRaw = cursors.left.isDown ? -1 : cursors.right.isDown ? 1 : 0;
    const steerSmooth = 0.5;
    this.steerInput = this.steerInput * steerSmooth + steerRaw * (1 - steerSmooth);
    
    return { throttle, steerInput: this.steerInput };
  }
  
  // Główna aktualizacja
  update(dt, cursors, worldW, worldH) {
    // Pobierz sterowanie
    const { throttle, steerInput } = this.updateInput(cursors);
    
    // Pobierz typ nawierzchni
    let surface = this.worldData.getSurfaceTypeAt(this.carX, this.carY);
    
    // Zapamiętaj pozycję przed ruchem
    let prevCarX = this.carX;
    let prevCarY = this.carY;
    
    // Aktualizuj fizykę
    this.updatePhysics(dt, steerInput, throttle, surface);
    
    // Sprawdź kolizje z przeszkodami
    if (this.checkEllipseCollision()) {
      this.handleCollision(prevCarX, prevCarY, worldW, worldH);
    }
    
    // Sprawdź kolizje z krawędziami świata
    if (this.checkWorldEdgeCollision(worldW, worldH)) {
      this.handleCollision(prevCarX, prevCarY, worldW, worldH);
    }
  }
  
  // Gettery dla pozycji i stanu
  getPosition() {
    return { x: this.carX, y: this.carY };
  }
  
  getVelocity() {
    return { v_x: this.v_x, v_y: this.v_y };
  }
  
  getAngle() {
    return this.carAngle;
  }
  
  getSteerAngle() {
    return this.steerAngle;
  }
  
  getSprite() {
    return this.carSprite;
  }
} 