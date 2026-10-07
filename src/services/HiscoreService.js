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

  // tryQualify({ trackIndex, lapsTimer }) {
  //   try {
  //     const trackNum = (trackIndex || 0) + 1;
  //     const trackKey = `track${trackNum}`;

  //     const { total, bestLap } = lapsTimer.getLapTimes();
  //     const totalTime = Number(total);
  //     const best = Number(bestLap || 0);

  //     const mgr = new HiscoreManager({
  //       storageKey: this.storageKey,
  //       templatePath: this.templatePath,
  //       maxEntries: this.maxEntries
  //     });

  //     if (window._hiscores?.tracks) {
  //       mgr.data = JSON.parse(JSON.stringify(window._hiscores));
  //     }

  //     const current = mgr.getForTrack(trackKey);
  //     const qualifies = (current.length < this.maxEntries)
  //       || totalTime < current[current.length - 1].totalTime
  //       || (totalTime === current[current.length - 1].totalTime && best < current[current.length - 1].bestLap);

  //     if (!qualifies) return false;

  //     const defaultNick = 'PLAYER';
  //     const nick = (window.prompt('NEW HISCORE! ENTER YOUR NAME:', defaultNick) || defaultNick)
  //       .trim().slice(0, 8);
  //     if (!nick) return false;

  //     const updated = mgr.addScore(trackKey, { nick, totalTime, bestLap: best });
  //     window._hiscores = mgr.getAll();
  //     console.log('[Hiscore] Updated', trackKey, updated);
  //     return true;
  //   } catch (e) {
  //     console.warn('[Hiscore] Failed to process hiscore', e);
  //     return false;
  //   }
  // }

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

      // Zamiastu window.prompt() - zwróć Promise
      return new Promise((resolve) => {
        this.showNameModal((nick) => {
          if (!nick) {
            resolve(false);
            return;
          }

          const updated = mgr.addScore(trackKey, { nick, totalTime, bestLap: best });
          window._hiscores = mgr.getAll();
          console.log('[Hiscore] Updated', trackKey, updated);
          resolve(true);
        });
      });
    } catch (e) {
      console.warn('[Hiscore] Failed to process hiscore', e);
      return false;
    }
  }

  showNameModal(callback) {
    const defaultNick = 'PLAYER';
    const modal = document.createElement('div');
    modal.id = 'hiscore-modal';
    modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    font-family: Arial, sans-serif;
  `;

    modal.innerHTML = `
    <div style="background: white; padding: 30px; border-radius: 8px; text-align: center; box-shadow: 0 4px 6px rgba(0,0,0,0.3);">
      <h2 style="margin: 0 0 20px 0; color: #333;">NEW HISCORE!</h2>
      <p style="margin: 0 0 15px 0; color: #666;">Enter your name:</p>
      <input type="text" id="nick-input" value="${defaultNick}" maxlength="8" 
        style="width: 200px; padding: 10px; font-size: 16px; margin-bottom: 20px; border: 2px solid #ddd; border-radius: 4px;">
      <div>
        <button id="confirm-btn" style="padding: 10px 20px; margin-right: 10px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">OK</button>
        <button id="cancel-btn" style="padding: 10px 20px; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer;">Cancel</button>
      </div>
    </div>
  `;

    document.body.appendChild(modal);

    const input = modal.querySelector('#nick-input');
    const confirmBtn = modal.querySelector('#confirm-btn');
    const cancelBtn = modal.querySelector('#cancel-btn');

    const cleanup = () => {
      modal.remove();
    };

    const handleConfirm = () => {
      const nick = input.value.trim() || defaultNick;
      cleanup();
      callback(nick);
    };

    confirmBtn.addEventListener('click', handleConfirm);
    cancelBtn.addEventListener('click', () => {
      cleanup();
      callback(null);
    });

    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleConfirm();
    });

    input.focus();
  }
}