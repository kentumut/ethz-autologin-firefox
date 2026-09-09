const ext = globalThis.chrome || globalThis.browser;
const isFirefox = navigator.userAgent.toLowerCase().includes('firefox');
const passwordManagerUrl = isFirefox
  ? 'about:logins?filter=ethz'
  : 'chrome://password-manager/passwords?q=ethz';
const passwordManagerName = isFirefox
  ? 'Firefox Password Manager'
  : 'Chrome Password Manager';

const steps = [
  document.getElementById('step-1'),
  document.getElementById('step-2'),
  document.getElementById('step-3')
];
const progress = document.getElementById('progress');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const browserMode = document.getElementById('mode-browser');
const extensionMode = document.getElementById('mode-extension');
const saveButton = document.getElementById('next-2');
let saving = false;
const passwordManagerLinks = document.querySelectorAll('.pw-manager-link');
let currentStep = 0;

passwordManagerLinks.forEach((link) => {
  link.textContent = `Open ${passwordManagerName}`;
});

const showPasswordManagerFallback = (el, originalText) => {
  navigator.clipboard.writeText(passwordManagerUrl).then(() => {
    el.textContent = 'Link copied! Paste in a new tab.';
    setTimeout(() => { el.textContent = originalText; }, 3000);
  }).catch(() => {
    el.textContent = `Go to: ${passwordManagerUrl}`;
    setTimeout(() => { el.textContent = originalText; }, 5000);
  });
};

const goTo = (index) => {
  steps[currentStep].classList.remove('active');
  currentStep = index;
  steps[currentStep].classList.add('active');
  progress.style.width = `${((currentStep + 1) / steps.length) * 100}%`;

  const input = steps[currentStep].querySelector('input');
  if (input) input.focus();
};

// Handle internal browser password-manager links, which may not open directly.
passwordManagerLinks.forEach((link) => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const el = e.target;
    const originalText = el.textContent;

    if (isFirefox) {
      showPasswordManagerFallback(el, originalText);
      return;
    }

    try {
      const tab = ext.tabs.create({ url: passwordManagerUrl });
      if (tab && typeof tab.catch === 'function') {
        tab.catch(() => showPasswordManagerFallback(el, originalText));
      }
    } catch {
      showPasswordManagerFallback(el, originalText);
    }
  });
});

const updateMode = () => {
  const stored = extensionMode.checked;
  passwordInput.value = '';
  document.getElementById('error-1').textContent = '';
  document.getElementById('error-2').textContent = '';
  document.getElementById('extension-fields').hidden = !stored;
  document.getElementById('browser-help').hidden = stored;
  document.getElementById('credentials-title').textContent = stored
    ? 'Save your ETH login.' : 'Your ETH username.';
  document.getElementById('mode-description').textContent = stored
    ? 'Enter your ETH username and password so the extension can fill the login form for you.'
    : 'The extension will use the password your browser fills. Your password will not be stored in this extension.';
  saveButton.textContent = stored ? 'Save and enable auto-login' : 'Enable auto-login';
};

browserMode.addEventListener('change', updateMode);
extensionMode.addEventListener('change', updateMode);

document.getElementById('next-1').addEventListener('click', () => {
  if (!browserMode.checked && !extensionMode.checked) {
    document.getElementById('error-1').textContent = 'Please choose a login method.';
    return;
  }
  updateMode();
  goTo(1);
});

document.getElementById('back-2').addEventListener('click', () => {
  if (saving) return;
  passwordInput.value = '';
  goTo(0);
});

saveButton.addEventListener('click', () => {
  if (saving || currentStep !== 1) return;
  const username = usernameInput.value.trim();
  const stored = extensionMode.checked;
  const error = document.getElementById('error-2');
  if (!username) {
    error.textContent = 'Please enter your ETH username.';
    usernameInput.focus();
    return;
  }
  if (stored && !passwordInput.value) {
    error.textContent = 'Please enter your ETH password.';
    passwordInput.focus();
    return;
  }
  error.textContent = '';
  saving = true;
  saveButton.disabled = true;
  const values = {
    ethz_username: username,
    ethz_login_mode: stored ? 'extension_storage' : 'password_manager',
    ethz_password_manager_enabled: !stored
  };
  if (stored) values.ethz_password = passwordInput.value;
  const fail = () => {
    if (!ext.runtime.lastError) return false;
    error.textContent = 'Could not save setup. Please try again.';
    saving = false;
    saveButton.disabled = false;
    return true;
  };
  ext.storage.local.set(values, () => {
    if (fail()) return;
    const removals = ['ethz_show_welcome', 'ethz_login_failed', 'ethz_automation_paused_until'];
    if (!stored) removals.push('ethz_password');
    ext.storage.local.remove(removals, () => {
      if (fail()) return;
      passwordInput.value = '';
      saving = false;
      saveButton.disabled = false;
      ext.action.setBadgeText({ text: '' });
      document.getElementById('done-mode').textContent = stored
        ? 'Your credentials are saved in this extension.'
        : 'Your browser password manager fills your login.';
      document.getElementById('done-message').textContent =
        'Auto-login is enabled. Complete any later multi-factor authentication step yourself.';
      goTo(2);
    });
  });
});

const skip = () => {
  if (saving) return;
  passwordInput.value = '';
  document.getElementById('done-title').textContent = 'Set up later.';
  document.getElementById('done-message').textContent =
    'Click the extension icon anytime to finish setup.';
  document.getElementById('done-features').hidden = true;
  goTo(2);
};
document.getElementById('skip-1').addEventListener('click', skip);
document.getElementById('skip-2').addEventListener('click', skip);

// Only advance from text fields; buttons and radio options retain native keys.
[usernameInput, passwordInput].forEach(input => {
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      saveButton.click();
    }
  });
  input.addEventListener('input', () => {
    document.getElementById('error-2').textContent = '';
  });
});
progress.style.width = '33%';
