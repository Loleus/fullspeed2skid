// Ekran ładowania
let loadingOverlay, loadingText;

export function showLoadingOverlay() {
  loadingOverlay = document.createElement('div');
  loadingOverlay.className = 'loading-overlay';
  loadingOverlay.style.backgroundImage = "url('assets/images/asphalt.jpg')";
  loadingText = document.createElement('div');
  loadingText.className = 'menu-btn';
  loadingText.innerText = 'LOADING...';
  loadingOverlay.appendChild(loadingText);
  document.body.appendChild(loadingOverlay);
}

export function hideLoadingOverlay() {
  if (loadingOverlay && loadingOverlay.parentNode) {
    loadingOverlay.style.opacity = '0';
    setTimeout(() => {
      if (loadingOverlay && loadingOverlay.parentNode) {
        loadingOverlay.parentNode.removeChild(loadingOverlay);
        loadingOverlay = null;
      }
    }, 300);
  }
} 