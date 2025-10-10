import { HiscoreOverlay } from './hiscoresOverlay.js';
import { MenuUI } from './menuUI.js';
import { HiscoreManager } from './hiscoreManager.js';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
    this.isOverlayOpen = false;
    this.hiscores = [];
    this.tracks = window._tracks || [];
    this.selectedTrack = window._selectedTrack ?? 0;
    this.gameMode = window._gameMode || 'PRACTICE';
    this.handleMenuButton = this.handleButton.bind(this);
    this.hiscoreManager = new HiscoreManager({
      storageKey: 'mygame_hiscores',
      templatePath: 'assets/levels/hiscores.json',
      maxEntries: 4
    });
  }

  async create() {
    try {
      const data = await this.hiscoreManager.init();
      this.hiscores = data;
      window._hiscores = this.hiscores;
    } catch (e) {
      console.warn('Nie udało się zainicjalizować HiscoreManager', e);
      this.hiscores = { tracks: {} };
      window._hiscores = this.hiscores;
    }

    // Dodaj tło jeśli tekstura jest załadowana
    const { width, height } = this.sys.game.canvas;
    if (this.textures.exists('bgc')) {
      const bg = this.add.image(0, 0, 'bgc').setOrigin(0, 0);
      bg.setDisplaySize(width, height);
      bg.setScrollFactor(0);
      bg.setDepth(-1000); // bardzo nisko, żeby UI było nad tłem
    } else {
      // jeśli tekstura nie istnieje, unikamy wywołania add.image (zapobiega zielonym placeholderom)
      console.warn('[MenuScene] Tekstura bgc nie jest dostępna w Texture Manager - tło nie zostanie dodane');
    }

    this.ui = new MenuUI(this);
    this.hiscoreOverlay = new HiscoreOverlay(this);

    // UI może mieć własne tło; jeśli MenuUI.createBackground tworzy placeholdery,
    // upewnij się że nie generuje TileSprite z tym samym kluczem co bgc.
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
    window._hiscores = this.hiscores;
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
