# Full Speed 2 Skid

## Sterowanie
- **Strzałka w górę**: przyspieszenie
- **Strzałka w dół**: hamowanie / cofanie
- **Strzałka w lewo/prawo**: skręt
- **V**: przełączanie między kamerą klasyczną a FPV

## Moduły w src/

### main.js
Główny moduł gry - koordynuje wszystkie komponenty, obsługuje ładowanie, UI (FPS, loading screen), inicjalizację Phaser i główną pętlę gry.

### car.js
Moduł auta z fizyką - zawiera klasę `Car` z realistycznym modelem fizyki, sterowaniem, kolizjami (elipsa), driftem/poślizgiem, oporami aerodynamicznymi i toczenia. Parametry auta (masa, prędkość, skręt) są łatwo konfigurowalne.

### world.js
Moduł świata - klasa `World` zarządza ładowaniem SVG, dynamicznym rysowaniem kafli, minimapą, typami nawierzchni (asfalt, trawa, żwir, woda) i pozycją startową. Zawiera statyczną metodę `loadWorld()` do ładowania poziomów.

### cameras.js
Główny moduł kamer - klasa `CameraManager` zarządza przełączaniem między kamerami, inicjalizacją i aktualizacją. Centralne miejsce kontroli systemu kamer.

### classicCamera.js
Moduł kamery klasycznej - klasa `ClassicCamera` obsługuje tradycyjną kamerę podążającą za autem z konfigurowalnymi parametrami śledzenia i granicami świata.

### fpvCamera.js
Moduł kamery FPV - klasa `FPVCamera` implementuje kamerę pierwszej osoby z opóźnionym śledzeniem, rotacją i efektami helikoptera nad autem.

### svgPhaserWorldLoader.js
Moduł ładowania poziomów - parsuje pliki SVG, tworzy tekstury kafli, generuje minimapę i zwraca dane świata z informacjami o nawierzchni i przeszkodach.
