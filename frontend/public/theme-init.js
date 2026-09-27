// Apply the theme before React or styles load to avoid a light flash on reload.
(() => {
  let saved;
  try { saved = localStorage.getItem('eduquiz:theme'); } catch { /* Storage is optional. */ }
  const theme = saved === 'dark' || saved === 'light' ? saved
    : window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#191c19' : '#f6f4ed');
})();
