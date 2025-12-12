export class AudioService {
    constructor(scene) {
        this.scene = scene;
        this.sounds = {};
        this.musicOn = false;

        // Wewnętrzny stan do zarządzania dźwiękiem silnika
        this.maxPitch = 0.5;
        this.minPitch = 0.0;
        this.pitch = 0.0;
        this.isThrottle = false;

        // konfiguracja progu i ograniczeń
        this.MAX_SPEED = 450;        // na sztywno, potem podmienisz
        this.RPM_SWITCH_UP = 0.95;   // próg przełączenia na race_max (95% prędkości)
        this.RPM_SWITCH_DOWN = 0.90; // próg powrotu na race (90% prędkości)
        this.MAX_RATE = 1.6;         // limit dla race_max
        this.RATE_BASE = 0.8;        // bazowe RPM
    }

    preload() {
        this.scene.load.audio('applause', 'assets/audio/game_applause.mp3');
        this.scene.load.audio('idle', 'assets/audio/game_idle.mp3');
        this.scene.load.audio('off', 'assets/audio/game_off.mp3');
        this.scene.load.audio('on', 'assets/audio/game_on.mp3');
        this.scene.load.audio('race', 'assets/audio/game_race.wav');
        this.scene.load.audio('race_max', 'assets/audio/game_race.wav');
        this.scene.load.audio('slide', 'assets/audio/game_slide.mp3');
        this.scene.load.audio('countdown', 'assets/audio/game_countdown.mp3');
        this.scene.load.audio('game_music', 'assets/audio/game_music.mp3');
        this.scene.load.audio('game_crash', 'assets/audio/game_crash.mp3');
        this.scene.load.audio('ambience', 'assets/audio/game_ambience.mp3');
    }

    create() {
        if (!this.scene.registry.get('audioEnabled')) {
            console.log('Muting audio as per registry setting');
            this.scene.sound.mute = true;
        }

        this.musicOn = !this.scene.sound.mute;

        if (this.musicOn) {
            this.sounds.idle = this.scene.sound.add('idle', { volume: 0.5, loop: true });
            this.sounds.applause = this.scene.sound.add('applause', { volume: 1.0 });
            this.sounds.off = this.scene.sound.add('off', { volume: 0.6 });
            this.sounds.on = this.scene.sound.add('on', { volume: 0.6 });
            this.sounds.race = this.scene.sound.add('race', { volume: 0.5, rate: 0.7, loop: true });
            this.sounds.race_max = this.scene.sound.add('race_max', { volume: 0.5, rate: 1.3, loop: true });
            this.sounds.slide = this.scene.sound.add('slide', { volume: 0.7 });
            this.sounds.countdownSound = this.scene.sound.add('countdown', { volume: 0.8 });
            this.sounds.music = this.scene.sound.add('game_music', { volume: 0.8, loop: true });
            this.sounds.crash = this.scene.sound.add('game_crash', { volume: 1.1 });
            this.sounds.ambience = this.scene.sound.add('ambience', { volume: 1, loop: true });
        }
    }

    update(dt, state) {
        if (this.scene.sound.mute) return;

        const { control, countdownWasActive, raceFinished, carController, aiController, skidMarksSystem, gameMode } = state;

        if (countdownWasActive) {
            if (!this.sounds.idle.isPlaying && !this.sounds.countdownSound.isPlaying && !this.sounds.ambience.isPlaying) {
                this.sounds.countdownSound.play();
                this.sounds.ambience.play();
                this.sounds.idle.play();
                gameMode === "RACE" ? this.sounds.music.play() : this.sounds.music.stop();
            }
            return;
        }

        const boom = carController.collisionCount > 0;
        const AIboom = aiController ? aiController.collisionCount > 0 : null;
        if ((AIboom || boom) && !this.sounds.crash.isPlaying) {
            this.sounds.crash.play();
        }

        if (raceFinished) {
            if (this.sounds.race.isPlaying && (!control.up || !control.down)) {
                this.sounds.race.stop();
                this.sounds.music.stop();
                if (!this.sounds.idle.isPlaying) {
                    this.sounds.off.play();
                    this.scene.time.delayedCall(700, () => {
                        this.sounds.idle.play();
                        this.sounds.ambience.play();
                    });
                }
            }
        }

        const wheelSlip = carController.getWheelSlip([0, 2]);
        const isBurnout = skidMarksSystem._list[0].skidMarks.burnoutDrawing[0] === true;

        if (!this.sounds.slide.isPlaying && (wheelSlip >= 0.3 || isBurnout)) {
            this.sounds.slide.play();
        } else if (this.sounds.slide.isPlaying && !(wheelSlip >= 0.3 || isBurnout)) {
            this.sounds.slide.stop();
        }

        // --- SILNIK: pitch zależny od prędkości ---
        if (this.sounds.race.isPlaying || this.sounds.race_max.isPlaying) {
            const throttleActive = (control.up || control.down || carController.throttle !== 0);
            const currentSpeed = Math.abs(carController.getLocalSpeed());
            const speedRatio = currentSpeed / this.MAX_SPEED;

            // pitch = funkcja prędkości
            this.pitch = Phaser.Math.Clamp(speedRatio * this.maxPitch, this.minPitch, this.maxPitch);
            const targetRate = this.RATE_BASE + this.pitch;

            // przełączanie między race i race_max
            if (this.sounds.race.isPlaying && throttleActive && speedRatio >= this.RPM_SWITCH_UP) {
                this.sounds.race.pause();
                this.sounds.race_max.play();
                this.sounds.race_max.setRate(Math.min(targetRate, this.MAX_RATE));
            } else if (this.sounds.race_max.isPlaying && (!throttleActive || speedRatio < this.RPM_SWITCH_DOWN)) {
                this.sounds.race_max.stop();
                this.sounds.race.play();
                this.sounds.race.setRate(targetRate);
            } else {
                if (this.sounds.race_max.isPlaying) {
                    this.sounds.race_max.setRate(Math.min(targetRate, this.MAX_RATE));
                } else if (this.sounds.race.isPlaying) {
                    this.sounds.race.setRate(targetRate);
                }
            }
        }

        // start silnika
        if ((control.up || control.down) && !this.sounds.on.isPlaying && !this.sounds.race.isPlaying && !this.sounds.race_max.isPlaying && carController.throttleLock === false) {
            this.sounds.on.play();
            this.scene.time.delayedCall(672, () => {
                this.sounds.race.play();
                this.sounds.race.setRate(this.RATE_BASE + this.minPitch);
                this.sounds.ambience.pause();
                this.sounds.idle.stop();
                this.sounds.on.stop();
            });
        }

        // wygaszanie przy puszczeniu gazu
        if (!control.up && !control.down && carController.throttleLock === false) {
            if (this.sounds.race_max.isPlaying) {
                this.sounds.race_max.stop();
                this.sounds.race.resume();
            }
            if (this.sounds.race.isPlaying && this.sounds.race.rate < (this.RATE_BASE + 0.001)) {
                this.sounds.race.stop();
                if (!this.sounds.idle.isPlaying) {
                    this.sounds.off.play();
                    this.scene.time.delayedCall(800, () => {
                        this.sounds.idle.play();
                        this.sounds.ambience.resume();
                    });
                }
            }
        }

        if (carController.throttleLock === true) {
            this.sounds.race.stop();
            this.sounds.race_max.stop();
            this.pitch = 0.0;
            if (!this.sounds.idle.isPlaying && !this.sounds.off.isPlaying) {
                this.sounds.off.play();
                this.scene.time.delayedCall(800, () => {
                    this.sounds.idle.play();
                    this.sounds.ambience.resume();
                });
            }
        }
    }

    playApplause() {
        if (this.musicOn && this.sounds.applause && !this.sounds.applause.isPlaying) {
            this.sounds.applause.play();
        }
    }

    reset() {
        if (this.musicOn) {
            this.sounds.music?.isPlaying && this.sounds.music.stop();
            // this.sounds.ambience?.isPlaying && this.sounds.ambience.stop();
            // this.sounds.idle?.isPlaying && this.sounds.idle.stop();
            this.pitch = 0.0;
            if (this.sounds.race) {
                this.sounds.race.setRate(1.0);
                this.sounds.race.stop();
            }
            this.sounds.race_max?.stop();
            this.sounds.countdownSound?.play();
            this.scene.gameMode === "RACE" && this.sounds.music?.play();
        }
    }

}