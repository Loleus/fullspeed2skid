// race/HiscoreService.js
import { HiscoreManager } from "../systems/hiscoreManager.js";

export class HiscoreService {
  constructor({ storageKey = 'mygame_hiscores', templatePath = 'assets/levels/hiscores.json', maxEntries = 4 }) {
    this.storageKey = storageKey;
    this.templatePath = templatePath;
    this.maxEntries = maxEntries;
  }
  checked({ trackIndex, lapsTimer }) {
    try {
      const trackNum = (trackIndex || 0) + 1;
      const trackKey = `track${trackNum}`;

      const { total, bestLap } = lapsTimer.getLapTimes();
      const totalTime = Number(total);
      const best = Number(bestLap || 0);

      const mgr = new HiscoreManager({
        storageKey: this.storageKey,
        templatePath: this.templatePath,
        maxEntries: this.maxEntries
      });

      if (window._hiscores?.tracks) {
        mgr.data = JSON.parse(JSON.stringify(window._hiscores));
      }

      const current = mgr.getForTrack(trackKey);
      const qualifies = (current.length < this.maxEntries)
        || totalTime < current[current.length - 1].totalTime
        || (totalTime === current[current.length - 1].totalTime && best < current[current.length - 1].bestLap);

      if (!qualifies) return false;

      return true;
    } catch (e) {
      console.warn('[Hiscore] Failed to process hiscore', e);
      return false;
    }
  }
  tryQualify({ trackIndex, lapsTimer }) {
    try {
      const trackNum = (trackIndex || 0) + 1;
      const trackKey = `track${trackNum}`;

      const { total, bestLap } = lapsTimer.getLapTimes();
      const totalTime = Number(total);
      const best = Number(bestLap || 0);

      const mgr = new HiscoreManager({
        storageKey: this.storageKey,
        templatePath: this.templatePath,
        maxEntries: this.maxEntries
      });

      if (window._hiscores?.tracks) {
        mgr.data = JSON.parse(JSON.stringify(window._hiscores));
      }

      const current = mgr.getForTrack(trackKey);
      const qualifies = (current.length < this.maxEntries)
        || totalTime < current[current.length - 1].totalTime
        || (totalTime === current[current.length - 1].totalTime && best < current[current.length - 1].bestLap);

      if (!qualifies) return false;

      const defaultNick = 'PLAYER';
      const nick = (window.prompt('NEW HISCORE! ENTER YOUR NAME:', defaultNick) || defaultNick)
        .trim().slice(0, 10);
      if (!nick) return false;

      const updated = mgr.addScore(trackKey, { nick, totalTime, bestLap: best });
      window._hiscores = mgr.getAll();
      console.log('[Hiscore] Updated', trackKey, updated);
      return true;
    } catch (e) {
      console.warn('[Hiscore] Failed to process hiscore', e);
      return false;
    }
  }
}