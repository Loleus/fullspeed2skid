export function createLogo(scene, menuStyle) {
  const { width, height } = scene.sys.game.canvas;
  const { buttonHeight: h, offsetY: oy } = menuStyle;
  const y = height / 2 + oy - h - 70;

  const text1Glow = scene.add.text(0, 0, 'Full Speed 2', {
    fontFamily: 'skid',
    fontSize: '54px',
    color: '#ae0000ff',
    align: 'center'
  }).setShadow(0, -2, '#ffe5c7ff', 3, false, true);

  const text1Shadow = scene.add.text(0, 0, 'Full Speed 2', {
    fontFamily: 'skid',
    fontSize: '54px',
    color: '#000000ff',
    align: 'center'
  }).setShadow(3, 4, '#330a00ff', 1, false, true);

  const text2Glow = scene.add.text(0, 0, 'Skid', {
    fontFamily: 'punk_kid',
    fontSize: '80px',
    color: 'rgba(0, 0, 0, 0)',
    align: 'center'
  }).setShadow(3, -3, '#fff1e5ff', 6, false, true);

  const text2Shadow = scene.add.text(0, 0, 'Skid', {
    fontFamily: 'punk_kid',
    fontSize: '80px',
    color: 'rgba(0, 0, 0, 1)',
    align: 'center'
  }).setShadow(-3, 3, '#c2b0abff', 1, false, true);

  const totalTitleWidth = text1Shadow.width + text2Shadow.width;
  const startX = width / 2 - totalTitleWidth / 2;

  text1Shadow.setPosition(startX, y).setOrigin(0, 0.5);
  text1Glow.setPosition(startX, y).setOrigin(0, 0.5);

  const offsetY = (text1Shadow.height - text2Shadow.height) / 2 - 60;
  const text2X = startX + text1Shadow.width + 30;
  const text2Y = y + offsetY;

  text2Shadow.setPosition(text2X, text2Y).setOrigin(0, 0.5);
  text2Glow.setPosition(text2X, text2Y).setOrigin(0, 0.5);

  // Ustaw głębokość
  text1Shadow.setDepth(2);
  text1Glow.setDepth(3);
  text2Shadow.setDepth(2);
  text2Glow.setDepth(3);

  return {
    text1: text1Shadow,
    text2: text2Shadow,
    text1Glow,
    text2Glow
  };
}
export function destroyLogo(logo) {
  logo?.text1?.destroy();
  logo?.text2?.destroy();
  logo?.text1Glow?.destroy();
  logo?.text2Glow?.destroy();
}