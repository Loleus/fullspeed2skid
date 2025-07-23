export class MenuScene extends window.Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
    if (!window._tracks) window._tracks = [];
    if (typeof window._selectedTrack !== 'number') window._selectedTrack = 0;
    this.tracks = window._tracks;
    this.selectedTrack = window._selectedTrack;
  }

  async create() {
    const { width, height } = this.sys.game.canvas;
    this.cameras.main.setBackgroundColor('#000');

    if (!this.tracks || this.tracks.length === 0) {
      this.tracks = await this.fetchTracks();
      window._tracks = this.tracks;
    }
    if (this.tracks.length === 0) {
      this.tracks = [{ label: 'TRACK 1', file: 'scene_1.svg' }];
      window._tracks = this.tracks;
    }
    if (typeof this.selectedTrack !== 'number' || this.selectedTrack < 0 || this.selectedTrack >= this.tracks.length) {
      this.selectedTrack = 0;
      window._selectedTrack = 0;
    }

    const buttons = [
      { label: 'START', key: 'start' },
      { label: 'CAR', key: 'car', disabled: true },
      { label: this.tracks[this.selectedTrack].label, key: 'track' },
      { label: 'FULLSCREEN', key: 'fullscreen' }
    ];
    this.menuButtons = [];
    const btnWidth = 300;
    const btnHeight = 60;
    const margin = 10;
    const padding = 8;
    const totalHeight = buttons.length * btnHeight + (buttons.length - 1) * margin;
    const menuOffsetY = 100;
    let y = height / 2 - totalHeight / 2 + menuOffsetY;

    buttons.forEach((btn) => {
      const bg = this.add.rectangle(width / 2, y + btnHeight / 2, btnWidth, btnHeight, 0x444444, btn.disabled ? 0.5 : 1)
        .setStrokeStyle(2, 0x222222).setOrigin(0.5);
      const text = this.add.text(width / 2, y + btnHeight / 2, btn.label, {
        fontFamily: 'Stormfaze',
        fontSize: '24px',
        color: btn.disabled ? '#666' : '#ccc',
        align: 'center',
        padding: { left: padding, right: padding, top: padding, bottom: padding },
      }).setOrigin(0.5);
      if (!btn.disabled) {
        bg.setInteractive({ useHandCursor: true });
        bg.on('pointerdown', () => this.handleButton(btn.key));
        bg.on('pointerover', () => bg.setFillStyle(0x666666, 1));
        bg.on('pointerout', () => bg.setFillStyle(0x444444, 1));
      }
      this.menuButtons.push({ bg, text, key: btn.key });
      y += btnHeight + margin;
    });

    const titleY = height / 2 - totalHeight / 2 - 70;
    const text1 = this.add.text(0, 0, 'Full Speed 2', {
      fontFamily: 'skid',
      fontSize: '40px',
      color: '#f00',
      align: 'center',
    });
    const text2 = this.add.text(0, 0, 'Skid', {
      fontFamily: 'punk_kid',
      fontSize: '70px',
      color: '#ffd',
      align: 'center',
    });
    const totalTitleWidth = text1.width + text2.width;
    const startX = width / 2 - totalTitleWidth / 2;
    text1.setPosition(startX, titleY).setOrigin(0, 0.5);
    const verticalOffset = -60;
    const horizontalOffset = 30;
    text2.setPosition(startX + text1.width + horizontalOffset, titleY + (text1.height - text2.height) / 2 + verticalOffset).setOrigin(0, 0.5);
  }

  async fetchTracks() {
    try {
      const response = await fetch('assets/levels/tracks.json');
      const tracks = await response.json();
      return tracks.filter((t, i, arr) => arr.findIndex(x => x.file === t.file) === i);
    } catch (e) {
      return [
        { label: 'TRACK 1', file: 'scene_1.svg' },
        { label: 'TRACK 2', file: 'scene_2.svg' }
      ];
    }
  }

  handleButton(key) {
    console.log('Klik:', key, 'selectedTrack:', this.selectedTrack);
    if (key === 'start') {
      const isMobile = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop|Mobile/i.test(navigator.userAgent);
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (isMobile && typeof DeviceOrientationEvent?.requestPermission === 'function') {
        this.showGyroPermissionPopup();
        return;
      }
      this.scene.start('LoadingScene', { trackFile: this.tracks[this.selectedTrack].file });
    } else if (key === 'fullscreen') {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        document.body.requestFullscreen();
      }
    } else if (key === 'track') {
      this.selectedTrack = (this.selectedTrack + 1) % this.tracks.length;
      window._selectedTrack = this.selectedTrack;
      const trackBtn = this.menuButtons.find(btn => btn.key === 'track');
      if (trackBtn) {
        trackBtn.text.setText(this.tracks[this.selectedTrack].label);
      }
    }
  }

  showGyroPermissionPopup() {
    const { width, height } = this.sys.game.canvas;
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.8).setDepth(1000);
    const boxWidth = 360;
    const boxHeight = 220;
    const popup = this.add.rectangle(width / 2, height / 2, boxWidth, boxHeight, 0x333333, 1)
      .setStrokeStyle(2, 0xffffff).setDepth(1001);
  
    this.add.text(width / 2, height / 2 - 60, 'Czy zezwalasz na żyroskop?', {
      fontFamily: 'Stormfaze',
      fontSize: '20px',
      color: '#fff',
      align: 'center',
      wordWrap: { width: boxWidth - 40 }
    }).setOrigin(0.5).setDepth(1002);
  
    const allowBtn = this.add.text(width / 2 - 100, height / 2 + 40, 'Zezwól', {
      fontFamily: 'punk_kid',
      fontSize: '24px',
      color: '#0f0',
      backgroundColor: '#222',
      padding: { x: 16, y: 10 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(1002);
  
    const denyBtn = this.add.text(width / 2 + 100, height / 2 + 40, 'Odmów', {
      fontFamily: 'punk_kid',
      fontSize: '24px',
      color: '#f33',
      backgroundColor: '#222',
      padding: { x: 16, y: 10 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(1002);
  
    allowBtn.on('pointerdown', async () => {
      if (typeof DeviceOrientationEvent?.requestPermission !== 'function') {
        alert('Twoje urządzenie nie wymaga zgody na dostęp do żyroskopu.');
        overlay.destroy(); popup.destroy(); allowBtn.destroy(); denyBtn.destroy();
        return;
      }
      try {
        const response = await DeviceOrientationEvent.requestPermission();
        if (response === 'granted') {
          this.scene.start('LoadingScene', { trackFile: this.tracks[this.selectedTrack].file });
        } else {
          alert('Dostęp do żyroskopu został odrzucony.');
        }
      } catch (err) {
        console.warn('Błąd przy uzyskiwaniu zgody:', err);
        alert('Nie udało się uzyskać zgody na żyroskop.');
      }
      overlay.destroy(); popup.destroy(); allowBtn.destroy(); denyBtn.destroy();
    });
  
    denyBtn.on('pointerdown', () => {
      overlay.destroy(); popup.destroy(); allowBtn.destroy(); denyBtn.destroy();
      alert('Dostęp do żyroskopu nie został przyznany.');
    });
  }
  
}


