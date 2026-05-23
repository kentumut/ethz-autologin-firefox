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
  if (input) setTimeout(() => input.focus(), 100);
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

// Step 1: Username → next
document.getElementById('next-1').addEventListener('click', () => {
  const val = usernameInput.value.trim();
  if (!val) {
    document.getElementById('error-1').textContent = 'Please enter your username.';
    usernameInput.focus();
    return;
  }
  document.getElementById('error-1').textContent = '';
  goTo(1);
});

// Step 2: confirm browser password manager setup
document.getElementById('next-2').addEventListener('click', () => {
  document.getElementById('error-2').textContent = '';

  const username = usernameInput.value.trim();
  ext.storage.local.set(
    {
      ethz_username: username,
      ethz_login_mode: 'password_manager',
      ethz_password_manager_enabled: true
    },
    () => {
      ext.storage.local.remove(['ethz_password', 'ethz_show_welcome', 'ethz_login_failed']);
      ext.action.setBadgeText({ text: '' });
      goTo(2);
    }
  );
});

// Skip buttons
document.getElementById('skip-1').addEventListener('click', () => {
  document.getElementById('done-message').textContent =
    'No worries - click the extension icon anytime to enable password-manager automation.';
  steps[currentStep].classList.remove('active');
  currentStep = 2;
  steps[2].classList.add('active');
  progress.style.width = '100%';
});

document.getElementById('skip-2').addEventListener('click', () => {
  document.getElementById('done-message').textContent =
    'No worries - click the extension icon anytime to finish setup.';
  steps[currentStep].classList.remove('active');
  currentStep = 2;
  steps[2].classList.add('active');
  progress.style.width = '100%';
});

// Enter key advances
usernameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('next-1').click();
});
document.addEventListener('keydown', (e) => {
  if (currentStep === 1 && e.key === 'Enter') document.getElementById('next-2').click();
});

// Clear errors on input
usernameInput.addEventListener('input', () => {
  document.getElementById('error-1').textContent = '';
});
// Init progress
progress.style.width = '33%';
