// aiConfig.js
export const aiConfig = {
  // Podstawowe parametry
  waypointZoneRadius: 160,
  steerP: 0.2,
  maxSteerInput: 0.12,
  deadZoneAngle: 0.15,
  lookaheadDistance: 20,

  // Nowe parametry sterowania
  steering: {
    baseSensitivity: 0.15,     // Podstawowa czułość skrętu
    speedReductionFactor: 0.8, // Współczynnik redukcji skrętu przy dużej prędkości
    lateralControlFactor: 1.6, // Współczynnik korekcji przy poślizgu bocznym
  },

  // Parametry prędkości
  speed: {
    baseThrottle: 0.4,        // Podstawowa wartość przyspieszenia
    cautionThrottle: 0.2,     // Ostrożne przyspieszenie
    minThrottle: 0.03,        // Minimalne przyspieszenie
    
    speedThresholds: {
      high: 180,              // Próg wysokiej prędkości
      medium: 120,            // Próg średniej prędkości
      highSpeedThrottle: 0.05,
      mediumSpeedThrottle: 0.1
    }
  },

  // Parametry kontroli poślizgu
  lateralControl: {
    severeSlipThreshold: 60,  // Próg poważnego poślizgu bocznego
    moderateSlipThreshold: 40, // Próg umiarkowanego poślizgu
    severeSlipThrottleMultiplier: 0.2,
    moderateSlipThrottleMultiplier: 0.5,
    severeSlipSteerMultiplier: 0.3,
    moderateSlipSteerMultiplier: 0.6
  },

  // Parametry podejścia do waypointów
  waypointControl: {
    angleThresholds: {
      extreme: 1.5,           // Kąt ekstremalny (rad)
      high: 1.0,             // Duży kąt
      medium: 0.7,           // Średni kąt
      small: 0.2,            // Mały kąt
    },
    throttleMultipliers: {
      extreme: 0.03,         // Множитель dla ekstremalnego kąta
      high: 0.06,           // Dla dużego kąta
      medium: 0.1,          // Dla średniego kąta
      small: 0.15,          // Dla małego kąta
      optimal: 0.25         // Dla optymalnego kąta
    }
  },

  // Parametry bezpieczeństwa
  safety: {
    dangerZoneThrottleMultiplier: 0.3,  // Redukcja prędkości w strefie zagrożenia
    minSafeDistance: 50,                 // Minimalna bezpieczna odległość od przeszkód
    cautionRadius: 80                    // Promień zwiększonej ostrożności
  },

  // Wykrywanie utknięcia
  stuckDetector: {
    positionCheckInterval: 3.0,
    minMovementDistance: 30,
    stuckTimeThreshold: 6.0
  },

  // Recovery
  recovery: {
    maxRecoveryAttempts: 2,
    reverseTimer: 2.5,
    reorientTimer: 2.5
  },

  // Strefy niebezpieczne
  dangerZones: {
    maxDangerZones: 10,
    dangerZoneRadius: 150,
    dangerZoneAvoidTime: 15000
  },

  // Desperate mode
  desperateMode: {
    timer: 5.0,
    skipDistance: 3
  },

  // Debug
  debugInterval: 1.0,

  // Stabilizacja waypointa
  waypointStabilityMinChangeInterval: 0.3
};