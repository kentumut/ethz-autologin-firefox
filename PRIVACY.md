# Privacy Policy — ETHZ Auto-Login

**Last updated:** March 17, 2026

## What data we collect
None. This extension does not collect, transmit, or store any data externally.

## What data is stored locally
By default, this extension does **not** store your ETHZ password. Save your ETHZ password in your browser passwords; the extension uses the password that your browser password manager fills on the login page.

The extension stores setup and automation state in browser extension local storage:
- ETHZ username, if you enter it during setup
- Selected login mode
- Temporary pause and failed-login flags

If browser password manager autofill is disabled and you explicitly select **Store in extension**, the extension also stores your ETHZ password in extension local storage so it can fill the login form automatically.

Extension local storage is:
- Stored locally by your browser profile
- Sandboxed to this extension (no website or other extension can access it)
- Not transmitted by this extension
- Deleted when you uninstall the extension

## What the extension does with login pages
The extension helps with ETHZ login flows locally:
- **Shibboleth login forms** on `aai-logon.ethz.ch`: uses the password filled by the browser password manager or fills explicitly stored extension credentials, then submits
- **LDAP login forms** on `gitlab.inf.ethz.ch`: uses the password filled by the browser password manager or fills explicitly stored extension credentials, then submits
- **WAYF organisation selection** on `wayf.switch.ch` and embedded org pickers on ETHZ sites

The extension does not fetch or decrypt passwords from the browser password manager; it only uses the values the browser autofills into the login form.

## What we do NOT do
- ❌ Send your credentials to any server
- ❌ Log, track, or record your browsing activity
- ❌ Use analytics, telemetry, or tracking pixels
- ❌ Store your password unless you explicitly select extension-storage mode
- ❌ Access any website outside `*.ethz.ch` and `wayf.switch.ch`
- ❌ Share data with any third party

## Network requests
This extension makes **zero** network requests. It does not contact any external server, API, or service. All functionality is entirely local.

## Permissions explained
| Permission | Why |
|---|---|
| `storage` | Save local setup, pause, failure state, and optional extension-stored credentials |
| `*://*.ethz.ch/*` | Detect ETHZ login flows and submit after browser autofill or opt-in extension fill |
| `*://wayf.switch.ch/*` | Auto-select ETH Zurich on the SWITCH AAI org picker |

## Open source
The complete source code is available at:
https://github.com/AlfredJustus/ethz-autologin

You can read, audit, and verify every line of code.

## Contact
For questions or concerns, open an issue on GitHub:
https://github.com/AlfredJustus/ethz-autologin/issues

## Changes to this policy
Any changes will be reflected in this file and in the extension's GitHub repository.
