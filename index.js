   // =========================
    // --- USTAWIENIA GLOBALNE
    // =========================
    const W = 720, H = 520;
    let POP_SIZE = 100; // Rozmiar populacji - kluczowy parametr genetyczny
    let DNA_LEN = 300;
    let MUT_RATE = 0.05; // Współczynnik mutacji (prawdopodobieństwo mutacji genu)
    let ELITE_COUNT = 5; // Liczba elitarnych osobników (przechodzą bez zmian)
    let CROSSOVER_RATE = 1.0; // Współczynnik krzyżowania - kluczowy parametr genetyczny
    let TOURNAMENT_SIZE = 5; // Rozmiar turnieju dla selekcji turniejowej

    const start = { x: 50, y: H - 50 };
    const goal  = { x: W - 70, y: 60, r: 18 };

    // Canvas
    const cv = document.getElementById('cv');
    const ctx = cv.getContext('2d');

    // Offscreen canvas for incremental trails drawing (redukuje koszt rysowania wielu tras co klatkę)
    const trailsBuf = document.createElement('canvas');
    trailsBuf.width = W; trailsBuf.height = H;
    const tctx = trailsBuf.getContext('2d');
    tctx.lineCap = 'round';
    tctx.lineJoin = 'round';
    tctx.globalCompositeOperation = 'source-over';

    // UI
    const genEl = document.getElementById('gen');
    const popEl = document.getElementById('pop');
    const bestEl = document.getElementById('best');
    const avgEl = document.getElementById('avg');
    const diversityEl = document.getElementById('diversity');
    const dnaLenEl = document.getElementById('dnaLen');
    const dnaLenValEl = document.getElementById('dnaLenVal');
    const mutRateEl = document.getElementById('mutRate');
    const mutRateValEl = document.getElementById('mutRateVal');
    const eliteEl = document.getElementById('elite');
    const eliteValEl = document.getElementById('eliteVal');
    const popSizeEl = document.getElementById('popSize');
    const popSizeValEl = document.getElementById('popSizeVal');
    const crossoverRateEl = document.getElementById('crossoverRate');
    const crossoverRateValEl = document.getElementById('crossoverRateVal');
    const tournamentSizeEl = document.getElementById('tournamentSize');
    const tournamentSizeValEl = document.getElementById('tournamentSizeVal');
    const btnRestart = document.getElementById('restart');
    const btnPause = document.getElementById('pause');
    const selMethodEl = document.getElementById('selMethod');
    const showTrailsEl = document.getElementById('showTrails');

    /**
     * Waliduje i normalizuje wartość parametru genetycznego
     * @param {number} value - Wartość do walidacji
     * @param {number} min - Minimalna dozwolona wartość
     * @param {number} max - Maksymalna dozwolona wartość
     * @param {number} defaultValue - Wartość domyślna w przypadku błędu
     * @returns {number} Zwalidowana wartość
     */
    function validateParam(value, min, max, defaultValue) {
      const num = Number(value);
      if (isNaN(num) || num < min || num > max) return defaultValue;
      return num;
    }

    // Obsługa UI z walidacją
    dnaLenEl.oninput = () => { 
      DNA_LEN = validateParam(dnaLenEl.value, 10, 1000, 300);
      dnaLenEl.value = DNA_LEN;
      dnaLenValEl.textContent = DNA_LEN; 
      resetPopulation(); 
    };
    mutRateEl.oninput = () => { 
      MUT_RATE = validateParam(mutRateEl.value / 100, 0, 1, 0.05);
      mutRateEl.value = Math.round(MUT_RATE * 100);
      mutRateValEl.textContent = Math.round(MUT_RATE*100) + '%'; 
    };
    eliteEl.oninput = () => { 
      ELITE_COUNT = validateParam(eliteEl.value, 0, Math.floor(POP_SIZE/2), 5);
      eliteEl.value = ELITE_COUNT;
      eliteValEl.textContent = ELITE_COUNT; 
    };
    popSizeEl.oninput = () => {
      POP_SIZE = validateParam(popSizeEl.value, 10, 500, 100);
      popSizeEl.value = POP_SIZE;
      popSizeValEl.textContent = POP_SIZE;
      // Aktualizuj maksymalną wartość elity
      eliteEl.max = Math.floor(POP_SIZE/2);
      if (ELITE_COUNT > POP_SIZE/2) {
        ELITE_COUNT = Math.floor(POP_SIZE/2);
        eliteEl.value = ELITE_COUNT;
        eliteValEl.textContent = ELITE_COUNT;
      }
      resetPopulation();
    };
    crossoverRateEl.oninput = () => {
      CROSSOVER_RATE = validateParam(crossoverRateEl.value / 100, 0, 1, 1.0);
      crossoverRateEl.value = Math.round(CROSSOVER_RATE * 100);
      crossoverRateValEl.textContent = Math.round(CROSSOVER_RATE*100) + '%';
    };
    tournamentSizeEl.oninput = () => {
      TOURNAMENT_SIZE = validateParam(tournamentSizeEl.value, 2, 20, 5);
      tournamentSizeEl.value = TOURNAMENT_SIZE;
      tournamentSizeValEl.textContent = TOURNAMENT_SIZE;
    };
    btnRestart.onclick = () => resetPopulation(true);
    let paused = false;
    btnPause.onclick = () => { paused = !paused; btnPause.textContent = paused ? 'Wznów' : 'Pauza'; };

    popEl.textContent = POP_SIZE;

    // =========================
    // --- LABIRYNT (ściany)
    // =========================
    const walls = [
        // ramki zewnętrzne
        {x: 0, y: 0, w: W, h: 20},
        {x: 0, y: H-20, w: W, h: 20},
        {x: 0, y: 0, w: 20, h: H},
        {x: W-20, y: 0, w: 20, h: H},
      
        // U dolne (normalne)
        {x: 200, y: 250, w: 20, h: 150},   // lewa pionowa
        {x: 200, y: 400, w: 200, h: 20},   // dolna belka
        {x: 380, y: 150, w: 20, h: 250},   // prawa pionowa (wydłużona o 100 px w górę)
      
        // U górne (odwrócone, tej samej wielkości)
        {x: 320, y: 100, w: 20, h: 150},   // lewa pionowa
        {x: 320, y: 100, w: 200, h: 20},   // górna belka
        {x: 500, y: 100, w: 20, h: 250},   // prawa pionowa (wydłużona o 100 px w dół)
      ];
      
      

    function drawMaze() {
      // tło
      ctx.fillStyle = '#222';
      ctx.fillRect(0,0,W,H);

      // cel
      ctx.beginPath();
      ctx.fillStyle = '#2ecc71';
      ctx.arc(goal.x, goal.y, goal.r, 0, Math.PI*2);
      ctx.fill();

      // start
      ctx.beginPath();
      ctx.fillStyle = '#3498db';
      ctx.arc(start.x, start.y, 6, 0, Math.PI*2);
      ctx.fill();

      // ściany
      ctx.fillStyle = '#777';
      for (const w of walls) ctx.fillRect(w.x, w.y, w.w, w.h);
    }

    /**
     * Sprawdza kolizję okrąg-prostokąt (aproksymacja)
     * Używa metody najbliższego punktu: znajduje najbliższy punkt prostokąta do środka okręgu
     * @param {number} x - Współrzędna X środka okręgu
     * @param {number} y - Współrzędna Y środka okręgu
     * @param {number} r - Promień okręgu (domyślnie 3)
     * @returns {boolean} True jeśli występuje kolizja
     */
    function collides(x, y, r=3) {
      // Sprawdź kolizję ze wszystkimi ścianami
      for (const w of walls) {
        // Znajdź najbliższy punkt prostokąta do środka okręgu
        const nearestX = Math.max(w.x, Math.min(x, w.x + w.w));
        const nearestY = Math.max(w.y, Math.min(y, w.y + w.h));
        // Oblicz odległość od najbliższego punktu
        const dx = x - nearestX;
        const dy = y - nearestY;
        // Kolizja jeśli odległość <= promień
        if (dx*dx + dy*dy <= r*r) return true;
      }
      // Ramy canvasa traktujemy jak ściany (margines 20px)
      if (x < 20+r || x > W-20-r || y < 20+r || y > H-20-r) return true;
      return false;
    }

    // =========================
    // --- AGENT (z DNA i śladem)
    // =========================
    /**
     * Klasa Agent reprezentuje pojedynczego osobnika w populacji
     * Agent ma DNA (zapis ruchów) i może poruszać się w przestrzeni 2D
     * @class
     */
    class Agent {
      /**
       * Tworzy nowego agenta
       * @param {Float32Array|null} dna - DNA agenta (jeśli null, generuje losowe)
       */
      constructor(dna = null) {
        this.x = start.x; this.y = start.y;
        this.dead = false; this.reached = false;
        this.step = 0; this.r = 3; // Promień agenta (dla kolizji)

        // DNA jako Float32Array [dx,dy, dx,dy, ...] - każdy gen to para (dx, dy)
        this.dna = dna ? new Float32Array(dna) : Agent.randomDNA();

        // Trail: prealokowana tablica (DNA_LEN+1) par XY - zapis trajektorii
        this.trail = new Float32Array((DNA_LEN + 1) * 2);
        this.trailLen = 1;
        this.trail[0] = this.x; this.trail[1] = this.y;

        this.fitness = 0; // Fitness zostanie obliczony później
      }

      /**
       * Generuje losowe DNA - każdy gen to losowy wektor prędkości
       * @static
       * @returns {Float32Array} Losowe DNA
       */
      static randomDNA() {
        const out = new Float32Array(DNA_LEN * 2);
        for (let i = 0; i < DNA_LEN; i++) {
          const angle = Math.random() * Math.PI * 2; // Losowy kąt [0, 2π]
          const speed = 1.6; // Stała prędkość
          out[i*2] = Math.cos(angle) * speed;     // dx
          out[i*2+1] = Math.sin(angle) * speed;   // dy
        }
        return out;
      }

      /**
       * Aktualizuje pozycję agenta na podstawie DNA
       * Wykonuje jeden krok ruchu zgodnie z aktualnym genem DNA
       */
      update() {
        if (this.dead || this.reached) return;
        if (this.step >= DNA_LEN) { 
          this.dead = true; // Wyczerpał DNA
          return; 
        }

        const idx = this.step * 2;
        const dx = this.dna[idx];
        const dy = this.dna[idx + 1];
        this.step++;
        const nx = this.x + dx;
        const ny = this.y + dy;

        // Sprawdzenie kolizji ze ścianami
        if (collides(nx, ny, this.r)) {
          this.dead = true;
          // Zapisz punkt kolizji do trajektorii
          if (this.trailLen * 2 + 1 < this.trail.length) {
            this.trail[this.trailLen*2] = nx; 
            this.trail[this.trailLen*2 + 1] = ny; 
            this.trailLen++;
          }
          return;
        }

        // Rysujemy segment do bufora z lekkim wygładzeniem (quadratic curve)
        if (showTrailsEl.checked) {
          const px = this.x, py = this.y;
          tctx.save();
          tctx.globalAlpha = 0.06;
          tctx.strokeStyle = '#ddd';
          tctx.lineWidth = 1;
          tctx.beginPath();
          tctx.moveTo(px, py);
          // Proste wygładzenie: quadratic curve do środka
          const mx = (px + nx) * 0.5, my = (py + ny) * 0.5;
          tctx.quadraticCurveTo(px, py, mx, my);
          tctx.lineTo(nx, ny);
          tctx.stroke();
          tctx.restore();
        }

        // Aktualizuj pozycję
        this.x = nx; this.y = ny;
        // Zapisz pozycję do trajektorii
        if (this.trailLen * 2 + 1 < this.trail.length) {
          this.trail[this.trailLen*2] = this.x; 
          this.trail[this.trailLen*2 + 1] = this.y; 
          this.trailLen++;
        }

        // Sprawdź czy osiągnął cel
        const ddx = this.x - goal.x, ddy = this.y - goal.y;
        if (ddx*ddx + ddy*ddy <= goal.r*goal.r) this.reached = true;
      }

      /**
       * Oblicza fitness agenta na podstawie odległości od celu i statusu
       * Fitness jest odwrotnie proporcjonalny do odległości (im bliżej celu, tym wyższy fitness)
       * @returns {number} Wartość fitness (zawsze >= 0)
       */
      computeFitness() {
        const dx = this.x - goal.x; 
        const dy = this.y - goal.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        // Normalizacja: maksymalna możliwa odległość w przestrzeni
        const maxDist = Math.sqrt(W*W + H*H);
        const normalizedDist = dist / maxDist;
        
        // Fitness bazowy: odwrotność odległości (z normalizacją)
        // Używamy funkcji wykładniczej dla lepszej różniczkowalności
        const base = 1 / (normalizedDist + 1e-6);
        
        // Bonus za osiągnięcie celu (selekcja pozytywna)
        const bonus = this.reached ? 10 : 0;
        
        // Kary: śmierć (selekcja negatywna) i długość ścieżki
        const survivalPenalty = this.dead ? 0.5 : 1.0;
        const pathEfficiency = this.reached ? 1.0 : Math.max(0.1, 1.0 - (this.step / DNA_LEN) * 0.3);
        
        this.fitness = base * survivalPenalty * pathEfficiency + bonus;
        return this.fitness;
      }

      draw() {
        ctx.beginPath();
        ctx.fillStyle = this.reached ? '#2ecc71' : (this.dead ? '#aa4444' : '#e0e0e0');
        ctx.arc(this.x, this.y, this.r, 0, Math.PI*2);
        ctx.fill();
      }

      drawStoredTrail(alpha = 0.9, color = '#ffd166', width = 2.5) {
        if (this.trailLen < 2) return;
        ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath();
        ctx.moveTo(this.trail[0], this.trail[1]);
        for (let i = 1; i < this.trailLen; i++) ctx.lineTo(this.trail[i*2], this.trail[i*2 + 1]);
        ctx.stroke(); ctx.restore();
      }
    }

    // =========================
    // --- POPULACJA I EWOLUCJA
    // =========================
    let population = [];
    let generation = 0;
    let bestFitness = 0;
    let bestAgentEver = null; // przechowuje najlepszego z całego przebiegu (opcjonalnie)

    /**
     * Resetuje populację do stanu początkowego
     * @param {boolean} hard - Jeśli true, resetuje również numer generacji
     */
    function resetPopulation(hard = false) {
      if (hard) generation = 0;
      population = new Array(POP_SIZE).fill(0).map(() => new Agent());
      bestFitness = 0;
      bestAgentEver = null;
      // Clear trails buffer
      tctx.clearRect(0,0,W,H);
      // Aktualizuj statystyki
      genEl.textContent = generation;
      bestEl.textContent = bestFitness.toFixed(3);
      avgEl.textContent = '0.000';
      diversityEl.textContent = '0%';
    }
    resetPopulation();

    /**
     * Krzyżowanie jednopunktowe (single-point crossover) - klasyczna metoda rekombinacji genetycznej
     * Punkt cięcia wybierany jest na granicy genu (pary dx/dy) aby zachować spójność genetyczną
     * @param {Float32Array} dna1 - DNA pierwszego rodzica
     * @param {Float32Array} dna2 - DNA drugiego rodzica
     * @returns {Float32Array} DNA potomka
     */
    function crossover(dna1, dna2) {
      const len = dna1.length; // 2 * DNA_LEN
      
      // Sprawdzenie zgodności długości DNA rodziców
      if (dna2.length !== len) {
        console.warn('DNA rodziców mają różne długości, używam krótszego');
        const minLen = Math.min(dna1.length, dna2.length);
        const child = new Float32Array(minLen);
        for (let i = 0; i < minLen; i++) child[i] = Math.random() < 0.5 ? dna1[i] : dna2[i];
        return child;
      }
      
      // Wybieramy punkt cięcia na granicy genu (pary dx/dy) - zachowuje spójność genetyczną
      const geneCount = len >> 1;
      const cutGene = Math.floor(Math.random() * (geneCount + 1));
      const cut = cutGene * 2;
      
      const child = new Float32Array(len);
      for (let i = 0; i < len; i++) {
        child[i] = i < cut ? dna1[i] : dna2[i];
      }
      return child;
    }

    /**
     * Mutacja genetyczna - wprowadza losowe zmiany w DNA
     * Mutacja jest kluczowym mechanizmem eksploracji przestrzeni rozwiązań
     * @param {Float32Array} dna - DNA do zmutowania (mutuje in-place)
     */
    function mutate(dna) {
      // dna długość = DNA_LEN * 2
      for (let g = 0; g < DNA_LEN; g++) {
        if (Math.random() < MUT_RATE) {
          const idx = g * 2;
          // Mutacja kąta: losowe odchylenie od obecnego kierunku
          const currentAngle = Math.atan2(dna[idx+1], dna[idx]);
          const angleMutation = (Math.random() * 0.8 - 0.4); // ±0.4 rad ≈ ±23°
          const angle = currentAngle + angleMutation;
          
          // Mutacja prędkości: małe losowe zmiany (10% wariacji)
          const baseSpeed = 1.6;
          const speedMutation = 1 + (Math.random() * 0.2 - 0.1); // ±10%
          const speed = baseSpeed * speedMutation;
          
          // Aktualizacja wektora prędkości
          dna[idx] = Math.cos(angle) * speed;
          dna[idx+1] = Math.sin(angle) * speed;
        }
      }
    }

    // --- METODY SELEKCJI ---
    /**
     * Wybór rodzica zależnie od ustawienia w UI
     * @param {string} method - Metoda selekcji: 'roulette', 'tournament', 'rank'
     * @param {Array<Agent>} population - Populacja agentów
     * @param {number} totalFit - Suma fitnessów (dla ruletki)
     * @returns {Agent} Wybrany rodzic
     */
    function pickParent(method, population, totalFit) {
      if (method === 'roulette') return pickRoulette(population, totalFit);
      if (method === 'tournament') return pickTournament(population, TOURNAMENT_SIZE);
      if (method === 'rank') return pickRank(population);
      return pickRoulette(population, totalFit); // Fallback
    }

    /**
     * Selekcja ruletkowa (roulette wheel selection) - prawdopodobieństwo proporcjonalne do fitnessu
     * Klasyczna metoda selekcji proporcjonalnej, wrażliwa na wartości odstające
     * @param {Array<Agent>} population - Populacja agentów
     * @param {number} totalFit - Suma fitnessów wszystkich agentów
     * @returns {Agent} Wybrany rodzic
     */
    function pickRoulette(population, totalFit) {
      if (population.length === 0) return null;
      // Jeśli totalFit jest bliskie 0 (np. wszyscy mają 0), wybieramy losowo
      if (totalFit <= 0) return population[Math.floor(Math.random() * population.length)];
      const r = Math.random() * totalFit;
      let acc = 0;
      for (const a of population) {
        acc += a.fitness;
        if (acc >= r) return a;
      }
      return population[population.length - 1]; // Fallback
    }

    /**
     * Selekcja turniejowa (tournament selection) - wybiera najlepszego z losowej grupy
     * Mniej wrażliwa na wartości odstające niż ruletka, łatwiejsza do zrównoleglenia
     * @param {Array<Agent>} population - Populacja agentów
     * @param {number} k - Rozmiar turnieju (liczba uczestników)
     * @returns {Agent} Wybrany rodzic
     */
    function pickTournament(population, k = 3) {
      if (population.length === 0) return null;
      if (k > population.length) k = population.length;
      
      let best = null;
      for (let i = 0; i < k; i++) {
        const cand = population[Math.floor(Math.random() * population.length)];
        if (!best || cand.fitness > best.fitness) best = cand;
      }
      return best || population[0]; // Fallback
    }

    /**
     * Selekcja rangowa (rank selection) - sortuje populację i wybiera według rozkładu rangi
     * Redukuje wpływ wartości odstających w fitness, promując różnorodność
     * @param {Array<Agent>} population - Populacja agentów
     * @returns {Agent} Wybrany rodzic
     */
    function pickRank(population) {
      if (population.length === 0) return null;
      // Tworzymy tablicę posortowaną rosnąco (najgorszy -> najlepszy)
      const sorted = [...population].sort((a, b) => a.fitness - b.fitness);
      // Przypisujemy rangi 1..N, ale chcemy większe prawdopodobieństwo dla wyższych rang
      // Używamy prostego rozkładu liniowego: waga = index+1
      const n = sorted.length;
      const totalRank = (n * (n + 1)) / 2; // Suma ciągu arytmetycznego 1+2+...+n
      let r = Math.random() * totalRank;
      let acc = 0;
      for (let i = 0; i < n; i++) {
        acc += (i + 1);
        if (acc >= r) return sorted[i];
      }
      return sorted[n - 1]; // Fallback
    }

    /**
     * Oblicza różnorodność genetyczną populacji (średnia odległość Hamminga między DNA)
     * @param {Array<Agent>} population - Populacja agentów
     * @returns {number} Wartość różnorodności (0-1, gdzie 1 = maksymalna różnorodność)
     */
    function computeDiversity(population) {
      if (population.length < 2) return 0;
      
      let totalDiff = 0;
      let comparisons = 0;
      const sampleSize = Math.min(20, population.length); // Próbkowanie dla wydajności
      
      for (let i = 0; i < sampleSize; i++) {
        for (let j = i + 1; j < sampleSize; j++) {
          const dna1 = population[i].dna;
          const dna2 = population[j].dna;
          let diff = 0;
          const len = Math.min(dna1.length, dna2.length);
          
          for (let k = 0; k < len; k++) {
            const delta = Math.abs(dna1[k] - dna2[k]);
            diff += delta;
          }
          totalDiff += diff / len;
          comparisons++;
        }
      }
      
      return comparisons > 0 ? Math.min(1, totalDiff / comparisons / 3.2) : 0; // Normalizacja
    }

    // --- GŁÓWNA FUNKCJA EWOLUCJI ---
    /**
     * Główna funkcja ewolucji - implementuje jeden cykl algorytmu genetycznego:
     * 1. Ocena fitness (selekcja naturalna)
     * 2. Selekcja rodziców
     * 3. Krzyżowanie (rekombinacja genetyczna)
     * 4. Mutacja
     * 5. Elitaryzm (zachowanie najlepszych)
     */
    function evolve() {
      // Oblicz fitnessy i znajdź najlepszego
      let totalFit = 0;
      let best = null;
      for (const a of population) {
        const f = a.computeFitness();
        totalFit += f;
        if (!best || f > best.fitness) best = a;
      }

      // Oblicz średni fitness
      const avgFitness = totalFit / population.length;

      // Aktualizujemy statystyki
      bestFitness = best.fitness;
      bestEl.textContent = bestFitness.toFixed(3);
      avgEl.textContent = avgFitness.toFixed(3);
      
      // Oblicz różnorodność genetyczną
      const diversity = computeDiversity(population);
      diversityEl.textContent = (diversity * 100).toFixed(1) + '%';
      
      if (!bestAgentEver || bestFitness > bestAgentEver.fitness) {
          // Kopiujemy najlepszego jako "najlepszy w historii" (kopiujemy Float32Array)
          bestAgentEver = new Agent(new Float32Array(best.dna));
          bestAgentEver.trail = best.trail.slice();
          bestAgentEver.trailLen = best.trailLen || 0;
          bestAgentEver.x = best.x; bestAgentEver.y = best.y; bestAgentEver.fitness = best.fitness;
      }

      // Sortujemy populację wg fitness malejąco (przydatne dla elity i rank)
      const sorted = [...population].sort((a, b) => b.fitness - a.fitness);

      // Przygotowujemy nowe pokolenie
      const next = [];

      // Elita: kopiujemy najlepszych bez zmian (chronimy dobre rozwiązania)
      // Elitaryzm jest kluczowy dla stabilności algorytmu
      const actualEliteCount = Math.min(ELITE_COUNT, Math.floor(POP_SIZE / 2));
      for (let i = 0; i < actualEliteCount; i++) {
        // Kopiujemy Float32Array DNA
        const dnaCopy = new Float32Array(sorted[i].dna);
        next.push(new Agent(dnaCopy));
      }

      // Wybieramy metodę selekcji z UI
      const method = selMethodEl.value;

      // Tworzymy potomków aż do osiągnięcia rozmiaru populacji
      while (next.length < POP_SIZE) {
        const p1 = pickParent(method, population, totalFit);
        const p2 = pickParent(method, population, totalFit);
        
        // Krzyżowanie z prawdopodobieństwem CROSSOVER_RATE
        let childDNA;
        if (Math.random() < CROSSOVER_RATE && p1 && p2) {
          childDNA = crossover(p1.dna, p2.dna);
        } else {
          // Jeśli brak krzyżowania, kopiujemy jednego z rodziców
          childDNA = new Float32Array((Math.random() < 0.5 ? p1 : p2).dna);
        }
        
        mutate(childDNA);
        next.push(new Agent(childDNA));
      }

      population = next;
      generation++;
      genEl.textContent = generation;
    }

    // =========================
    // --- PĘTLA SYMULACJI I RYSOWANIA
    // =========================
    let t = 0; // krok w obrębie DNA
    function loop() {
      if (!paused) {
        // symulujemy kolejne kroki DNA (t od 0 do DNA_LEN-1)
        if (t < DNA_LEN) {
          drawMaze();
          // namaluj skumulowane trails z bufora
          if (showTrailsEl.checked) ctx.drawImage(trailsBuf, 0, 0);

          // aktualizujemy i rysujemy agentów
          for (const a of population) {
            a.update();
            a.draw();
          }

          // dodatkowo rysujemy najlepszą trajektorię z poprzedniej generacji grubszą linią
          if (bestAgentEver && bestAgentEver.trailLen > 1) {
            bestAgentEver.drawStoredTrail(0.9, '#ffd166', 2.5);
          }

          t++;
        } else {
          // koniec epoki -> ewolucja
          evolve();

          // resetujemy krok i czyścimy ślady bufora (nowe potomstwo rysuje swoje trails od zera)
          t = 0;
          tctx.clearRect(0,0,W,H);

          // rysujemy stan po ewolucji (można zobaczyć nowe potomstwo)
          drawMaze();
          if (showTrailsEl.checked) ctx.drawImage(trailsBuf, 0, 0);
          for (const a of population) a.draw();
        }
      }

      requestAnimationFrame(loop);
    }
    loop();

    // =========================
    // --- DODATKOWE KOMENTARZE "PO LUDZKU"
    // =========================
    /*
      - Trajektorie (trail) przechowują kolejne pozycje agenta. Dzięki temu możemy narysować
        ścieżkę, którą agent przebył. Rysujemy wszystkie trajektorie półprzezroczyste, a najlepszą
        (najlepszy w historii) grubszą i wyróżnioną, żeby łatwiej zobaczyć "co działa".

      - Metody selekcji:
        * Ruletka (roulette): daje szansę proporcjonalną do fitnessu. Jeśli ktoś ma 2x fitness,
          ma 2x większą szansę zostać rodzicem. Proste, ale wrażliwe na outliery (bardzo dobrych).
        * Turniej (tournament): losujemy k osobników i wybieramy najlepszego. Mniej wrażliwe na
          ekstremalne wartości i łatwe do zrównoleglenia.
        * Ranga (rank): sortujemy po fitness i wybieramy według rangi (np. liniowo). Redukuje
          wpływ bardzo dużych różnic w fitnessie, co pomaga utrzymać różnorodność.

      - Elitaryzm: kopiujemy kilka najlepszych bez zmian, aby nie stracić dobrych rozwiązań przez
        przypadkową mutację. To prosty sposób na stabilizację uczenia.

      - Mutacja i krzyżowanie: krzyżowanie miesza DNA rodziców (tu jednopunktowe), mutacja
        wprowadza losowe zmiany (tu drobne przesunięcie kąta i prędkości). To odpowiada
        rekombinacji i mutacjom w biologii.

      - John H. Holland: w latach 60. i 70. opisał koncepcję algorytmów genetycznych — ideę
        używania mechanizmów podobnych do ewolucji (selekcja, krzyżowanie, mutacja) do
        rozwiązywania problemów optymalizacyjnych. W praktyce algorytmy genetyczne są
        heurystyką: nie gwarantują optymalnego rozwiązania, ale często znajdują dobre rozwiązania
        w złożonych przestrzeniach poszukiwań.
    */