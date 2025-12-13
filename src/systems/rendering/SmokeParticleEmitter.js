export class SmokeParticleEmitter {
    constructor(scene, config = {}) {
        this.scene = scene;
        
        // Konfiguracja
        const MAX_PARTICLES = config.maxParticles || 1000;
        const textureKey = config.textureKey || 'flares';
        const frameKey = config.frameKey || 'black';
        
        // Tablice stanów puli
        this._pCount = MAX_PARTICLES;
        this._alive = 0;
        this._freeStack = new Int32Array(MAX_PARTICLES);
        for (let i = 0; i < MAX_PARTICLES; i++) {
            this._freeStack[i] = MAX_PARTICLES - 1 - i;
        }
        this._freeTop = MAX_PARTICLES - 1;
        
        // Dane cząstek w TypedArrays dla wydajności
        this._px = new Float32Array(MAX_PARTICLES);
        this._py = new Float32Array(MAX_PARTICLES);
        this._vx = new Float32Array(MAX_PARTICLES);
        this._vy = new Float32Array(MAX_PARTICLES);
        this._life = new Float32Array(MAX_PARTICLES);
        this._ttl = new Float32Array(MAX_PARTICLES);
        this._scale = new Float32Array(MAX_PARTICLES);
        this._alpha = new Float32Array(MAX_PARTICLES);
        this._tint = new Uint32Array(MAX_PARTICLES);
        
        // Image-y dodane do sceny i poolowane
        this._sprites = new Array(MAX_PARTICLES);
        for (let i = 0; i < MAX_PARTICLES; i++) {
            const img = scene.add.image(-1000, -1000, textureKey, frameKey);
            img.setVisible(false);
            img.setDepth(1);
            this._sprites[i] = img;
            
            // inicjalne wartości
            this._px[i] = 0;
            this._py[i] = 0;
            this._vx[i] = 0;
            this._vy[i] = 0;
            this._life[i] = 0;
            this._ttl[i] = 0;
            this._scale[i] = 0;
            this._alpha[i] = 0;
            this._tint[i] = 0x000000;
        }
        
        // Kolory cząstek
        this.COLORS = [0x000000, 0x222222, 0x333333, 0x4a4a4a, 0x666666];
    }
    
    emit(x, y, angleDeg) {
        // --- SMALL particles (drobne, szybkie) ---
        const smallCount = Phaser.Math.Between(3, 5);
        for (let s = 0; s < smallCount; s++) {
            if (this._freeTop < 0) break; // brak wolnych slotów w puli -> przerwij
            const idx = this._freeStack[this._freeTop--]; // pobierz indeks wolnego slotu (stack)
            
            // a = kąt w radianach; tutaj dodajesz rozrzut ±8° (jeśli chcesz idealnie w tył, usuń Phaser.Math.Between)
            const a = Phaser.Math.DegToRad(angleDeg + Phaser.Math.Between(-8, 8));
            // speed w px/s
            const speed = Phaser.Math.FloatBetween(40, 80);
            
            // vx, vy zapisane w TypedArray — minimalne alokacje, szybkie odczyty
            this._vx[idx] = Math.cos(a) * speed;
            this._vy[idx] = Math.sin(a) * speed;
            
            // pozycja startowa
            this._px[idx] = x;
            this._py[idx] = y;
            
            // reset czasu życia i ustaw TTL (ms)
            this._life[idx] = 0;
            this._ttl[idx] = Phaser.Math.FloatBetween(300, 500);
            
            // początkowa skala i alpha
            this._scale[idx] = Phaser.Math.FloatBetween(0.02, 0.04);
            this._alpha[idx] = 1.0;
            
            // tint (kolor) — zapisujemy jako 32-bit hex w Uint32Array
            this._tint[idx] = Phaser.Utils.Array.GetRandom(this.COLORS);
            
            // aktywacja sprite'a z puli: ustaw widoczność i transformacje
            const sp = this._sprites[idx];
            sp.setVisible(true); // ustawiamy widoczność tylko przy aktywacji
            sp.x = x;
            sp.y = y; // bezpośrednie przypisanie (szybsze niż setPosition)
            sp.scaleX = sp.scaleY = this._scale[idx];
            sp.alpha = 1.0;
            sp.setTint(this._tint[idx]); // tint ustawiamy raz przy emisji
            sp.setBlendMode(Phaser.BlendModes.MULTIPLY);
            this._alive++; // zwiększ licznik aktywnych cząstek
        }
        
        // --- MEDIUM particles (główna masa) ---
        const mediumCount = Phaser.Math.Between(2, 3);
        for (let m = 0; m < mediumCount; m++) {
            if (this._freeTop < 0) break;
            const idx = this._freeStack[this._freeTop--];
            
            // mniejszy spread ±6°
            const a = Phaser.Math.DegToRad(angleDeg + Phaser.Math.Between(-6, 6));
            const speed = Phaser.Math.FloatBetween(60, 120);
            this._vx[idx] = Math.cos(a) * speed;
            this._vy[idx] = Math.sin(a) * speed;
            this._px[idx] = x;
            this._py[idx] = y;
            this._life[idx] = 0;
            this._ttl[idx] = Phaser.Math.FloatBetween(500, 900);
            this._scale[idx] = Phaser.Math.FloatBetween(0.04, 0.08);
            this._alpha[idx] = 1.0;
            this._tint[idx] = Phaser.Utils.Array.GetRandom(this.COLORS);
            
            const sp = this._sprites[idx];
            sp.setVisible(true);
            sp.x = x;
            sp.y = y;
            sp.scaleX = sp.scaleY = this._scale[idx];
            sp.alpha = 1.0;
            sp.setTint(this._tint[idx]);
            sp.setBlendMode(Phaser.BlendModes.MULTIPLY);
            this._alive++;
        }
        
        // --- LARGE particle (okazjonalny puff = duża chmurka / TODO: strzał z rury (audio)) ---
        if (Phaser.Math.Between(0, 100) < 20 && this._freeTop >= 0) {
            const idx = this._freeStack[this._freeTop--];
            // większy spread ±10°
            const a = Phaser.Math.DegToRad(angleDeg + Phaser.Math.Between(-10, 10));
            const speed = Phaser.Math.FloatBetween(20, 60);
            this._vx[idx] = Math.cos(a) * speed;
            this._vy[idx] = Math.sin(a) * speed;
            this._px[idx] = x;
            this._py[idx] = y;
            this._life[idx] = 0;
            this._ttl[idx] = Phaser.Math.FloatBetween(900, 1400);
            this._scale[idx] = Phaser.Math.FloatBetween(0.08, 0.18);
            this._alpha[idx] = 1.0;
            this._tint[idx] = Phaser.Utils.Array.GetRandom(this.COLORS);
            
            const sp = this._sprites[idx];
            sp.setVisible(true);
            sp.x = x;
            sp.y = y;
            sp.scaleX = sp.scaleY = this._scale[idx];
            sp.alpha = 1.0;
            sp.setTint(this._tint[idx]);
            sp.setBlendMode(Phaser.BlendModes.MULTIPLY);
            this._alive++;
        }
    }
    
    update(dt) {
        if (this._alive === 0) return; // nic aktywnego -> szybkie wyjście
        
        // iterujemy po wszystkich slotach (prostsze i często szybsze niż dynamiczna lista)
        for (let i = 0; i < this._pCount; i++) {
            const ttl = this._ttl[i];
            if (ttl <= 0) continue; // slot wolny -> pomiń
            
            // zwiększ czas życia
            const life = this._life[i] + dt;
            
            // jeśli przekroczono TTL -> zakończ cząstkę i zwróć slot do puli
            if (life >= ttl) {
                this._ttl[i] = 0;
                this._life[i] = 0;
                this._vx[i] = 0;
                this._vy[i] = 0;
                const sp = this._sprites[i];
                sp.setVisible(false); // ukryj sprite
                sp.x = -1000;
                sp.y = -1000; // przenieś poza ekran (opcjonalne)
                this._freeStack[++this._freeTop] = i; // push z powrotem na stos wolnych
                this._alive--;
                continue;
            }
            
            // integracja pozycji (Euler forward). dt/1000 -> konwersja ms -> s
            const vx = this._vx[i];
            const vy = this._vy[i];
            const px = this._px[i] + vx * (dt / 1000);
            const py = this._py[i] + vy * (dt / 1000);
            this._px[i] = px;
            this._py[i] = py;
            this._life[i] = life;
            
            // progres życia 0..1
            const t = life / ttl;
            
            // prosty wzrost skali i liniowe zanikanie alpha
            const s0 = this._scale[i];
            const s = s0 + t * (s0 * 1.6); // rośnie do ~2.6*s0
            const a = 1.0 - t; // liniowe zanikanie
            
            // aktualizacja sprite (bez wywołań setPosition/setScale/setAlpha dla wydajności)
            const sp = this._sprites[i];
            sp.x = px;
            sp.y = py;
            sp.scaleX = sp.scaleY = s;
            sp.alpha = a;
            // tint ustawiony przy emisji — nie zmieniamy go w update (kosztowne)
        }
    }
}

