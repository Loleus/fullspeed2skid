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
            this.sounds.off = this.scene.sound.add('off', { volume: 0.7 });
            this.sounds.on = this.scene.sound.add('on', { volume: 0.7 });
            this.sounds.race = this.scene.sound.add('race', { volume: 0.7, rate: 1.0, loop: true });
            this.sounds.race_max = this.scene.sound.add('race_max', { volume: 0.6, rate: 1.5, loop: true });
            this.sounds.slide = this.scene.sound.add('slide', { volume: 0.7 });
            this.sounds.countdownSound = this.scene.sound.add('countdown', { volume: 0.8 });
            this.sounds.music = this.scene.sound.add('game_music', { volume: 0.8, loop: true });
            this.sounds.crash = this.scene.sound.add('game_crash', { volume: 1.1 });
            this.sounds.ambience = this.scene.sound.add('ambience', { volume: 1, loop: true });
        }
    }

    update(dt, state) {
        if (this.scene.sound.mute) {
            return;
        }
        
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
        const AIboom = aiController?aiController.collisionCount > 0:null;
        if ((AIboom || boom) && !this.sounds.crash.isPlaying) {
            this.sounds.crash.play();
        } else if ((!AIboom && !boom) && this.sounds.crash.isPlaying) {
            return;
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

        if (this.sounds.slide.isPlaying && (wheelSlip >= 0.3 || isBurnout)) {
            // Already playing, do nothing
        } else if (!this.sounds.slide.isPlaying && (wheelSlip >= 0.3 || isBurnout)) {
            this.sounds.slide.play();
        } else {
            this.sounds.slide.stop();
        }

        if (this.sounds.race.isPlaying) {
            if ((control.up || control.down) && !this.isThrottle) {
                this.isThrottle = true;
            } else if ((!control.up && !control.down) && this.isThrottle) {
                this.isThrottle = false;
            }

            if (this.isThrottle) {
                this.pitch += (Math.abs(carController.getLocalSpeed() / 1000)) * dt;
                if (this.pitch > this.maxPitch) this.pitch = this.maxPitch;
            } else {
                this.pitch -= (Math.abs(carController.getLocalSpeed() / 1000)) * dt;
                if (this.pitch < this.minPitch) this.pitch = this.minPitch;
            }
            this.sounds.race.setRate(1.0 + this.pitch);
        }

        if ((control.up || control.down) && !this.sounds.on.isPlaying && !this.sounds.race.isPlaying && !this.sounds.race_max.isPlaying && carController.throttleLock === false) {
            this.sounds.on.play();
            this.scene.time.delayedCall(672, () => {
                this.sounds.race.play();
                this.sounds.ambience.pause();
                this.sounds.idle.stop();
                this.sounds.on.stop();
            });
        } else if ((control.up || control.down) && this.sounds.race.isPlaying && carController.throttleLock === false) {
            if (this.sounds.race.rate >= 1.49) {
                this.sounds.race.pause();
                this.sounds.race_max.play();
            }
        } else if (!control.up && !control.down && this.sounds.race.isPlaying && carController.throttleLock === false) {
            if (this.sounds.race.rate >= 1.001) {
                return;
            } else if (this.sounds.race.rate < 1.001) {
                this.sounds.race.stop();
                if (!this.sounds.idle.isPlaying && !this.sounds.race.isPlaying) {
                    this.sounds.off.play();
                    this.scene.time.delayedCall(800, () => {
                        this.sounds.idle.play();
                        this.sounds.ambience.resume();
                    });
                }
            }
        } else if (this.sounds.race_max.isPlaying && !control.up && !control.down && carController.throttleLock === false) {
            this.sounds.race_max.stop();
            this.sounds.race.resume();
        } else if (carController.throttleLock === true) {
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
            this.sounds.ambience?.isPlaying && this.sounds.ambience.stop();
            this.sounds.idle?.isPlaying && this.sounds.idle.stop();
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
    
    exitToMenu() {
        if (this.musicOn) {
            this.sounds.music?.isPlaying && this.sounds.music.stop();
            this.sounds.ambience?.isPlaying && this.sounds.ambience.stop();
            this.sounds.idle?.isPlaying && this.sounds.idle.stop();
            this.pitch = 0.0;
            if (this.sounds.race) {
                this.sounds.race.setRate(1.0);
                this.sounds.race.stop();
            }
            this.sounds.race_max?.stop();
            this.sounds.countdownSound?.stop();
        }
    }
}