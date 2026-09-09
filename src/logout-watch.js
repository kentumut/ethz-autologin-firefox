// ETHZ Auto-Login — lightweight logout detection on all *.ethz.ch pages.
// Kept separate from content.js to avoid loading login automation on every ETHZ tab.

(() => {
  'use strict';

  const ext = globalThis.chrome || globalThis.browser;
  const LOGOUT_PATTERN = /log\s*out|sign\s*out|abmelden|ausloggen|d[eé]connexion/i;

  const onLogoutClick = (e) => {
    const target = e.target.closest('a, button');
    if (!target) return;

    const text = target.textContent || '';
    const href = target.getAttribute('href') || '';

    if (LOGOUT_PATTERN.test(text) || LOGOUT_PATTERN.test(href) ||
      href.includes('logout') || href.includes('Logout') ||
      href.includes('Shibboleth.sso/Logout')) {
      ext.runtime.sendMessage({ type: 'LOGOUT_DETECTED' });
    }
  };

  document.addEventListener('click', onLogoutClick, true);
  window.addEventListener('pagehide', () => {
    document.removeEventListener('click', onLogoutClick, true);
  });
})();
