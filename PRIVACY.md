# Privacy Policy — ETHZ Auto-Login

**Last updated:** March 17, 2026

## What data we collect
None. This extension does not collect, transmit, or store any data externally.

## What data is stored locally
When you enter your ETHZ username and password in the extension, they are saved in browser extension local storage — a browser-managed storage mechanism that is:
- Stored locally by your browser
- Sandboxed to this extension (no website or other extension can access it)
- Not transmitted by this extension
- Deleted when you uninstall the extension

## What the extension does with your credentials
Your credentials are used exclusively to auto-fill login forms on ETHZ websites. Specifically:
- **Shibboleth login forms** on `aai-logon.ethz.ch` (the official ETHZ identity provider)
- **LDAP login forms** on `gitlab.inf.ethz.ch`
- **WAYF organisation selection** on `wayf.switch.ch` and embedded org pickers on ETHZ sites

The extension fills form fields and clicks the submit button. That's it.

## What we do NOT do
- ❌ Send your credentials to any server
- ❌ Log, track, or record your browsing activity
- ❌ Use analytics, telemetry, or tracking pixels
- ❌ Store your password in plain text
- ❌ Access any website outside `*.ethz.ch` and `wayf.switch.ch`
- ❌ Share data with any third party

## Network requests
This extension makes **zero** network requests. It does not contact any external server, API, or service. All functionality is entirely local.

## Permissions explained
| Permission | Why |
|---|---|
| `storage` | Save your credentials locally |
| `*://*.ethz.ch/*` | Detect and fill login forms on ETHZ sites |
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
