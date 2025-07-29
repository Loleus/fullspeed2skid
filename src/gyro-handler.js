// Obsługa żyroskopu na mobile
export function isMobileGyro() {
  return /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop|Mobile/i.test(navigator.userAgent);
}

export function needsGyroPermission() {
  return (
    typeof DeviceOrientationEvent !== "undefined" &&
    typeof DeviceOrientationEvent.requestPermission === "function"
  );
}

export function showGyroPopup() {
  document.getElementById("gyro-permission-popup").style.display = "block";
}

export function hideGyroPopup() {
  document.getElementById("gyro-permission-popup").style.display = "none";
}

export function showGyroBlocked() {
  document.getElementById("gyro-blocked-info").style.display = "block";
}

export function hideGyroBlocked() {
  document.getElementById("gyro-blocked-info").style.display = "none";
}

export async function handleGyroPermission(startGameCallback) {
  if (!isMobileGyro() || !needsGyroPermission()) {
    if (isMobileGyro()) {
      setupGyroEvents();
    }
    startGameCallback();
    return;
  }

  showGyroPopup();

  document.getElementById("gyro-allow-btn").onclick = async function () {
    try {
      const response = await DeviceOrientationEvent.requestPermission();
      if (response === "granted") {
        hideGyroPopup();
        setupGyroEvents();
        startGameCallback();
      } else {
        hideGyroPopup();
        showGyroBlocked();
      }
    } catch (e) {
      hideGyroPopup();
      showGyroBlocked();
    }
  };

  document.getElementById("gyro-deny-btn").onclick = function () {
    hideGyroPopup();
    showGyroBlocked();
  };
}

function setupGyroEvents() {
  window._gyroControl = { left: false, right: false };
  window._gyroCalib = null;
  window.addEventListener("deviceorientation", function (event) {
    if (window._gyroCalib === null) {
      window._gyroCalib = event.beta;
    }
    const tilt = event.beta - window._gyroCalib;
    window._gyroControl.left = tilt > 10;
    window._gyroControl.right = tilt < -10;
  });
}
