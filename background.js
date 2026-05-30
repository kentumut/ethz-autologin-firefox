// ETHZ Auto-Login — Background service worker
// Handles first-install welcome page, login failure tracking, and logout bypass.

const ext = globalThis.chrome || globalThis.browser;
const sessionStorage = ext.storage.session || ext.storage.local;

const LOGIN_SUCCEEDED_DEBOUNCE_MS = 60000;
const WAYF_GUARD_PREFIX = 'ethz_wayf_guard_';
const WAYF_GUARD_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const WAYF_GUARD_MAX_KEYS = 50;

let lastLoginSucceededAt = 0;

const migrateLoginMode = () => {
  ext.storage.local.get(
    ['ethz_login_mode', 'ethz_password', 'ethz_username', 'ethz_password_manager_enabled'],
    (result) => {
      if (result.ethz_login_mode) return;

      const updates = {};
      if (result.ethz_username && result.ethz_password) {
        updates.ethz_login_mode = 'extension_storage';
      } else if (result.ethz_password_manager_enabled) {
        updates.ethz_login_mode = 'password_manager';
        updates.ethz_password_manager_enabled = true;
      }

      if (Object.keys(updates).length > 0) {
        ext.storage.local.set(updates);
      }
    }
  );
};

const pruneWayfGuardKeys = () => {
  sessionStorage.get(null, (all) => {
    if (!all) return;

    const now = Date.now();
    const guardEntries = Object.entries(all)
      .filter(([key]) => key.startsWith(WAYF_GUARD_PREFIX))
      .map(([key, value]) => [key, Number(value) || 0])
      .sort((a, b) => b[1] - a[1]);

    const toRemove = guardEntries
      .filter(([, timestamp]) => now - timestamp > WAYF_GUARD_MAX_AGE_MS)
      .map(([key]) => key);

    const surviving = guardEntries.filter(([key]) => !toRemove.includes(key));
    if (surviving.length > WAYF_GUARD_MAX_KEYS) {
      toRemove.push(...surviving.slice(WAYF_GUARD_MAX_KEYS).map(([key]) => key));
    }

    if (toRemove.length > 0) {
      sessionStorage.remove(toRemove);
    }
  });
};

migrateLoginMode();
pruneWayfGuardKeys();

// Open the welcome/setup page on first install
ext.runtime.onInstalled.addListener((details) => {
  migrateLoginMode();
  pruneWayfGuardKeys();

  if (details.reason === 'install') {
    ext.tabs.create({ url: ext.runtime.getURL('welcome.html') });
  }
});

if (ext.runtime.onStartup) {
  ext.runtime.onStartup.addListener(pruneWayfGuardKeys);
}

// Listen for messages from content script and popup
ext.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'LOGIN_FAILED') {
    ext.storage.local.set({ ethz_login_failed: true });
    sendResponse({ ok: true });
  }

  if (message.type === 'LOGIN_SUCCEEDED') {
    const now = Date.now();
    if (now - lastLoginSucceededAt < LOGIN_SUCCEEDED_DEBOUNCE_MS) {
      sendResponse({ ok: true, skipped: true });
      return false;
    }
    lastLoginSucceededAt = now;
    ext.storage.local.remove(['ethz_login_failed']);
    sendResponse({ ok: true });
  }

  if (message.type === 'CREDENTIALS_UPDATED') {
    ext.storage.local.remove(['ethz_login_failed']);
    ext.action.setBadgeText({ text: '' });
    sendResponse({ ok: true });
  }

  // Logout detected by content script — store bypass timestamp
  // Uses extension session storage when available, with local storage fallback
  // for browsers that do not expose storage.session.
  if (message.type === 'LOGOUT_DETECTED') {
    sessionStorage.set({ ethz_logout_at: Date.now() });
    sendResponse({ ok: true });
  }

  // Content script asks if logout bypass is active
  if (message.type === 'CHECK_LOGOUT_BYPASS') {
    sessionStorage.get(['ethz_logout_at'], (result) => {
      const logoutAt = result.ethz_logout_at || 0;
      const elapsed = Date.now() - logoutAt;
      // 30 second window — covers the redirect chain but not future visits
      sendResponse({ bypassed: elapsed < 30000 });
    });
    return true; // async sendResponse
  }

  return false;
});
