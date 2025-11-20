import { HiscoreOverlay } from '../ui/hiscoresOverlay.js';
import { MenuUI } from '../ui/menuView.js';
import { HiscoreManager } from '../systems/hiscoreManager.js';

export class MenuScene extends window.Phaser.Scene {
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

  preload() {
    // Ładuj tekstury
    this.load.atlas('flares', 'assets/images/flares.png', 'assets/images/smoke.json');
    this.load.audio('menu_button', 'assets/audio/menu_button.wav');
    this.load.audio('menu_music', 'assets/audio/menu_music.mp3');
  }

  async create() {

    // const flame = this.add.particles(150, 550, 'flares',
    //   {
    //     frame: 'white',
    //     color: [0xfacc22, 0xf89800, 0xf83600, 0x9f0404],
    //     colorEase: 'quad.out',
    //     lifespan: 2400,
    //     angle: { min: -100, max: -80 },
    //     scale: { start: 0.70, end: 0, ease: 'sine.out' },
    //     speed: 100,
    //     advance: 2000,
    //     blendMode: 'ADD'
    //   });

    // const wisp = this.add.particles(400, 550, 'flares',
    //   {
    //     frame: 'white',
    //     color: [0x96e0da, 0x937ef3],
    //     colorEase: 'quart.out',
    //     lifespan: 1500,
    //     angle: { min: -100, max: -80 },
    //     scale: { start: 1, end: 0, ease: 'sine.in' },
    //     speed: { min: 250, max: 350 },
    //     advance: 2000,
    //     blendMode: 'ADD'
    //   });

    this.buttonClick = this.sound.add('menu_button', { volume: 0.5 });
    this.menuMusic = this.sound.add('menu_music', { volume: 0.8, loop: true });
    this.sound.pauseOnBlur = false; // nie pauzuj na zmianie zakładki
    if (this.registry.get('audioEnabled')) {
      this.menuMusic.play();
    } else {
      this.sound.mute = true;
      this.menuMusic.stop();
    }
    try {
      const data = await this.hiscoreManager.init();
      this.hiscores = data;
      window._hiscores = this.hiscores;
    } catch (e) {
      console.warn('Nie udało się zainicjalizować HiscoreManager', e);
      this.hiscores = { tracks: {} };
      window._hiscores = this.hiscores;
    }
    // Dodaj resztę efektów tła i UI
    const { width, height } = this.sys.game.canvas;
    const flameX = width / 1.4;
    // Efeky dymu
    const smokey = this.add.particles(flameX, 100, 'flares',
      {
        frame: 'black',
        // color: [0x040d61, 0xfacc22, 0xf89800, 0xf83600, 0x9f0404, 0x4b4a4f, 0x353438, 0x040404],
        color: [Phaser.Display.Color.RGBStringToColor("rgba(0, 0, 0, 1)").color, Phaser.Display.Color.RGBStringToColor("rgba(0, 0, 0, 1)").color],
        lifespan: 700,
        angle: { min: -80, max: -100 },
        scale: 0.08,
        speed: { min: 100, max: 130 },
        advance: 100,
        blendMode: 'screen'
      });
    // Tło, jeśli tekstura jest załadowana
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
    const musicState = this.registry.get('audioEnabled') ? "ON" : "OFF";
    if (!this.tracks.length) this.tracks = await this.fetchTracks();
    if (!this.tracks.length) this.tracks = [{ label: 'TRACK 1', file: 'scene_1.svg' }];
    if (this.selectedTrack < 0 || this.selectedTrack >= this.tracks.length) this.selectedTrack = 0;
    this.musicOn = false;
    const buttons = [
      { label: "MODE\n" + this.gameMode, key: 'mode' },
      { label: "SELECT\n" + this.tracks[this.selectedTrack].label, key: 'track' },
      { label: 'START', key: 'start' },
      { label: 'HI\nSCORES', key: 'hiscore' },
      { label: 'FULL\nSCREEN', key: 'fullscreen' },
      { label: 'SOUND\n' + musicState, key: 'music' },
    ];

    this.ui.createButtons(buttons, this.handleMenuButton);
    this.ui.createLogo();
    window._hiscores = this.hiscores;
  }

  async toggleAudio(scene) {
    // Odblokuj Web Audio tylko raz — jeśli jeszcze nieaktywne
    if (this.sound.context.state === 'suspended') {
      await this.sound.context.resume();
    }

    // Przełącz mute
    const nowMuted = !this.sound.mute;
    this.sound.mute = nowMuted;

    // Opcjonalnie: zatrzymaj lub uruchom muzykę
    if (this.menuMusic) {
      if (nowMuted && this.menuMusic.isPlaying) {
        this.menuMusic.stop();
      } else if (!nowMuted && !this.menuMusic.isPlaying) {
        this.menuMusic.play();
      }
    }
    this.registry.set('audioEnabled', !nowMuted);
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
    this.buttonClick.play();
    if (this.isOverlayOpen) return;
    if (key === 'start') {
      this.menuMusic.stop();
      this.scene.start('LoadingScene', {
        trackFile: this.tracks[this.selectedTrack].file,
        gameMode: this.gameMode,
        startFix: this.tracks[this.selectedTrack].startFix
      });
    } else if (key === 'fullscreen') {
      document.fullscreenElement ? document.exitFullscreen() : document.body.requestFullscreen();
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
    } else if (key === 'music') {
      if (window._musicOn !== undefined) {
        this.musicOn = window._musicOn;
      }
      this.toggleAudio(this.scene);
      this.musicOn = !this.musicOn;
      window._musicOn = this.musicOn;
      this.ui.updateButtonText('music', this.musicOn ? 'ON' : 'OFF');
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
