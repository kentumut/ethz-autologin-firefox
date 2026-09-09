// ETHZ Auto-Login — WAYF (Where Are You From) handler
// Automatically selects "ETH Zurich" on wayf.switch.ch and submits.
// This page appears when logging into non-ethz.ch services that use SWITCH AAI
// (e.g., asvz.ch, some library sites, etc.)

(() => {
  'use strict';

  const ext = globalThis.chrome || globalThis.browser;

  const ETH_IDP_VALUE = 'https://aai-logon.ethz.ch/idp/shibboleth';
  const EXTENSION_STORAGE_MODE = 'extension_storage';

  const isAutomationPaused = (pausedUntil) => Number(pausedUntil || 0) > Date.now();

  const run = () => {
    // Only act after the user enables login automation.
    ext.storage.local.get(
      ['ethz_login_mode', 'ethz_username', 'ethz_password', 'ethz_password_manager_enabled', 'ethz_automation_paused_until'],
      (result) => {
        const enabled = result.ethz_login_mode ||
          result.ethz_password_manager_enabled ||
          (result.ethz_username && result.ethz_password);
        if (!enabled) return;
        if (result.ethz_login_mode === EXTENSION_STORAGE_MODE && !(result.ethz_username && result.ethz_password)) return;
        if (isAutomationPaused(result.ethz_automation_paused_until)) return;

        // Check for logout bypass
        ext.runtime.sendMessage({ type: 'CHECK_LOGOUT_BYPASS' }, (response) => {
          if (response?.bypassed) return;

          // Find the organisation select dropdown
          const select = document.querySelector('select[name="user_idp"], select#userIdPSelection');
          if (!select) return;

          // Select ETH Zurich
          const option = Array.from(select.options).find(
            opt => opt.value === ETH_IDP_VALUE || opt.text.includes('ETH Zurich') || opt.text.includes('ETH Zürich')
          );

          if (!option) return;

          // Set the value
          select.value = option.value;
          select.dispatchEvent(new Event('change', { bubbles: true }));

          // Also fill the text search box if it exists (newer WAYF UI uses an IDD dropdown)
          const searchBox = document.querySelector('input#userIdPSelection_iddtext, input.idd_textbox');
          if (searchBox) {
            searchBox.value = 'ETH Zurich';
            searchBox.dispatchEvent(new Event('input', { bubbles: true }));
            searchBox.dispatchEvent(new Event('change', { bubbles: true }));
          }

          // Show overlay
          showOverlay();

          // Click submit after short delay
          const submitBtn =
            document.querySelector('button[name="Select"]') ||
            document.querySelector('button[type="submit"]') ||
            document.querySelector('input[type="submit"]');

          if (submitBtn) {
            ext.runtime.sendMessage({ type: 'LOGIN_SUCCEEDED' });
            setTimeout(() => submitBtn.click(), 400);
          }
        });
      }
    );
  };

  // ── Overlay ──
  const showOverlay = () => {
    if (document.getElementById('ethz-autologin-overlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'ethz-autologin-overlay';
    const style = document.createElement('style');
    style.textContent = `
      #ethz-autologin-overlay {
        position: fixed; inset: 0; z-index: 2147483647;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        background: #ffffff;
        font-family: "Inter", "Segoe UI", system-ui, -apple-system, sans-serif;
        color: #1F407A;
      }
      #ethz-autologin-overlay .ethz-spinner {
        width: 32px; height: 32px;
        border: 3px solid #e0e0e0; border-top-color: #1F407A;
        border-radius: 50%; animation: ethz-spin 0.8s linear infinite;
        margin-bottom: 16px;
      }
      #ethz-autologin-overlay .ethz-label {
        font-size: 15px; font-weight: 500; letter-spacing: 0.01em;
      }
      @keyframes ethz-spin { to { transform: rotate(360deg); } }
    `;
    const spinner = document.createElement('div');
    spinner.className = 'ethz-spinner';
    const label = document.createElement('div');
    label.className = 'ethz-label';
    label.textContent = 'Signing in to ETHZ…';
    overlay.append(style, spinner, label);
    document.documentElement.appendChild(overlay);

    // Safety timeout: remove overlay after 5s if page hasn't navigated
    setTimeout(() => {
      const el = document.getElementById('ethz-autologin-overlay');
      if (el) el.remove();
    }, 5000);
  };

  run();
})();
