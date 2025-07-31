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
    .text(10, 10, "V - zmiana kamery\nR - reset\nX - exit", {
      fontFamily: "Stormfaze",
      fontSize: "20px",
      fill: "#fff",
      backgroundColor: "rgb(31, 31, 31)",
      padding: { left: 8, right: 8, top: 4, bottom: 4 },
    })
    .setScrollFactor(0)
    .setDepth(100);
}
