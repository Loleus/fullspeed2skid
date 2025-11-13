// Menedżer kolizji dla samochodów AI
export class CollisionManager {
    constructor() {
        this.lastCollisionTime = 0;
        this.collisionCount = 0;
        this.COLLISION_RESET_TIME = 5000; // 5 sekund na reset licznika kolizji
        this.COLLISION_THRESHOLD = 2; // Po 2 kolizjach w ciągu 5s zaczyna unikać
        this.FRONTAL_COLLISION_ANGLE = Math.PI / 3; // 60 stopni jako kąt uznawany za czołowy
    }

    reset() {
        this.lastCollisionTime = 0;
        this.collisionCount = 0;
    }

    // Sprawdza czy kolizja była czołowa
    isFrontalCollision(aiCar, playerCar) {
        // Oblicz kąt między wektorami kierunków pojazdów
        const dx = playerCar.carX - aiCar.carX;
        const dy = playerCar.carY - aiCar.carY;
        const collisionAngle = Math.atan2(dy, dx);
        const aiDirection = aiCar.carAngle;
        
        // Oblicz różnicę kątów
        let angleDiff = Math.abs(aiDirection - collisionAngle);
        while (angleDiff > Math.PI) angleDiff = Math.abs(angleDiff - Math.PI * 2);
        
        return angleDiff < this.FRONTAL_COLLISION_ANGLE;
    }

    // Obsługuje kolizję z graczem
    handlePlayerCollision(aiCar, playerCar) {
        const now = Date.now();
        
        // Resetuj licznik jeśli minęło więcej niż 5 sekund
        if (now - this.lastCollisionTime > this.COLLISION_RESET_TIME) {
            this.collisionCount = 0;
        }
        
        // Sprawdź czy to kolizja czołowa
        if (this.isFrontalCollision(aiCar, playerCar)) {
            this.collisionCount++;
            this.lastCollisionTime = now;
            
            // Jeśli przekroczono próg kolizji, zwróć true aby zainicjować manewr unikania
            if (this.collisionCount >= this.COLLISION_THRESHOLD) {
                return true;
            }
        }
        
        return false;
    }

    // Oblicza czas trwania manewru unikania
    getAvoidanceDuration() {
        return 2000 + Math.random() * 1000; // 2-3 sekundy
    }
}