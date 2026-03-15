/**
 * EverREST — Theme Manager
 * Persists dark / light preference in localStorage.
 */
(function () {
  const STORAGE_KEY = 'everrest-theme';
  const DARK = 'dark';
  const LIGHT = 'light';

  // Apply saved theme immediately (before DOM ready) to avoid flash
  const saved = localStorage.getItem(STORAGE_KEY) || DARK;
  document.documentElement.setAttribute('data-theme', saved);

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEY, theme);
    // Update all toggle button icons on the page
    document.querySelectorAll('.theme-toggle, .theme-toggle-float').forEach(btn => {
      btn.textContent = theme === DARK ? '☀️' : '🌙';
      btn.setAttribute('title', theme === DARK ? 'Switch to light mode' : 'Switch to dark mode');
    });
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || DARK;
    setTheme(current === DARK ? LIGHT : DARK);
  }

  // Wire up buttons once DOM is ready
  function init() {
    const current = document.documentElement.getAttribute('data-theme') || DARK;
    document.querySelectorAll('.theme-toggle, .theme-toggle-float').forEach(btn => {
      btn.textContent = current === DARK ? '☀️' : '🌙';
      btn.setAttribute('title', current === DARK ? 'Switch to light mode' : 'Switch to dark mode');
      btn.addEventListener('click', toggleTheme);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
