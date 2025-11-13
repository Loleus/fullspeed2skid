// systems/SkidMarksSystem.js
import { SkidMarks } from "./rendering/skidMarks.js";
import { updateSkidMarks } from "./rendering/SkidMarksManager.js";

export class SkidMarksSystem {
  constructor(scene, { enabled = true, wheelWidth = 12, tileSize }) {
    this.scene = scene;
    this.enabled = enabled;
    this.wheelWidth = wheelWidth;
    this.tileSize = tileSize;
    this._list = []; // { controller, skidMarks }
  }

  register(controller) {
    const sm = new SkidMarks({ enabled: this.enabled, wheelWidth: this.wheelWidth });
    this._list.push({ controller, skidMarks: sm });
    return sm;
  }

  update() {
    if (!this.enabled || this._list.length === 0) return;
    updateSkidMarks(this.scene, this.tileSize, this._list);
  }

  clear() {
    for (const { skidMarks } of this._list) skidMarks.clear();
  }
}
