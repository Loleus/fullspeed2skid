import { HiscoreOverlay } from './hiscoresOverlay.js';
import { MenuUI } from './menuUI.js';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
    this.isOverlayOpen = false;
    this.tracks = window._tracks || [];
    this.selectedTrack = window._selectedTrack ?? 0;
    this.gameMode = window._gameMode || 'PRACTICE';
    this.handleMenuButton = this.handleButton.bind(this);
  }

  async create() {
    this.ui = new MenuUI(this);
    this.hiscoreOverlay = new HiscoreOverlay(this);

    this.ui.createBackground();
    this.ui.createGradientOverlay();

    if (!this.tracks.length) this.tracks = await this.fetchTracks();
    if (!this.tracks.length) this.tracks = [{ label: 'TRACK 1', file: 'scene_1.svg' }];
    if (this.selectedTrack < 0 || this.selectedTrack >= this.tracks.length) this.selectedTrack = 0;

    const buttons = [
      { label: "MODE\n" + this.gameMode, key: 'mode' },
      { label: "SELECT\n" + this.tracks[this.selectedTrack].label, key: 'track' },
      { label: 'START', key: 'start' },
      { label: 'HI\nSCORES', key: 'hiscore' },
      { label: 'FULL\nSCREEN', key: 'fullscreen' }
    ];

    this.ui.createButtons(buttons, this.handleMenuButton);
    this.ui.createLogo();
  }

  async fetchTracks() {
    try {
      const res = await fetch('assets/levels/tracks.json');
      const data = await res.json();
      return data.filter((t, i, arr) => arr.findIndex(x => x.file === t.file) === i);
    } catch {
      return [
        { label: 'TRACK 1', file: 'scene_1.svg' },
        { label: 'TRACK 2', file: 'scene_2.svg' }
      ];
    }
  }

  async showHiscoreOverlay() {
    await this.hiscoreOverlay.show();
  }

  handleButton(key) {
    if (this.isOverlayOpen) return;
    if (key === 'start') {
      this.scene.start('LoadingScene', {
        trackFile: this.tracks[this.selectedTrack].file,
        gameMode: this.gameMode,
        startFix: this.tracks[this.selectedTrack].startFix
      });
    } else if (key === 'fullscreen') {
      document.fullscreenElement
        ? document.exitFullscreen()
        : document.body.requestFullscreen();
    } else if (key === 'track') {
      this.selectedTrack = (this.selectedTrack + 1) % this.tracks.length;
      window._selectedTrack = this.selectedTrack;
      this.ui.updateButtonText('track', this.tracks[this.selectedTrack].label);
    } else if (key === 'mode') {
      this.gameMode = this.gameMode === 'PRACTICE' ? 'RACE' : 'PRACTICE';
      window._gameMode = this.gameMode;
      this.ui.updateButtonText('mode', this.gameMode);
    } else if (key === 'hiscore') {
      this.showHiscoreOverlay();
    }
  }

  shutdown() {
    if (this.hiscoreOverlay) {
      this.hiscoreOverlay.hide();
    }
    if (this.ui) {
      this.ui.destroy();
    }
    console.log('[MenuScene] Scene shutdown - cleaned up');
  }
}
