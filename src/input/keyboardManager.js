export function createKeyboardBindings(scene) {
  const keyboard = scene.input.keyboard;

  return {
    cursors: keyboard.createCursorKeys(),
    wasdKeys: keyboard.addKeys({
      up: window.Phaser.Input.Keyboard.KeyCodes.W,
      down: window.Phaser.Input.Keyboard.KeyCodes.S,
      left: window.Phaser.Input.Keyboard.KeyCodes.A,
      right: window.Phaser.Input.Keyboard.KeyCodes.D,
    }),
    vKey: keyboard.addKey(window.Phaser.Input.Keyboard.KeyCodes.V),
    rKey: keyboard.addKey(window.Phaser.Input.Keyboard.KeyCodes.R),
    xKey: keyboard.addKey(window.Phaser.Input.Keyboard.KeyCodes.X),
  };
}
