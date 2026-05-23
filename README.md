# ETHZ Auto-Login

Browser extension that automatically logs you into ETHZ websites (Shibboleth / SWITCH AAI). Entirely local — your credentials never leave your browser.

## Features

- **Auto-login** on any `*.ethz.ch` site that uses Shibboleth SSO (Moodle, video.ethz.ch, etc.)
- **Seamless redirect** — clean spinner overlay while the SSO chain completes, no page flashing
- **Security first** — credentials only auto-filled on the trusted IdP (`aai-logon.ethz.ch`), never on arbitrary subdomains
- **Smart failure handling** — detects wrong credentials, shows a notification, and stops (no infinite retry loops)
- **First-install welcome** — guides new users to set up their credentials
- **No-credentials nudge** — subtle notification on login pages if credentials haven't been configured yet

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

For long-term Firefox or Zen Browser installs, use a signed unlisted XPI instead of the temporary `about:debugging` install.

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

Suggested reviewer notes for unlisted signing:

```text
ETHZ Auto-Login stores the user's ETHZ username and password locally in browser extension storage.
The extension does not make analytics, telemetry, API, or other outbound network requests.
Credentials are only filled on the trusted ETHZ IdP host aai-logon.ethz.ch and LDAP login on gitlab.inf.ethz.ch.
The wayf.switch.ch content script only selects ETH Zurich as the identity provider.
Build command: npm run build:firefox
Firefox source directory for review/signing: dist/firefox
```

For updates, increment the extension version in `manifest.firefox.json`, rebuild, and run `npm run sign:firefox` again.

## Build Targets

```sh
npm run build:chrome
npm run build:firefox
npm run package:firefox
npm run build
```

The build script writes browser-specific output to `dist/`:

- `dist/chrome` uses the source `manifest.json`
- `dist/firefox` uses `manifest.firefox.json` copied as `manifest.json`

## Usage

1. Click the extension icon in your toolbar
2. Enter your ETH username and password
3. Click **Save**
4. Visit any ETHZ site — login happens automatically

If your credentials are wrong, the extension will notify you and stop trying. Update your credentials in the popup to try again.

## Privacy & Security

- Credentials stored **locally only** via browser extension storage
- No external network calls, analytics, or tracking
- Auto-fill restricted to `aai-logon.ethz.ch` — a compromised ETHZ subdomain cannot extract your password
- Passwords never displayed in plain text in the UI
- 100% open source — read every line of code

## Files

| File | Purpose |
|------|---------|
| `manifest.json` | Chrome extension config (Manifest V3 service worker) |
| `manifest.firefox.json` | Firefox extension config (Manifest V3 background script) |
| `background.js` | First-install handling, failure state management |
| `content.js` | Login form detection, overlay, auto-fill, notifications |
| `popup.html/css/js` | Settings UI for credentials |
| `icons/` | Extension icons |
| `scripts/build.js` | Browser-specific build output |

## License

MIT
