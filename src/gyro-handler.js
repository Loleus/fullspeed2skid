// Sprawdzenie czy użytkownik korzysta z urządzenia mobilnego, na którym możliwe jest wykorzystanie żyroskopu
export function isMobileGyro() {
  return /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop|Mobile/i.test(navigator.userAgent);
}

// Sprawdzenie, czy przeglądarka wymaga wyrażenia zgody na dostęp do czujnika orientacji
export function needsGyroPermission() {
  return (
    typeof DeviceOrientationEvent !== "undefined" &&
    typeof DeviceOrientationEvent.requestPermission === "function"
  );
}

// Pokazuje popup z informacją i przyciskami do przyznania zgody na dostęp do żyroskopu
export function showGyroPopup() {
  document.getElementById("gyro-permission-popup").style.display = "block";
}

// Ukrywa popup z informacją o żyroskopie (np. po kliknięciu zgody lub odmowy)
export function hideGyroPopup() {
  document.getElementById("gyro-permission-popup").style.display = "none";
}

// Informuje użytkownika, że dostęp do żyroskopu został zablokowany lub odrzucony
export function showGyroBlocked() {
  document.getElementById("gyro-blocked-info").style.display = "block";
}

// Ukrywa informację o zablokowanym dostępie do żyroskopu
export function hideGyroBlocked() {
  document.getElementById("gyro-blocked-info").style.display = "none";
}

// Główna funkcja inicjująca proces uzyskiwania zgody i uruchamiania obsługi żyroskopu
export async function handleGyroPermission(startGameCallback) {
  // Jeśli nie jesteśmy na urządzeniu mobilnym z żyroskopem lub nie jest wymagana zgoda:
  if (!isMobileGyro() || !needsGyroPermission()) {
    if (isMobileGyro()) {
      setupGyroEvents(); // od razu podłącz zdarzenia żyroskopu
    }
    startGameCallback(); // uruchom grę
    return;
  }

  // Jeśli potrzebna zgoda — pokaż popup
  showGyroPopup();

  // Obsługa kliknięcia przycisku zgody
  document.getElementById("gyro-allow-btn").onclick = async function () {
    try {
      const response = await DeviceOrientationEvent.requestPermission();
      if (response === "granted") {
        hideGyroPopup();
        setupGyroEvents();      // aktywuj sterowanie żyroskopem
        startGameCallback();    // uruchom grę
      } else {
        hideGyroPopup();
        showGyroBlocked();      // pokaż informację o zablokowaniu
      }
    } catch (e) {
      hideGyroPopup();
      showGyroBlocked();        // błędna odpowiedź — traktuj jako zablokowanie
    }
  };

  // Obsługa kliknięcia przycisku odmowy
  document.getElementById("gyro-deny-btn").onclick = function () {
    hideGyroPopup();
    showGyroBlocked();          // pokaż informację o odmowie dostępu
  };
}

// Funkcja podłączająca zdarzenie orientacji urządzenia — odczyt danych żyroskopu
function setupGyroEvents() {
  window._gyroControl = { left: false, right: false }; // stany sterowania: czy skręcamy w lewo lub prawo
  window._gyroCalib = null; // punkt odniesienia do kalibracji beta (pochylenie w osi X)

  // Nasłuchuj zmiany orientacji urządzenia
  window.addEventListener("deviceorientation", function (event) {
    if (window._gyroCalib === null) {
      window._gyroCalib = event.beta; // pierwszy odczyt traktujemy jako punkt odniesienia
    }
    const tilt = event.beta - window._gyroCalib; // oblicz aktualne odchylenie od punktu kalibracji
    window._gyroControl.left = tilt > 10;  // jeśli odchylenie w prawo — skręć w lewo
    window._gyroControl.right = tilt < -10; // jeśli odchylenie w lewo — skręć w prawo
  });
}
