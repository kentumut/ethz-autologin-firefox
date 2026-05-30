# ETHZ Auto-Login

Browser extension that automatically continues ETHZ login flows (Shibboleth / SWITCH AAI) in Chrome, Firefox, and Zen Browser. Save your ETHZ password in your browser passwords first; by default the extension uses the password filled by the browser password manager. If browser password manager autofill is disabled, users can optionally store credentials in the extension for fully automatic login.

Upstream: [AlfredJustus/ethz-autologin](https://github.com/AlfredJustus/ethz-autologin)

## Features

- **Auto-login** on ETHZ login URLs (IdP, GitLab LDAP, Moodle WAYF, Shibboleth/SAML handlers) — not on every `*.ethz.ch` page
- **Low memory footprint (v3.1+)** — login automation runs only on login URLs; a minimal logout watcher runs on other `*.ethz.ch` pages
- **Seamless redirect** — clean spinner overlay while the SSO chain completes, no page flashing
- **Security first by default** — password-manager mode uses browser-saved passwords and avoids extension password storage
- **Optional convenience mode** — users can explicitly store ETHZ credentials in extension local storage if browser password manager autofill is disabled
- **Smart failure handling** — detects failed browser-filled logins, shows a notification, and stops (no infinite retry loops)
- **First-install welcome** — guides new users to enable password-manager automation
- **Pause control** — disable all automation for 15 minutes from the popup

## Content scripts (v3.1+)

| Script | Where it runs | Purpose |
|--------|----------------|---------|
| `logout-watch.js` | `*://*.ethz.ch/*` | Detect logout clicks (no credentials, no DOM observers) |
| `content.js` | `aai-logon.ethz.ch`, `gitlab.inf.ethz.ch`, `*/auth/shibboleth/login.php*`, `*/Shibboleth.sso/*` | Login automation, overlays, autofill |
| `wayf.js` | `wayf.switch.ch` | Select ETH Zurich on the SWITCH AAI org picker |

Non-ETH sites (Google, GitHub, etc.) never receive these scripts. Host permissions for `*.ethz.ch` do not inject code by themselves.

## Install in Chrome

1. Clone or download this repo
2. Open Chrome → `chrome://extensions`
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked** → select this folder

Chrome uses `manifest.json` directly. This remains the primary Chrome manifest and uses a Manifest V3 background service worker.

## Install in Firefox

Firefox is built as a separate target so Chrome support is not replaced.

For temporary development installs:

1. Install development tooling:
   ```sh
   npm install
   ```
2. Build the Firefox extension:
   ```sh
   npm run build:firefox
   ```
3. Open Firefox → `about:debugging#/runtime/this-firefox`
4. Click **Load Temporary Add-on...**
5. Select `dist/firefox/manifest.json`

For development with Mozilla's tooling:

```sh
npm run run:firefox
```

To lint the Firefox build:

```sh
npm run lint:firefox
```

For long-term Firefox or Zen Browser installs, use a signed XPI (listed on AMO or unlisted via your own AMO credentials) instead of the temporary `about:debugging` install.

### Firefox Add-ons (listed)

When published, install from [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/) (search for **ETHZ Auto-Login**). Maintainers submit updates with:

```sh
npm run submit:firefox:listed
```

## Signed Firefox XPI

Firefox release builds require signed add-ons for permanent installation. The easiest private path is an **unlisted** Mozilla-signed XPI: it is signed by Mozilla, but it is not searchable or publicly listed on addons.mozilla.org.

1. Install development tooling:
   ```sh
   npm install
   ```
2. Create a Mozilla Add-ons developer account.
3. Open the AMO Developer Hub API credentials page and create JWT credentials.
4. Create a local `.env` file from the example:
   ```sh
   cp .env.example .env
   ```
5. Paste your AMO credentials into `.env`:
   ```sh
   WEB_EXT_API_KEY=your-jwt-issuer
   WEB_EXT_API_SECRET=your-jwt-secret
   ```
6. Lint the Firefox build:
   ```sh
   npm run lint:firefox
   ```
7. Sign the unlisted XPI:
   ```sh
   npm run sign:firefox
   ```
8. Install the signed `.xpi` from `artifacts/firefox-signed/` by opening it in Firefox or Zen Browser.
9. Restart the browser and confirm the extension remains installed.

Do not commit AMO credentials. The `.env` file is ignored by git, and `npm run sign:firefox` loads it only for the signing command.

The signing script checks that `.env` contains non-placeholder values before calling Mozilla. `web-ext sign` does not support `--overwrite-dest`, so if you need to discard old signed artifacts, remove files from `artifacts/firefox-signed/` manually before signing again.

For a local unsigned package, run:

```sh
npm run package:firefox
```

Unsigned packages are useful for inspection, but normal Firefox release builds require Mozilla signing for long-term installation.

Suggested reviewer notes for AMO signing:

```text
ETHZ Auto-Login stores setup state such as the ETHZ username, login mode, and temporary pause/failure flags. By default, the password comes from the browser password manager autofill on the login page. If the user explicitly chooses extension storage mode, it also stores the ETHZ password in extension local storage.
The extension does not make analytics, telemetry, API, or other outbound network requests.
In password-manager mode, passwords are saved in the browser password manager and are not stored by the extension. In extension-storage mode, login forms on aai-logon.ethz.ch and gitlab.inf.ethz.ch are filled from extension local storage.
content.js runs only on login-related *.ethz.ch URLs; logout-watch.js is a minimal script on all *.ethz.ch pages for logout detection only.
wayf.switch.ch content script only selects ETH Zurich as the identity provider.
Build command: npm run build:firefox
Firefox source directory for review/signing: dist/firefox
```

For updates, increment the version in `manifest.firefox.json` and `manifest.json`, rebuild, then sign or submit:

- Unlisted: `npm run sign:firefox`
- Listed (AMO): `npm run submit:firefox:listed`

## Build Targets

```sh
npm run build:chrome
npm run build:firefox
npm run package:firefox
npm run sign:firefox
npm run submit:firefox:listed
npm run build
```

The build script writes browser-specific output to `dist/`:

- `dist/chrome` uses the source `manifest.json`
- `dist/firefox` uses `manifest.firefox.json` copied as `manifest.json`

## Usage

1. Click the extension icon in your toolbar
2. Enter your ETH username
3. Choose **Password manager** to use the password saved in your browser passwords, or **Store in extension** if browser password manager autofill is disabled
4. Click **Enable**
5. Visit an ETHZ service (e.g. Moodle) — when the login flow hits a supported URL, the extension selects ETH Zurich and completes login according to your mode

If login fails, the extension will notify you and stop trying. Update the saved browser login or the stored extension credentials, then reopen the popup to resume setup. Use **Pause for 15 minutes** to temporarily disable all redirect and submit automation.

## Privacy & Security

- Password-manager mode uses the password saved in browser passwords and does **not** store passwords in browser extension storage
- Extension-storage mode optionally stores the ETHZ password locally in this extension for convenience when browser password manager autofill is disabled
- Stored extension credentials are recoverable by someone with local extension/profile access
- No external network calls, analytics, or tracking
- Auto-submit restricted to `aai-logon.ethz.ch` and `gitlab.inf.ethz.ch`
- Credentials are read from extension storage only on pages with login forms, not on every `*.ethz.ch` tab
- 100% open source — read every line of code

See [PRIVACY.md](PRIVACY.md) for the full policy.

## Contributing

This repository is a Firefox-focused fork. To contribute upstream:

1. Fork [AlfredJustus/ethz-autologin](https://github.com/AlfredJustus/ethz-autologin)
2. Create a branch, make changes, and open a pull request against `main`
3. Keep `manifest.firefox.json` and Firefox build/sign scripts in sync when touching shared logic

## Changelog

### 3.1

- Split `logout-watch.js` from `content.js` to reduce memory on Firefox and Zen Browser
- Narrow `content.js` injection to login-related URLs only
- Lazy-load stored credentials only on credential pages
- Tighten embedded WAYF detection; scope MutationObserver; prune session guard keys
- Debounce `LOGIN_SUCCEEDED` in the background script

## Files

| File | Purpose |
|------|---------|
| `manifest.json` | Chrome extension config (Manifest V3 service worker) |
| `manifest.firefox.json` | Firefox extension config (Manifest V3 background script) |
| `background.js` | First-install handling, failure state management |
| `content.js` | Login flow detection, overlay, autofill wait, auto-submit, notifications (login URLs only) |
| `logout-watch.js` | Lightweight logout click detection on all `*.ethz.ch` pages |
| `popup.html/css/js` | Settings UI for login mode, credentials, and pause control |
| `icons/` | Extension icons |
| `scripts/build.js` | Browser-specific build output |

## License

MIT
