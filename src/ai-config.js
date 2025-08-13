// ai_modules/ai-config.js

export const AI_CONFIG = {
  // Nawigacja
  WAYPOINT_ZONE_RADIUS: 150,
  WAYPOINT_STABILITY_INTERVAL: 0.3, // sekundy

  // Logika jazdy
  STEER_P: 0.2,
  MAX_STEER_INPUT: 0.12,
  DEAD_ZONE_ANGLE: 0.15, // radiany

  // Wykrywanie utknięcia
  STUCK_CHECK_INTERVAL: 3.0, // sekundy
  STUCK_MIN_MOVEMENT_DISTANCE: 30, // piksele
  STUCK_TIME_TO_TRIGGER_DESPERATE: 6.0, // sekundy

  // System ratunkowy (Recovery)
  RECOVERY_MAX_ATTEMPTS: 2,
  RECOVERY_REVERSE_TIME: 1.5, // sekundy
  RECOVERY_REORIENT_TIME: 1.5, // sekundy

  // Tryb desperacki
  DESPERATE_MODE_DURATION: 5.0, // sekundy
  DESPERATE_MODE_SKIP_WAYPOINTS: 2,

  // Strefy niebezpieczne
  DANGER_ZONE_RADIUS: 150,
  DANGER_ZONE_AVOID_TIME: 15000, // milisekundy
  DANGER_ZONE_MAX_COUNT: 10,
  DANGER_ZONE_COLLISION_THRESHOLD_FOR_DESPERATE: 2, // Ilość kolizji w strefie by włączyć tryb desperacki
};