// countdownManager.js

export class CountdownManager {
    constructor(scene) {
        this.scene = scene;
        this.active = false;
        this.timer = 0;
        this.phase = 0;
        this.text = null;
        this.tween = null;
    }

    start() {
        this.active = true;
        this.timer = 0;
        this.phase = 0;

        this.scene.carController.throttleLock = true;
        if (this.scene.aiController) this.scene.aiController.throttleLock = true;
        if (this.scene.p2Controller) this.scene.p2Controller.throttleLock = true;

        this.showNumber();
    }

    update(dt) {
        if (!this.active) return;

        this.timer += dt;
        if (this.timer >= 1.0) {
            this.phase++;
            this.timer = 0;

            if (this.phase <= 3) {
                this.showNumber();
            } else {
                this.finish();
            }
        }
    }

    isActive() {
        return this.active;
    }

    showNumber() {
        const { width, height } = this.scene.sys.game.canvas;

        if (this.text) {
            this.text.destroy();
            this.text = null;
        }
        if (this.tween) {
            this.tween.stop();
            this.tween = null;
        }

        const displayText = ['3', '2', '1', 'START'][this.phase] || '';
        this.text = this.scene.add.text(width / 2, height / 2, displayText, {
            fontFamily: 'Stormfaze',
            fontSize: '160px',
            color: '#80e12aff',
            align: 'center'
        }).setOrigin(0.5).setDepth(1000).setShadow(3, 3, '#0f0', 4, false, true);

        this.text.setAlpha(0).setScale(0.5);

        this.tween = this.scene.tweens.add({
            targets: this.text,
            alpha: 1,
            scaleX: 1,
            scaleY: 1,
            duration: 200,
            ease: 'Back.easeOut',
            onComplete: () => {
                this.scene.time.delayedCall(300, () => {
                    if (this.text) {
                        this.scene.tweens.add({
                            targets: this.text,
                            alpha: 0,
                            scaleX: 2.5,
                            scaleY: 2.5,
                            duration: 300,
                            ease: 'Power2.easeOut'
                        });
                    }
                });
            }
        });
    }

    finish() {
        if (this.text) this.text.destroy();
        if (this.tween) this.tween.stop();

        this.scene.carController.throttleLock = false;
        if (this.scene.aiController) this.scene.aiController.throttleLock = false;
        if (this.scene.p2Controller) this.scene.p2Controller.throttleLock = false;

        this.active = false;
    }
}
