const ext = globalThis.chrome || globalThis.browser;

const savedView = document.getElementById('saved-view');
const editView = document.getElementById('edit-view');
const statusEl = document.getElementById('status');
const editStatusEl = document.getElementById('edit-status');
const savedUsernameEl = document.getElementById('saved-username');
const savedModeEl = document.getElementById('saved-mode');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const passwordField = document.getElementById('password-field');
const toggleBtn = document.getElementById('togglePassword');
const modeHelperEl = document.getElementById('mode-helper');
const modePasswordManager = document.getElementById('modePasswordManager');
const modeExtensionStorage = document.getElementById('modeExtensionStorage');
const saveBtn = document.getElementById('saveBtn');
const cancelBtn = document.getElementById('cancelBtn');
const changeBtn = document.getElementById('changeBtn');
const deleteBtn = document.getElementById('deleteBtn');
const pauseView = document.getElementById('pause-view');
const pauseBtn = document.getElementById('pauseBtn');
const pauseStatusEl = document.getElementById('pause-status');

const PAUSE_MINUTES = 15;
const PAUSE_MS = PAUSE_MINUTES * 60 * 1000;
const PASSWORD_MANAGER_MODE = 'password_manager';
const EXTENSION_STORAGE_MODE = 'extension_storage';

const isPaused = (pausedUntil) => Number(pausedUntil || 0) > Date.now();

const getSelectedMode = () =>
  modeExtensionStorage.checked ? EXTENSION_STORAGE_MODE : PASSWORD_MANAGER_MODE;

const getEffectiveMode = (result) => {
  if (result.ethz_login_mode) return result.ethz_login_mode;
  if (result.ethz_username && result.ethz_password) return EXTENSION_STORAGE_MODE;
  if (result.ethz_password_manager_enabled) return PASSWORD_MANAGER_MODE;
  return PASSWORD_MANAGER_MODE;
};

const isConfigured = (result) => {
  const mode = getEffectiveMode(result);
  if (mode === EXTENSION_STORAGE_MODE) return !!(result.ethz_username && result.ethz_password);
  return !!result.ethz_password_manager_enabled || result.ethz_login_mode === PASSWORD_MANAGER_MODE;
};

const updateModeUi = () => {
  const mode = getSelectedMode();
  const usesExtensionStorage = mode === EXTENSION_STORAGE_MODE;
  passwordField.style.display = usesExtensionStorage ? 'block' : 'none';
  editStatusEl.textContent = usesExtensionStorage
    ? 'Store credentials in this extension'
    : 'Use your browser password manager';
  modeHelperEl.textContent = usesExtensionStorage
    ? 'Optional if browser password manager autofill is disabled. This stores your ETHZ password in extension local storage, where someone with local extension/profile access may be able to extract it.'
    : 'Save your ETHZ login in Firefox, Zen, Chrome, or another browser password manager. This extension uses the password the browser fills, then continues automatically.';
};

const formatPause = (pausedUntil) => {
  const remainingMs = Math.max(0, Number(pausedUntil || 0) - Date.now());
  const remainingMinutes = Math.max(1, Math.ceil(remainingMs / 60000));
  return `${remainingMinutes} min remaining`;
};

const updatePauseView = (enabled, pausedUntil = 0) => {
  if (!enabled) {
    pauseView.style.display = 'none';
    return;
  }

  pauseView.style.display = 'block';
  if (isPaused(pausedUntil)) {
    pauseBtn.textContent = 'Resume now';
    pauseStatusEl.textContent = `Automation paused: ${formatPause(pausedUntil)}`;
  } else {
    pauseBtn.textContent = `Pause for ${PAUSE_MINUTES} minutes`;
    pauseStatusEl.textContent = 'Pauses redirects, WAYF selection, and auto-submit.';
  }
};

const showSavedView = (username, mode, failed = false, pausedUntil = 0) => {
  savedUsernameEl.textContent = username || 'ETHZ';
  savedModeEl.textContent = mode === EXTENSION_STORAGE_MODE
    ? 'Extension-stored login enabled'
    : 'Password manager automation enabled';
  savedView.style.display = 'block';
  editView.style.display = 'none';

  if (failed) {
    statusEl.textContent = mode === EXTENSION_STORAGE_MODE
      ? 'Login failed - update stored credentials'
      : 'Login failed - update your password manager';
    statusEl.className = 'status status-error';
  } else if (isPaused(pausedUntil)) {
    statusEl.textContent = 'Automation paused';
    statusEl.className = 'status status-empty';
  } else {
    statusEl.textContent = 'Automation active';
    statusEl.className = 'status status-ok';
  }

  updatePauseView(true, pausedUntil);
};

const showEditView = (prefillUsername = '', mode = PASSWORD_MANAGER_MODE) => {
  savedView.style.display = 'none';
  editView.style.display = 'block';
  usernameInput.value = prefillUsername;
  passwordInput.value = '';
  modePasswordManager.checked = mode !== EXTENSION_STORAGE_MODE;
  modeExtensionStorage.checked = mode === EXTENSION_STORAGE_MODE;
  editStatusEl.className = 'status status-empty';
  updatePauseView(false);
  updateModeUi();
  usernameInput.focus();
};

const loadCredentials = () => {
  ext.storage.local.get(
    ['ethz_username', 'ethz_password', 'ethz_login_mode', 'ethz_password_manager_enabled', 'ethz_login_failed', 'ethz_automation_paused_until'],
    (result) => {
      const mode = getEffectiveMode(result);
      if (isConfigured(result)) {
        showSavedView(
          result.ethz_username,
          mode,
          !!result.ethz_login_failed,
          result.ethz_automation_paused_until
        );
      } else {
        showEditView(result.ethz_username || '', mode);
      }
    }
  );
};

// Enable selected login flow
saveBtn.addEventListener('click', () => {
  const username = usernameInput.value.trim();
  const password = passwordInput.value;
  const mode = getSelectedMode();

  if (!username) {
    editStatusEl.textContent = 'Please enter your ETHZ username';
    editStatusEl.className = 'status status-error';
    return;
  }

  if (mode === EXTENSION_STORAGE_MODE && !password) {
    editStatusEl.textContent = 'Please enter your ETHZ password';
    editStatusEl.className = 'status status-error';
    passwordInput.focus();
    return;
  }

  const updates = {
    ethz_username: username,
    ethz_login_mode: mode,
    ethz_password_manager_enabled: mode === PASSWORD_MANAGER_MODE
  };
  if (mode === EXTENSION_STORAGE_MODE) updates.ethz_password = password;

  ext.storage.local.set(updates, () => {
    const afterSave = () => {
      ext.runtime.sendMessage({ type: 'CREDENTIALS_UPDATED' });
      showSavedView(username, mode);
    };

    const removals = ['ethz_login_failed'];
    if (mode === PASSWORD_MANAGER_MODE) removals.push('ethz_password');
    ext.storage.local.remove(removals, afterSave);
  });
});

// Change username — show form with username prefilled
changeBtn.addEventListener('click', () => {
  ext.storage.local.get(['ethz_username', 'ethz_password', 'ethz_login_mode', 'ethz_password_manager_enabled'], (result) => {
    showEditView(result.ethz_username || '', getEffectiveMode(result));
  });
});

// Cancel — go back to saved view
cancelBtn.addEventListener('click', () => {
  loadCredentials();
});

// Disable setup
deleteBtn.addEventListener('click', () => {
  if (!confirm('Disable ETHZ Auto-Login setup?')) return;
  ext.storage.local.remove(
    ['ethz_username', 'ethz_password', 'ethz_login_mode', 'ethz_password_manager_enabled', 'ethz_login_failed', 'ethz_automation_paused_until'],
    () => showEditView()
  );
});

modePasswordManager.addEventListener('change', updateModeUi);
modeExtensionStorage.addEventListener('change', updateModeUi);

toggleBtn.addEventListener('click', () => {
  const isPassword = passwordInput.type === 'password';
  passwordInput.type = isPassword ? 'text' : 'password';
  toggleBtn.textContent = isPassword ? 'Hide' : 'Show';
  toggleBtn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
});

pauseBtn.addEventListener('click', () => {
  ext.storage.local.get(['ethz_automation_paused_until'], (result) => {
    if (isPaused(result.ethz_automation_paused_until)) {
      ext.storage.local.remove(['ethz_automation_paused_until'], loadCredentials);
      return;
    }

    ext.storage.local.set(
      { ethz_automation_paused_until: Date.now() + PAUSE_MS },
      loadCredentials
    );
  });
});

loadCredentials();
