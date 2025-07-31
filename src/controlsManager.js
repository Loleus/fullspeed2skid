export function getControlState(scene) {
  let upPressed = scene.cursors.up.isDown || scene.wasdKeys.up.isDown;
  let downPressed = scene.cursors.down.isDown || scene.wasdKeys.down.isDown;
  let leftPressed = scene.cursors.left.isDown || scene.wasdKeys.left.isDown;
  let rightPressed = scene.cursors.right.isDown || scene.wasdKeys.right.isDown;

  if (scene.isMobile()) {
    upPressed = scene.control && scene.control.up;
    downPressed = scene.control && scene.control.down;

    if (window._gyroControl) {
      leftPressed = leftPressed || window._gyroControl.left;
      rightPressed = rightPressed || window._gyroControl.right;
    }

    if (scene.control) {
      leftPressed = leftPressed || scene.control.left;
      rightPressed = rightPressed || scene.control.right;
    }
  }

  return {
    up: !!upPressed,
    down: !!downPressed,
    left: !!leftPressed,
    right: !!rightPressed,
  };
}

