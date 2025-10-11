// CameraManager.js - główny moduł zarządzania kamerami
import { FPVCamera } from './FPVCamera.js';
import { ClassicCamera } from './ClassicCamera.js';

export class CameraManager {
  constructor(scene, car, worldSize) {
    this.scene = scene;
    this.car = car;
    this.currentCamera = null;
    this.cameras = {};
    
    // Parametry początkowe obu kamer
    this.cameraParams = {
      classic: {
        followOffset: { x: 0.27, y: 0.27 },
        bounds: { x: 0, y: 0, width: worldSize, height: worldSize }
      },
      fpv: {
        // parametry FPV będą w module FPVCamera.js
      }
    };
    
    this.initializeCameras();
  }
  
  initializeCameras() {
    // Inicjalizacja kamer
    this.cameras.classic = new ClassicCamera(this.scene, this.car, this.cameraParams.classic);
    this.cameras.fpv = new FPVCamera(this.scene, this.car);
    
    // Domyślnie aktywuj kamerę klasyczną
    this.activateClassic();
  }
  
  activateClassic() {
    if (this.currentCamera) {
      this.currentCamera.deactivate();
    }
    this.cameras.classic.activate();
    this.currentCamera = this.cameras.classic;
  }
  
  activateFPV() {
    if (this.currentCamera) {
      this.currentCamera.deactivate();
    }
    this.cameras.fpv.activate();
    this.currentCamera = this.cameras.fpv;
  }
  
  toggle() {
    if (this.currentCamera === this.cameras.classic) {
      this.activateFPV();
    } else {
      this.activateClassic();
    }
  }
  
  isFPVActive() {
    return this.currentCamera === this.cameras.fpv;
  }
  
  isClassicActive() {
    return this.currentCamera === this.cameras.classic;
  }
  
  update(dt) {
    if (this.currentCamera && this.currentCamera.update) {
      this.currentCamera.update(dt);
    }
  }
  
  reset() {
    if (this.currentCamera && this.currentCamera.reset) {
      this.currentCamera.reset();
    }
  }
  
  getCurrentCamera() {
    return this.currentCamera;
  }
}
