// aiDriving.js
export class AIDriving {
  constructor(ai) {
    // ai = referencja do instancji AICar zawierającej stan pojazdu i konfigurację
    this.ai = ai;
  }

  // Zwraca aktualny cel (waypoint) — bez dodatkowych zabezpieczeń
  _getSafeTarget() {
    // bezpieczny skrót do listy waypointów przechowywanych w obiekcie ai
    return this.ai.waypoints[this.ai.currentWaypointIndex];
  }

  // Sprawdza, czy pojazd dotarł do bieżącego waypointu i przełącza na następny
  _checkWaypointCompletion() {
    // pobierz bieżący waypoint (może być undefined jeśli lista pusta)
    const currentWP = this.ai.waypoints[this.ai.currentWaypointIndex];

    // oblicz dystans od samochodu do waypointu
    const dist = Math.hypot(
      currentWP.x - this.ai.carX,
      currentWP.y - this.ai.carY
    );

    // jeśli jesteśmy w strefie waypointa, przejdź do następnego punktu (zawijanie przy końcu)
    if (dist < this.ai.waypointZoneRadius) {
      this.ai.currentWaypointIndex = (this.ai.currentWaypointIndex + 1) % this.ai.waypoints.length;
    }
  }

  // Detektor "utkwienia" — sprawdza, czy pojazd się nie porusza i zlicza czas utkwienia
  _detectStuck(dt) {
    // bieżąca pozycja samochodu
    const currentPos = { x: this.ai.carX, y: this.ai.carY };

    // zwiększ licznik czasu od ostatniego sprawdzenia pozycji
    this.ai.stuckDetector.positionTimer += dt;

    // odczytaj interwał sprawdzania pozycji z konfiguracji
    const checkInterval = this.ai.config.stuckDetector.positionCheckInterval;

    // jeśli minął interwał, wykonaj kontrolę ruchu
    if (this.ai.stuckDetector.positionTimer >= checkInterval) {
      // odległość przebyta od ostatnio zarejestrowanej pozycji
      const distMoved = Math.hypot(
        currentPos.x - this.ai.stuckDetector.lastPosition.x,
        currentPos.y - this.ai.stuckDetector.lastPosition.y
      );

      // jeśli nie przesunęliśmy się wystarczająco — zwiększ licznik utkwienia
      if (distMoved < this.ai.stuckDetector.minMovementDistance) {
        this.ai.stuckDetector.stuckTime += checkInterval;
        // log informacyjny o sytuacji utkwienia
        console.log(`[AI] STUCK! Moved ${distMoved.toFixed(0)}px, stuck for ${this.ai.stuckDetector.stuckTime}s`);

        // jeśli osiągnięto próg czasu utkwienia, zresetuj licznik (tu miejsce na akcję naprawczą)
        if (this.ai.stuckDetector.stuckTime >= this.ai.config.stuckDetector.stuckTimeThreshold) {
          console.log('[AI] STUCK! Resetting stuck timer');
          // aktualnie tylko resetujemy licznik; tutaj można dodać dodatkowe zachowania (np. cofnięcie)
          this.ai.stuckDetector.stuckTime = 0;
        }
      } else {
        // jeśli się poruszamy, wyzeruj licznik utkwienia
        this.ai.stuckDetector.stuckTime = 0;
      }

      // zapisz aktualną pozycję jako "ostatnią znaną" i zresetuj timer pozycji
      this.ai.stuckDetector.lastPosition = { ...currentPos };
      this.ai.stuckDetector.positionTimer = 0;
    }
  }

  // Removed dangerZones getter
}
