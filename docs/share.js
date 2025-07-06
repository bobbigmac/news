// Minimal social sharing using Web Share API
export function initShare() {
  const shareButton = document.createElement('button');
  shareButton.textContent = 'Share';
  shareButton.className = 'share-button';
  shareButton.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: #3498db;
    color: white;
    border: none;
    border-radius: 50px;
    padding: 12px 24px;
    cursor: pointer;
    font-size: 14px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    z-index: 1000;
  `;

  shareButton.addEventListener('click', async () => {
    const url = window.location.href;
    const title = document.title;
    
    if (navigator.share) {
      // Use native Web Share API
      try {
        await navigator.share({
          title: title,
          url: url
        });
      } catch (err) {
        if (err.name !== 'AbortError') {
          fallbackShare(url, title);
        }
      }
    } else {
      // Fallback for browsers without Web Share API
      fallbackShare(url, title);
    }
  });

  document.body.appendChild(shareButton);
}

function fallbackShare(url, title) {
  // Simple copy to clipboard fallback
  navigator.clipboard.writeText(`${title}\n${url}`).then(() => {
    const button = document.querySelector('.share-button');
    const originalText = button.textContent;
    button.textContent = 'Copied!';
    button.style.background = '#27ae60';
    
    setTimeout(() => {
      button.textContent = originalText;
      button.style.background = '#3498db';
    }, 2000);
  }).catch(() => {
    // Final fallback - open in new window
    window.open(`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url)}`);
  });
} 