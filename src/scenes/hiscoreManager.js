// hiscoreManager.js
export class HiscoreManager {
  constructor(options = {}) {
    this.storageKey = options.storageKey || 'mygame_hiscores';
    this.templatePath = options.templatePath || 'assets/levels/hiscores.json';
    this.maxEntries = options.maxEntries || 4;
    this.data = { tracks: {} };
  }

  async init() {
    const saved = localStorage.getItem(this.storageKey);
    if (saved) {
      try {
        this.data = JSON.parse(saved);
        this._normalizeAllPlaces();
        return this.data;
      } catch (e) {
        console.warn('[HiscoreManager] Błąd parsowania localStorage, wczytuję template', e);
        // fallthrough -> load template
      }
    }

    // jeśli nie ma w localStorage lub parse failed -> wczytaj template z pliku
    try {
      const res = await fetch(this.templatePath);
      const tmpl = await res.json();
      this.resetToTemplate(tmpl);
      return this.data;
    } catch (e) {
      console.error('[HiscoreManager] Nie udało się wczytać template hiscores.json', e);
      // fallback: utwórz pustą strukturę
      this.data = { tracks: {} };
      this._save();
      return this.data;
    }
  }

  getAll() {
    return this.data;
  }

  getForTrack(trackKey) {
    if (!this.data.tracks) return [];
    return this.data.tracks[trackKey] ? [...this.data.tracks[trackKey]] : [];
  }

  addScore(trackKey, { nick, totalTime, bestLap }) {
    if (!this.data.tracks) this.data.tracks = {};
    if (!this.data.tracks[trackKey]) this.data.tracks[trackKey] = [];

    const newEntry = {
      place: null,
      nick: String(nick).slice(0, 10),
      totalTime: Number(totalTime),
      bestLap: Number(bestLap)
    };

    // dodaj, posortuj i ogranicz do maxEntries
    const arr = [...this.data.tracks[trackKey], newEntry];

    arr.sort((a, b) => {
      if (a.totalTime !== b.totalTime) return a.totalTime - b.totalTime;
      return a.bestLap - b.bestLap;
    });

    const sliced = arr.slice(0, this.maxEntries);

    // ustaw miejsca (1..n)
    sliced.forEach((e, i) => e.place = i + 1);

    this.data.tracks[trackKey] = sliced;
    this._save();

    return sliced;
  }

  resetToTemplate(templateObj) {
    // templateObj ma strukturę { tracks: { track1: [...], ... } }
    this.data = { tracks: {} };
    if (templateObj && templateObj.tracks) {
      for (const [k, arr] of Object.entries(templateObj.tracks)) {
        // normalizuj pola i licz elementów do maxEntries
        const normalized = (arr || []).slice(0, this.maxEntries).map((item, i) => ({
          place: (i + 1),
          nick: String(item.nick ?? '---').slice(0, 10),
          totalTime: Number(item.totalTime ?? 0),
          bestLap: Number(item.bestLap ?? 0)
        }));
        this.data.tracks[k] = normalized;
      }
    }
    this._save();
  }

  _normalizeAllPlaces() {
    if (!this.data.tracks) return;
    for (const [k, arr] of Object.entries(this.data.tracks)) {
      arr.sort((a, b) => {
        if (a.totalTime !== b.totalTime) return a.totalTime - b.totalTime;
        return a.bestLap - b.bestLap;
      });
      arr.slice(0, this.maxEntries).forEach((e, i) => e.place = i + 1);
      this.data.tracks[k] = arr.slice(0, this.maxEntries);
    }
    this._save();
  }

  _save() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.data));
    } catch (e) {
      console.error('[HiscoreManager] Nie udało się zapisać do localStorage', e);
    }
  }
}
