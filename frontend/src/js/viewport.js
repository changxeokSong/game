/**
 * Mobile Viewport Fix
 * Handles virtual keyboard issues by adjusting a CSS variable --vh 
 * based on the Visual Viewport API.
 */
function updateViewport() {
  const vv = window.visualViewport;
  if (!vv) return;

  // Set --vh to the actual visible height (accounting for keyboard)
  const vh = vv.height * 0.01;
  document.documentElement.style.setProperty('--vh', `${vh}px`);
  
  // If keyboard is open (height reduced), scroll the active element into view
  if (vv.height < window.innerHeight) {
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
      setTimeout(() => active.scrollIntoView({ block: 'center' }), 100);
    }
  }
}

if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', updateViewport);
  window.visualViewport.addEventListener('scroll', updateViewport);
  updateViewport();
} else {
  // Fallback for older browsers
  window.addEventListener('resize', () => {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
  });
}
