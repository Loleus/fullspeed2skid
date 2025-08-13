// ai_modules/DangerZoneManager.js

export class DangerZoneManager {
  constructor(config) {
    this.config = config;
    this.zones = [];
  }

  add(x, y) {
    // Sprawdź, czy już istnieje podobna strefa i zaktualizuj ją
    for (const existingZone of this.zones) {
      const dist = Math.hypot(x - existingZone.x, y - existingZone.y);
      if (dist < this.config.DANGER_ZONE_RADIUS) {
        existingZone.time = Date.now();
        existingZone.collisions = (existingZone.collisions || 1) + 1;
        console.log(`[DangerZone] Updated zone, collisions: ${existingZone.collisions}`);
        return;
      }
    }

    // Dodaj nową strefę
    this.zones.push({ x, y, time: Date.now(), collisions: 1 });
    if (this.zones.length > this.config.DANGER_ZONE_MAX_COUNT) {
      this.zones.shift(); // Usuń najstarszą
    }
    console.log(`[DangerZone] Added new zone. Total: ${this.zones.length}`);
  }

  cleanup() {
    const now = Date.now();
    this.zones = this.zones.filter(zone => (now - zone.time) < this.config.DANGER_ZONE_AVOID_TIME);
  }

  isPointInDanger(point) {
    for (const zone of this.zones) {
      const dist = Math.hypot(point.x - zone.x, point.y - zone.y);
      if (dist < this.config.DANGER_ZONE_RADIUS) {
        return true;
      }
    }
    return false;
  }
  
  getCollisionsInZone(x, y) {
      for (const zone of this.zones) {
          const dist = Math.hypot(x - zone.x, y - zone.y);
          if (dist < this.config.DANGER_ZONE_RADIUS) {
              return zone.collisions || 1;
          }
      }
      return 0;
  }

  reset() {
    this.zones = [];
  }
}