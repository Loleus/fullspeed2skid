// Import funkcji do obsługi uprawnień żyroskopu, np. na urządzeniach mobilnych
import { handleGyroPermission } from "../input/index.js";

// Asynchroniczna funkcja wczytująca czcionki wymagane przez grę
async function waitForFonts() {
  if (document.fonts) {
    await document.fonts.load('24px "punk_kid"');
    await document.fonts.load("40px skid");
    await document.fonts.load("50px Stormfaze");
    await document.fonts.load("50px Harting");
    await document.fonts.ready; // Czekaj aż wszystkie czcionki będą gotowe
  }
}

// Funkcja uruchamiająca grę po spełnieniu wszystkich warunków
function startGameNormally() {
  // Obserwator DOM śledzi dodawanie nowych elementów <canvas> do strony
  const observer = new MutationObserver(() => {
    document.querySelectorAll("canvas").forEach((c) => {
      // Nadawanie identyfikatora, jeśli go nie ma
      if (!c.id || c.id !== "phaser-canvas") {
        c.id = "phaser-canvas";
      }
      // Blokowanie menu kontekstowego (prawy klik)
      c.addEventListener("contextmenu", function (event) {
        event.preventDefault();
      });
    });
  });
  // Obserwuj cały dokument pod kątem dodawania elementów
  observer.observe(document.body, { childList: true, subtree: true });

  import("./main.js");
}

// Poczekaj aż DOM zostanie załadowany
window.addEventListener("DOMContentLoaded", async () => {
  await waitForFonts(); // Wczytaj czcionki

  const isPortalBuild = import.meta.env.MODE === "portal";
  const installContainer = document.getElementById("install-pwa-container");
  const installBtn = document.getElementById("install-pwa-btn");
  let deferredPrompt = null;

  if (!isPortalBuild) {
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
  }

  // Funkcje pomocnicze do wykrywania platformy (iOS/Safari)
  const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isSafari = () => /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

  // Specjalna obsługa dla użytkowników iOS Safari bez trybu standalone
  if (!isPortalBuild && isIOS() && isSafari() && !window.navigator.standalone) {
    setTimeout(() => {
      document.getElementById("ios-pwa-instruction").style.display = "block"; // Pokaż instrukcję PWA dla iOS
      document.querySelector(".ios-pwa-close").onclick = function () {
        document.getElementById("ios-pwa-instruction").style.display = "none"; // Zamknij instrukcję
        handleGyroPermission(startGameNormally); // Uruchom grę po zamknięciu instrukcji
      };
    }, 1200);
  } else {
    // Jeśli nie iOS lub instrukcja niewidoczna — uruchom grę
    if (!installContainer || installContainer.style.display === "none") {
      handleGyroPermission(startGameNormally);
    }
  }
});

// Rejestracja Service Workera — zapewnia cache'owanie, tryb offline itp.
if (import.meta.env.MODE !== "portal" && 'serviceWorker' in navigator) {

  navigator.serviceWorker.addEventListener('message', event => {
    if (event.data.type === 'NEW_VERSION_AVAILABLE') {
      const refresh = confirm('Nowa wersja gry jest dostępna! Odświeżyć teraz?');
      if (refresh && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
        window.location.reload();
      }
    }
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker.register(new URL("service-worker.js", document.baseURI))
      .then(registration => {
        registration.update(); // Wymuś sprawdzenie nowej wersji
      });
  });
}
