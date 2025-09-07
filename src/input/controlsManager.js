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

export function getControlStateP1(scene) {
  // WASD jako priorytet dla gracza 1
  let upPressed = scene.wasdKeys?.up?.isDown || false;
  let downPressed = scene.wasdKeys?.down?.isDown || false;
  let leftPressed = scene.wasdKeys?.left?.isDown || false;
  let rightPressed = scene.wasdKeys?.right?.isDown || false;

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

  return { up: !!upPressed, down: !!downPressed, left: !!leftPressed, right: !!rightPressed };
}

export function getControlStateP2(scene) {
  // Strzałki dla gracza 2
  let upPressed = scene.cursors?.up?.isDown || false;
  let downPressed = scene.cursors?.down?.isDown || false;
  let leftPressed = scene.cursors?.left?.isDown || false;
  let rightPressed = scene.cursors?.right?.isDown || false;
  return { up: !!upPressed, down: !!downPressed, left: !!leftPressed, right: !!rightPressed };
}

