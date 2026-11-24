// Applies the saved (or system) theme before first paint so the page never flashes the wrong colours.
// Lives in its own file because the site's CSP (script-src 'self') blocks inline scripts.
(function () {
  var root = document.documentElement;
  root.classList.add('js');
  var theme = null;
  try { theme = localStorage.getItem('labs-theme'); } catch (error) { /* storage unavailable */ }
  if (theme !== 'dark' && theme !== 'light') theme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  root.dataset.theme = theme;
})();
