// Ekran ładowania
let loadingOverlay, loadingCircle, loadingText;
let loadingProgress = 0;
let loadingFadeOut = false;

export function showLoadingOverlay() {
  loadingOverlay = document.createElement('div');
  loadingOverlay.className = 'loading-overlay';
  loadingOverlay.style.backgroundImage = "url('assets/images/asphalt.jpg')";
  loadingCircle = document.createElement('div');
  loadingCircle.className = 'loading-circle loading-circle-bg';
  loadingText = document.createElement('div');
  loadingText.className = 'loading-text';
  loadingText.innerText = '0%';
  loadingCircle.appendChild(loadingText);
  loadingOverlay.appendChild(loadingCircle);
  document.body.appendChild(loadingOverlay);
}

export function setLoadingProgress(percent) {
  loadingProgress = percent;
  if (loadingText) loadingText.innerText = percent + '%';
  if (percent >= 100 && !loadingFadeOut) {
    loadingFadeOut = true;
    loadingOverlay.style.opacity = '0';
    setTimeout(() => {
      if (loadingOverlay && loadingOverlay.parentNode) loadingOverlay.parentNode.removeChild(loadingOverlay);
    }, 300);
  }
} 