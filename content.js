// ETHZ Auto-Login content script
// Shows a seamless overlay during the Shibboleth redirect chain,
// auto-fills credentials ONLY on the trusted IdP domain,
// detects login failures, respects manual logout, and shows contextual notifications.

(() => {
  'use strict';

  const ext = globalThis.chrome || globalThis.browser;
  const sessionStorage = ext.storage.session || ext.storage.local;
  const EMBEDDED_WAYF_RETRY_MS = 3000;
  const EMBEDDED_WAYF_RETRY_INTERVAL_MS = 150;

  // ── Security: only auto-fill on the actual ETHZ Identity Provider ──
  const TRUSTED_IDP_HOSTS = ['aai-logon.ethz.ch'];

  const USERNAME_SELECTORS = [
    'input[name="j_username"]',
    'input[name="username"]',
    'input#username',
    'input[type="text"][name*="user"]'
  ];

  const PASSWORD_SELECTORS = [
    'input[name="j_password"]',
    'input[name="password"]',
    'input#password',
    'input[type="password"]'
  ];

  // ── Detection helpers ──
  const isIdpPage = () => TRUSTED_IDP_HOSTS.includes(location.hostname);

  // Detects SAML POST-back pages — hidden forms that need a click to continue.
  // These are NOT user-facing login pages. They contain a hidden SAMLResponse/SAMLRequest
  // that the browser should auto-submit (but sometimes doesn't without JS).
  const isSamlPostBack = () =>
    !!document.querySelector('input[name="SAMLResponse"]') ||
    !!document.querySelector('input[name="SAMLRequest"]');

  // Detects Shibboleth SP handler endpoints (e.g., /Shibboleth.sso/SAML2/POST).
  // These redirect automatically via 302 — we don't need to do anything on them.
  const isShibbolethEndpoint = () =>
    location.pathname.includes('Shibboleth.sso');

  // Detects embedded WAYF / org-selection pages (e.g., Moodle's /auth/shibboleth/login.php).
  // These have a dropdown to select your institution before triggering the SSO flow.
  const ETH_IDP_VALUE = 'https://aai-logon.ethz.ch/idp/shibboleth';
  const ETH_IDP_TEXT = /ETH Z(u|ü)rich/i;
  const submittedWayfPages = new Set();

  const isEthIdpValue = (value) =>
    (value || '').includes(ETH_IDP_VALUE) || ETH_IDP_TEXT.test(value || '');

  const isHiddenIdpField = (input) =>
    /idp|entityid|entity_id|provider/i.test(`${input.name || ''} ${input.id || ''}`);

  const findEthIdpOption = (select) => {
    const options = Array.from(select.options);
    return options.find((opt) => opt.value === ETH_IDP_VALUE) ||
      options.find((opt) => isEthIdpValue(opt.value) || isEthIdpValue(opt.text));
  };

  const getEmbeddedWayfControl = () => {
    const selectSelectors = [
      'form#login select#idp[name="idp"]',
      'form#login select[name="idp"]',
      'select[name="user_idp"]',
      'select#userIdPSelection',
      'select[name="idp"]',
      'select#idp'
    ];

    for (const selector of selectSelectors) {
      const select = document.querySelector(selector);
      if (!select) continue;

      const option = findEthIdpOption(select);
      if (option) {
        return { control: select, form: select.closest('form'), option };
      }
    }

    const textInput = Array.from(
      document.querySelectorAll('input#userIdPSelection_iddtext, input.idd_textbox, input[name="idp"], input[name="user_idp"]')
    ).find((input) => input.type !== 'hidden' && isEthIdpValue(input.value));
    if (textInput) return { control: textInput, form: textInput.closest('form') };

    const hiddenInput = Array.from(
      document.querySelectorAll('input[type="hidden"]')
    ).find((input) => isHiddenIdpField(input) && isEthIdpValue(input.value));
    if (hiddenInput) return { control: hiddenInput, form: hiddenInput.closest('form') };

    return null;
  };

  const getActionText = (el) => {
    if (!el) return '';
    if (el.tagName === 'INPUT') return el.value || el.name || '';
    return `${el.textContent || ''} ${el.getAttribute('aria-label') || ''} ${el.name || ''}`;
  };

  const isPotentialEmbeddedWayfPage = () =>
    location.pathname.includes('/auth/shibboleth/login.php') ||
    !!document.querySelector('form#login select#idp[name="idp"], select[name="user_idp"], select#userIdPSelection, select[name="idp"], select#idp, input#userIdPSelection_iddtext, input.idd_textbox');

  const findWayfSubmitButton = (form) => {
    if (!form) return null;

    const selectors = [
      'button[name="Select"]',
      'input[name="Select"]',
      'button[type="submit"]',
      'input[type="submit"]',
      'button',
      'input[type="button"]'
    ];
    const pattern = /select|continue|weiter|fortfahren|auswahl|wählen/i;

    const findIn = (root, includeGenericText) => {
      if (!root) return null;
      const candidates = selectors.flatMap((selector) => Array.from(root.querySelectorAll(selector)));
      return candidates.find((el) => {
        if (el.disabled) return false;
        if (el.matches('button[name="Select"], input[name="Select"], button[type="submit"], input[type="submit"]')) {
          return true;
        }
        return includeGenericText && pattern.test(getActionText(el));
      }) || null;
    };

    return findIn(form, true);
  };

  const submitWayfForm = (form, submitBtn) => {
    try {
      if (form && typeof form.requestSubmit === 'function') {
        form.requestSubmit(submitBtn || undefined);
        return;
      }
    } catch (_) {
      // Fall back to the explicit click path for non-submit controls.
    }

    submitBtn?.click();
  };

  const submitEmbeddedWayf = (wayf) => {
    const guardKey = 'ethz_wayf_guard_' + location.origin + location.pathname;
    if (submittedWayfPages.has(guardKey)) return;

    submittedWayfPages.add(guardKey);
    sessionStorage.get([guardKey], (guardResult) => {
      const lastSubmit = guardResult[guardKey] || 0;
      if (Date.now() - lastSubmit < 30000) return; // Already tried in last 30s — stop

      const submitBtn = findWayfSubmitButton(wayf.form);
      if (!submitBtn) {
        submittedWayfPages.delete(guardKey);
        return;
      }

      if (wayf.option) {
        wayf.control.value = wayf.option.value;
        wayf.control.dispatchEvent(new Event('input', { bubbles: true }));
        wayf.control.dispatchEvent(new Event('change', { bubbles: true }));
      }

      const searchBox = document.querySelector('input#userIdPSelection_iddtext, input.idd_textbox');
      if (searchBox) {
        searchBox.value = 'ETH Zurich';
        searchBox.dispatchEvent(new Event('input', { bubbles: true }));
        searchBox.dispatchEvent(new Event('change', { bubbles: true }));
      }

      sessionStorage.set({ [guardKey]: Date.now() });
      showOverlay();
      setTimeout(() => submitWayfForm(wayf.form, submitBtn), 300);
    });
  };

  const trySubmitEmbeddedWayf = (previouslyFailed) => {
    if (previouslyFailed) return false;

    const wayf = getEmbeddedWayfControl();
    if (!wayf) return false;

    submitEmbeddedWayf(wayf);
    return true;
  };

  const watchForEmbeddedWayf = (previouslyFailed) => {
    if (previouslyFailed || !isPotentialEmbeddedWayfPage()) return false;
    if (trySubmitEmbeddedWayf(previouslyFailed)) return true;

    let settled = false;
    let intervalId = null;
    let timeoutId = null;
    let observer = null;

    const stop = () => {
      settled = true;
      if (intervalId) clearInterval(intervalId);
      if (timeoutId) clearTimeout(timeoutId);
      observer?.disconnect();
    };

    const attempt = () => {
      if (settled) return;
      if (trySubmitEmbeddedWayf(previouslyFailed)) stop();
    };

    observer = new MutationObserver(attempt);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    intervalId = setInterval(attempt, EMBEDDED_WAYF_RETRY_INTERVAL_MS);
    timeoutId = setTimeout(stop, EMBEDDED_WAYF_RETRY_MS);

    return true;
  };

  // ── GitLab LDAP login detection ──
  // gitlab.inf.ethz.ch uses LDAP auth (not Shibboleth). Same ETHZ credentials,
  // different form. Only auto-fill on this specific trusted host.
  const TRUSTED_LDAP_HOSTS = ['gitlab.inf.ethz.ch'];

  const isLdapLoginPage = () => {
    if (!TRUSTED_LDAP_HOSTS.includes(location.hostname)) return false;
    const userField = document.querySelector('input#ldapmain_username, input[name="username"][id*="ldap"]');
    const passField = document.querySelector('input#ldapmain_password, input[name="password"][id*="ldap"]');
    return !!(userField && passField);
  };

  const findFirstMatch = (selectors) => {
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  };

  const hasLoginForm = () => {
    const u = findFirstMatch(USERNAME_SELECTORS);
    const p = findFirstMatch(PASSWORD_SELECTORS);
    return !!(u && p);
  };

  const dispatchInputEvents = (el) => {
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };

  const findSubmitButton = () => {
    const primary =
      document.querySelector('button[name="_eventId_proceed"]') ||
      document.querySelector('input[name="_eventId_proceed"]');
    if (primary) return primary;

    const submit =
      document.querySelector('button[type="submit"]') ||
      document.querySelector('input[type="submit"]');
    if (submit) return submit;

    const pattern = /login|anmelden|sign\s*in|weiter|continue/i;
    const candidates = Array.from(
      document.querySelectorAll('button, input[type="button"], input[type="submit"]')
    );
    return (
      candidates.find((el) => {
        const text = el.tagName === 'INPUT' ? (el.value || '') : (el.textContent || '');
        return pattern.test(text);
      }) || null
    );
  };

  // ── Logout detection ──
  // Watches for clicks on logout links/buttons. On click, notifies the background
  // script which stores a 30-second bypass window in extension session storage.
  // This survives the page navigation (unlike JS variables) but expires quickly
  // (unlike the old 10-minute local-storage approach).
  const LOGOUT_PATTERN = /log\s*out|sign\s*out|abmelden|ausloggen|d[eé]connexion/i;

  const watchForLogout = () => {
    document.addEventListener('click', (e) => {
      const target = e.target.closest('a, button');
      if (!target) return;

      const text = target.textContent || '';
      const href = target.getAttribute('href') || '';

      if (LOGOUT_PATTERN.test(text) || LOGOUT_PATTERN.test(href) ||
        href.includes('logout') || href.includes('Logout') ||
          href.includes('Shibboleth.sso/Logout')) {
        // Tell background to set the bypass timestamp
        ext.runtime.sendMessage({ type: 'LOGOUT_DETECTED' });
      }
    }, true); // capture phase — fires before navigation
  };

  // ── Detect login errors on the page ──
  const hasLoginError = () => {
    const errorSelectors = [
      '.login-error',
      '.error-message',
      '.form-error',
      'p.output--error',
      'p.output-error',
      '.alert-danger',
      '.alert-error'
    ];
    for (const sel of errorSelectors) {
      const el = document.querySelector(sel);
      if (el && el.offsetParent !== null) return true;
    }
    const body = document.body?.textContent || '';
    return /incorrect.*password|wrong.*password|invalid.*credentials|authentication.*failed|login.*failed|falsches.*passwort|anmeldung.*fehlgeschlagen/i.test(body);
  };

  // ── Toast notification system ──
  const TOAST_CSS = `
    #ethz-autologin-toast {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 2147483647;
      max-width: 360px;
      background: #ffffff;
      border: 1px solid #e0e0e0;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
      font-family: "Inter", "Segoe UI", system-ui, -apple-system, sans-serif;
      color: #1b1b1b;
      padding: 16px;
      animation: ethz-toast-in 0.3s ease-out;
    }
    #ethz-autologin-toast.toast-error {
      border-left: 4px solid #c62828;
    }
    #ethz-autologin-toast.toast-info {
      border-left: 4px solid #1F407A;
    }
    #ethz-autologin-toast .toast-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    #ethz-autologin-toast .toast-title {
      font-size: 14px;
      font-weight: 600;
      color: #1F407A;
    }
    #ethz-autologin-toast .toast-close {
      background: none;
      border: none;
      font-size: 18px;
      color: #999;
      cursor: pointer;
      padding: 0 4px;
      line-height: 1;
    }
    #ethz-autologin-toast .toast-close:hover {
      color: #333;
    }
    #ethz-autologin-toast .toast-body {
      font-size: 13px;
      line-height: 1.5;
      color: #444;
    }
    #ethz-autologin-toast .toast-body a {
      color: #1F407A;
      text-decoration: underline;
    }
    #ethz-autologin-toast .toast-action {
      display: inline-block;
      margin-top: 10px;
      padding: 6px 14px;
      background: #1F407A;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 13px;
      cursor: pointer;
      text-decoration: none;
    }
    #ethz-autologin-toast .toast-action:hover {
      background: #163060;
    }
    #ethz-autologin-toast .toast-action.danger {
      background: #c62828;
    }
    #ethz-autologin-toast .toast-action.danger:hover {
      background: #a11f1f;
    }
    @keyframes ethz-toast-in {
      from { opacity: 0; transform: translateY(16px); }
      to   { opacity: 1; transform: translateY(0); }
    }
  `;

  let toastStyleInjected = false;

  const showToast = ({ title, body, type = 'info', action = null }) => {
    const existing = document.getElementById('ethz-autologin-toast');
    if (existing) existing.remove();

    if (!toastStyleInjected) {
      const style = document.createElement('style');
      style.textContent = TOAST_CSS;
      document.documentElement.appendChild(style);
      toastStyleInjected = true;
    }

    const toast = document.createElement('div');
    toast.id = 'ethz-autologin-toast';
    toast.classList.add(type === 'error' ? 'toast-error' : 'toast-info');

    const header = document.createElement('div');
    header.className = 'toast-header';

    const titleEl = document.createElement('span');
    titleEl.className = 'toast-title';
    titleEl.textContent = title;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'toast-close';
    closeBtn.id = 'ethz-toast-close';
    closeBtn.type = 'button';
    closeBtn.textContent = '×';

    const bodyEl = document.createElement('div');
    bodyEl.className = 'toast-body';
    bodyEl.textContent = body;

    header.append(titleEl, closeBtn);
    toast.append(header, bodyEl);

    if (action) {
      const actionBtn = document.createElement('button');
      actionBtn.className = action.danger ? 'toast-action danger' : 'toast-action';
      actionBtn.id = 'ethz-toast-action';
      actionBtn.type = 'button';
      actionBtn.textContent = action.label;
      bodyEl.appendChild(actionBtn);
    }

    document.documentElement.appendChild(toast);

    toast.querySelector('#ethz-toast-close').addEventListener('click', () => toast.remove());

    if (action?.onClick) {
      toast.querySelector('#ethz-toast-action')?.addEventListener('click', action.onClick);
    }

    if (type !== 'error') {
      setTimeout(() => toast.remove(), 15000);
    }
  };

  const openExtensionPopup = () => {
    showToast({
      title: 'ETHZ Auto-Login',
      body: 'Click the extension icon in your toolbar to add or update your credentials.',
      type: 'info'
    });
  };

  // ── Overlay (for seamless redirects) ──
  const OVERLAY_CSS = `
    #ethz-autologin-overlay {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: #ffffff;
      font-family: "Inter", "Segoe UI", system-ui, -apple-system, sans-serif;
      color: #1F407A;
    }
    #ethz-autologin-overlay .ethz-spinner {
      width: 32px;
      height: 32px;
      border: 3px solid #e0e0e0;
      border-top-color: #1F407A;
      border-radius: 50%;
      animation: ethz-spin 0.8s linear infinite;
      margin-bottom: 16px;
    }
    #ethz-autologin-overlay .ethz-label {
      font-size: 15px;
      font-weight: 500;
      letter-spacing: 0.01em;
    }
    @keyframes ethz-spin {
      to { transform: rotate(360deg); }
    }
  `;

  const showOverlay = () => {
    if (document.getElementById('ethz-autologin-overlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'ethz-autologin-overlay';
    const style = document.createElement('style');
    style.textContent = OVERLAY_CSS;
    const spinner = document.createElement('div');
    spinner.className = 'ethz-spinner';
    const label = document.createElement('div');
    label.className = 'ethz-label';
    label.textContent = 'Signing in to ETHZ…';
    overlay.append(style, spinner, label);
    document.documentElement.appendChild(overlay);

    // Safety timeout: if login hasn't completed in 5s, remove overlay
    // and let the user interact with the page manually
    setTimeout(() => {
      const el = document.getElementById('ethz-autologin-overlay');
      if (el) el.remove();
    }, 5000);
  };

  // ── Main logic ──
  const run = () => {
    // Always watch for logout clicks on any ETHZ page
    watchForLogout();

    // First check if we're in a post-logout bypass window (async, via background)
    ext.runtime.sendMessage({ type: 'CHECK_LOGOUT_BYPASS' }, (response) => {
      if (response?.bypassed) return; // User just logged out — don't auto-login

      ext.storage.local.get(
        ['ethz_username', 'ethz_password', 'ethz_login_failed'],
        (result) => {
          const username = result.ethz_username;
          const password = result.ethz_password;
          const hasCreds = !!(username && password);
          const previouslyFailed = !!result.ethz_login_failed;

          // ─── IdP login page ───
          if (isIdpPage() && hasLoginForm()) {

            if (hasLoginError() && hasCreds) {
              ext.runtime.sendMessage({ type: 'LOGIN_FAILED' });
              showToast({
                title: 'Login failed',
                body: 'Your saved ETHZ credentials appear to be incorrect. Update or remove them in the extension settings.',
                type: 'error',
                action: {
                  label: 'Update credentials',
                  danger: true,
                  onClick: openExtensionPopup
                }
              });
              return;
            }

            if (previouslyFailed) {
              showToast({
                title: 'Auto-login paused',
                body: 'A previous login attempt failed. Update your credentials in the extension to try again.',
                type: 'error',
                action: {
                  label: 'Update credentials',
                  danger: true,
                  onClick: openExtensionPopup
                }
              });
              return;
            }

            if (!hasCreds) {
              showToast({
                title: 'ETHZ Auto-Login',
                body: 'You haven\'t set up your login credentials yet. Click the extension icon to add them and skip this page next time.',
                type: 'info'
              });
              return;
            }

            // Happy path: overlay + fill + submit
            showOverlay();

            const u = findFirstMatch(USERNAME_SELECTORS);
            const p = findFirstMatch(PASSWORD_SELECTORS);

            u.value = username;
            p.value = password;
            dispatchInputEvents(u);
            dispatchInputEvents(p);

            const btn = findSubmitButton();
            if (btn) {
              setTimeout(() => btn.click(), 300);
            }
            return;
          }

          // ─── SAML POST-back pages ───
          // These are hidden forms with SAMLResponse/SAMLRequest that need a click to continue.
          // Only click submit if the form actually contains SAML data (not random login pages).
          if (isSamlPostBack() && hasCreds && !previouslyFailed) {
            const samlForm =
              document.querySelector('form:has(input[name="SAMLResponse"])') ||
              document.querySelector('form:has(input[name="SAMLRequest"])');
            if (samlForm) {
              const submitBtn = samlForm.querySelector('input[type="submit"], button[type="submit"]');
              if (submitBtn) {
                setTimeout(() => submitBtn.click(), 100);
              }
            }
            return;
          }

          // ─── GitLab LDAP login ───
          if (isLdapLoginPage() && hasCreds && !previouslyFailed) {
            const userField = document.querySelector('input#ldapmain_username, input[name="username"][id*="ldap"]');
            const passField = document.querySelector('input#ldapmain_password, input[name="password"][id*="ldap"]');

            if (userField && passField) {
              showOverlay();

              userField.value = username;
              passField.value = password;
              dispatchInputEvents(userField);
              dispatchInputEvents(passField);

              // Find the LDAP form's submit button (not the standard GitLab login)
              const ldapForm = userField.closest('form');
              const submitBtn = ldapForm?.querySelector('button[type="submit"], input[type="submit"]');
              if (submitBtn) {
                setTimeout(() => submitBtn.click(), 300);
              }
            }
            return;
          }

          // ─── Embedded WAYF / org-selection pages ───
          // E.g., Moodle's /auth/shibboleth/login.php with a dropdown to pick ETH Zurich.
          // Auto-select ETH Zurich and submit, with loop guard.
          if (watchForEmbeddedWayf(previouslyFailed)) {
            return;
          }

          // ─── Normal ETHZ page — login succeeded ───
          if (hasCreds && !isIdpPage() && !isSamlPostBack() && !isShibbolethEndpoint()) {
            ext.runtime.sendMessage({ type: 'LOGIN_SUCCEEDED' });
          }
        }
      );
    });
  };

  run();
})();
