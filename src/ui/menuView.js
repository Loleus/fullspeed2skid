import { createLogo, destroyLogo } from './menu_logo.js';
import { createButtons, destroyMenuButtons } from './menu_buttons.js';
import { createBackground, createGradientOverlay, destroyBackgroundAssets } from './menu_background.js';
export class MenuUI {
  constructor(scene) {
    this.scene = scene;
    this.menuButtons = [];
    this.gradientState = { stop1: 0.3, stop2: 0.7 };
    this.gradientCanvas = null;
    this.logo = null;

    this.menuStyle = {
      buttonWidth: 230,
      buttonHeight: 160,
      buttonMargin: 0,
      buttonPadding: 30,
      buttonAlpha: 0.65,
      buttonFillColor: Phaser.Display.Color.RGBStringToColor("rgb(63, 94, 1)").color,
      shadowButtonFillColor: Phaser.Display.Color.RGBStringToColor("rgba(0, 0, 0, 1)").color,
      buttonHoverColor: Phaser.Display.Color.RGBStringToColor("rgb(52, 76, 4)").color,
      buttonStrokeColor: Phaser.Display.Color.RGBStringToColor("rgba(38, 57, 0, 1)").color,
      buttonFontSize: '28px',
      buttonFontFamily: 'Harting',
      buttonTextColor: 'rgba(181, 222, 0, 1)',
      buttonDisabledColor: '#666',
      offsetY: 30,
      shadowOffsetDefault: { x: 4, y: 2 },
      shadowOffsetPressed: { x: -2, y: -1 },
      customStartStyle: {
        buttonWidth: 220,
        buttonHeight: 230,
        buttonFillColor: Phaser.Display.Color.RGBStringToColor("rgba(197, 36, 0, 1)").color,
        buttonHoverColor: Phaser.Display.Color.RGBStringToColor("rgb(178, 35, 3)").color,
        buttonStrokeColor: Phaser.Display.Color.RGBStringToColor("rgba(83, 37, 0, 1)").color,
        buttonTextColor: '#fba912ff',
        interactionRadiusOffset: 0,
        buttonFontSize: '58px',
      },
      customMusicStyle: {
        buttonWidth: 110,
        buttonHeight: 110,
        buttonMargin: 0,
        interactionRadiusOffset: 0,
        buttonFontSize: '24px',
        buttonFillColor: Phaser.Display.Color.RGBStringToColor("rgb(8, 114, 144)").color,
        buttonHoverColor: Phaser.Display.Color.RGBStringToColor("rgb(7, 126, 158)").color,
        buttonStrokeColor: Phaser.Display.Color.RGBStringToColor("rgba(0, 69, 83, 1)").color,
        buttonTextColor: '#2adfffff',
        offsetY: 90,
      }
    };
  }

  createBackground() {
    createBackground(this.scene);
  }

  createGradientOverlay() {
    this.gradientCanvas = createGradientOverlay(this.scene, this.gradientState);
  }

  createButtons(buttons, onButtonClick) {
    this.menuButtons = createButtons(this.scene, this.menuStyle, buttons, onButtonClick);
  }

  createLogo() {
    this.logo = createLogo(this.scene, this.menuStyle);
  }

  updateButtonText(key, newText) {
    const btn = this.menuButtons.find(b => b.key === key);
    if (btn && btn.text) {
      key !== "track" ? btn.text.setText("MODE\n" + newText) : btn.text.setText("SELECT\n" + newText);
      key == "music" ? btn.text.setText("SOUND\n" + newText) : null;
    }
  }

  destroy() {

    destroyBackgroundAssets(this.scene);

    destroyMenuButtons(this.menuButtons);
    this.menuButtons = [];

    destroyLogo(this.logo);
    this.logo = null;
  }
}
