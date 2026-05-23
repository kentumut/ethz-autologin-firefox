const ext = globalThis.chrome || globalThis.browser;

const savedView = document.getElementById('saved-view');
const editView = document.getElementById('edit-view');
const statusEl = document.getElementById('status');
const editStatusEl = document.getElementById('edit-status');
const savedUsernameEl = document.getElementById('saved-username');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const toggleBtn = document.getElementById('togglePassword');
const saveBtn = document.getElementById('saveBtn');
const cancelBtn = document.getElementById('cancelBtn');
const changeBtn = document.getElementById('changeBtn');
const deleteBtn = document.getElementById('deleteBtn');

const showSavedView = (username, failed = false) => {
  savedUsernameEl.textContent = username;
  savedView.style.display = 'block';
  editView.style.display = 'none';

  if (failed) {
    statusEl.textContent = '⚠ Login failed — update your credentials';
    statusEl.className = 'status status-error';
  } else {
    statusEl.textContent = '✓ Credentials saved';
    statusEl.className = 'status status-ok';
  }
};

const showEditView = (prefillUsername = '') => {
  savedView.style.display = 'none';
  editView.style.display = 'block';
  usernameInput.value = prefillUsername;
  passwordInput.value = '';
  editStatusEl.textContent = prefillUsername ? 'Update your credentials' : 'Enter your ETHZ credentials';
  editStatusEl.className = 'status status-empty';

  // Focus the right field
  if (prefillUsername) {
    passwordInput.focus();
  } else {
    usernameInput.focus();
  }
};

const loadCredentials = () => {
  ext.storage.local.get(
    ['ethz_username', 'ethz_password', 'ethz_login_failed'],
    (result) => {
      if (result.ethz_username && result.ethz_password) {
        showSavedView(result.ethz_username, !!result.ethz_login_failed);
      } else {
        showEditView();
      }
    }
  );
};

// Save credentials
saveBtn.addEventListener('click', () => {
  const username = usernameInput.value.trim();
  const password = passwordInput.value.trim();

  if (!username || !password) {
    editStatusEl.textContent = 'Please enter username and password';
    editStatusEl.className = 'status status-error';
    return;
  }

  ext.storage.local.set(
    { ethz_username: username, ethz_password: password },
    () => {
      ext.storage.local.remove(['ethz_login_failed']);
      ext.runtime.sendMessage({ type: 'CREDENTIALS_UPDATED' });
      showSavedView(username);
    }
  );
});

// Change credentials — show form with username prefilled
changeBtn.addEventListener('click', () => {
  ext.storage.local.get(['ethz_username'], (result) => {
    showEditView(result.ethz_username || '');
  });
});

// Cancel — go back to saved view
cancelBtn.addEventListener('click', () => {
  loadCredentials();
});

// Delete credentials
deleteBtn.addEventListener('click', () => {
  if (!confirm('Delete saved ETHZ credentials?')) return;
  ext.storage.local.remove(
    ['ethz_username', 'ethz_password', 'ethz_login_failed'],
    () => showEditView()
  );
});

// Password toggle
toggleBtn.addEventListener('click', () => {
  const isPassword = passwordInput.type === 'password';
  passwordInput.type = isPassword ? 'text' : 'password';
  toggleBtn.textContent = isPassword ? '👁‍🗨' : '👁';
  toggleBtn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
});

loadCredentials();
