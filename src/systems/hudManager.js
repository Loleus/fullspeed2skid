export function createHUD(scene, isMobile, cameraManager) {
  if (isMobile) {
    const control = {};
    scene.game.events.on("hud-control", (ctrl) => {
      Object.assign(control, ctrl);
      if (ctrl.v) cameraManager.toggle();
      if (ctrl.r) scene.resetGame();
      if (ctrl.x) scene.exitToMenu();
    });
    return control;
  }

  return scene.add
    .text(33, 20, "V - view\nR - reset\nX - exit", {
      fontFamily: "Harting",
      fontSize: "20px",
      fill: "rgb(215, 215, 215)",
      backgroundColor: "rgb(71, 71, 71)",
      padding: { left: 8, right: 8, top: 4, bottom: 4 },
    })
    .setScrollFactor(0)
    .setDepth(100);
}
