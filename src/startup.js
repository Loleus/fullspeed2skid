import { handleGyroPermission } from "./gyro-handler.js";

async function waitForFonts() {
  if (document.fonts) {
    await document.fonts.load('24px "punk_kid"');
    await document.fonts.load("40px skid");
    await document.fonts.load("50px Stormfaze");
    await document.fonts.ready;
  }
}

function startGameNormally() {
  const observer = new MutationObserver(() => {
    document.querySelectorAll("canvas").forEach((c) => {
      if (!c.id || c.id !== "phaser-canvas") {
        c.id = "phaser-canvas";
      }
      c.addEventListener("contextmenu", function (event) {
        event.preventDefault();
      });
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });

  const script = document.createElement("script");
  script.type = "module";
  script.src = "src/main.js";
  document.body.appendChild(script);
}

window.addEventListener("DOMContentLoaded", async () => {
  await waitForFonts();

  const installContainer = document.getElementById("install-pwa-container");
  const installBtn = document.getElementById("install-pwa-btn");
  let deferredPrompt = null;

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installContainer.style.display = "block";
    installBtn.onclick = () => {
      installContainer.style.display = "none";
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(() => {
        deferredPrompt = null;
        handleGyroPermission(startGameNormally);
      });
    };
  });

  const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isSafari = () => /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

  if (isIOS() && isSafari() && !window.navigator.standalone) {
    setTimeout(() => {
      document.getElementById("ios-pwa-instruction").style.display = "block";
      document.querySelector(".ios-pwa-close").onclick = function () {
        document.getElementById("ios-pwa-instruction").style.display = "none";
        handleGyroPermission(startGameNormally);
      };
    }, 1200);
  } else {
    if (!installContainer || installContainer.style.display === "none") {
      handleGyroPermission(startGameNormally);
    }
  }
});
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/fullspeed2skid/service-worker.js');
  });
}