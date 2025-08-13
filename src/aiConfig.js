// aiConfig.js
export const aiConfig = {
  // Sterowanie / waypointy
  waypointZoneRadius: 150,
  steerP: 0.2,
  maxSteerInput: 0.12,
  deadZoneAngle: 0.15,
  lookaheadDistance: 120,

  // Wykrywanie utknięcia (parametry)
  stuckDetector: {
    positionCheckInterval: 3.0, // oryginalnie 3.0
    minMovementDistance: 30,
    stuckTimeThreshold: 6.0
  },

  // Recovery
  recovery: {
    maxRecoveryAttempts: 2,
    reverseTimer: 1.5,
    reorientTimer: 1.5
  },

  // Strefy (danger zones)
  dangerZones: {
    maxDangerZones: 10,
    dangerZoneRadius: 150,
    dangerZoneAvoidTime: 15000
  },

  // Desperate mode
  desperateMode: {
    timer: 5.0,
    skipDistance: 5
  },

  // Debug
  debugInterval: 1.0,

  // Stabilizacja waypointa
  waypointStabilityMinChangeInterval: 0.3
};