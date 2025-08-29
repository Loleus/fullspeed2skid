// Import funkcji do obsługi uprawnień żyroskopu, np. na urządzeniach mobilnych
import { handleGyroPermission } from "../input/gyro-handler.js";

// Asynchroniczna funkcja wczytująca czcionki wymagane przez grę
async function waitForFonts() {
  if (document.fonts) {
    await document.fonts.load('24px "punk_kid"');
    await document.fonts.load("40px skid");
    await document.fonts.load("50px Stormfaze");
    await document.fonts.ready;                   // Czekaj aż wszystkie czcionki będą gotowe
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

  // Dynamically import główny plik gry jako moduł JS
  const script = document.createElement("script");
  script.type = "module";
  script.src = "src/app/main.js";
  document.body.appendChild(script);
}

// Poczekaj aż DOM zostanie załadowany
window.addEventListener("DOMContentLoaded", async () => {
  await waitForFonts(); // Wczytaj czcionki

  // Elementy związane z instalacją PWA
  const installContainer = document.getElementById("install-pwa-container");
  const installBtn = document.getElementById("install-pwa-btn");
  let deferredPrompt = null;

  // Obsługa zdarzenia instalacji aplikacji jako PWA
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // Zablokuj domyślne okno instalacji
    deferredPrompt = e; // Zapisz prompt do późniejszego użycia
    installContainer.style.display = "block"; // Pokaż przycisk instalacji

    installBtn.onclick = () => {
      installContainer.style.display = "none"; // Ukryj przycisk
      deferredPrompt.prompt();                 // Wywołaj prompt instalacji
      deferredPrompt.userChoice.then(() => {
        deferredPrompt = null;                 // Wyczyść prompt
        handleGyroPermission(startGameNormally); // Sprawdź dostęp do żyroskopu i uruchom grę
      });
    };
  });

  // Funkcje pomocnicze do wykrywania platformy (iOS/Safari)
  const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isSafari = () => /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

  // Specjalna obsługa dla użytkowników iOS Safari bez trybu standalone
  if (isIOS() && isSafari() && !window.navigator.standalone) {
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
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/fullspeed2skid/service-worker.js');
  });
}
