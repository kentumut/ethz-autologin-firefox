const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { JSDOM, VirtualConsole } = require('jsdom');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/content.js'), 'utf8');
const accessUrl = 'https://access.ethz.ch/idpauthapp/';
const fieldPrefix = 'com.siemens.dxa.applications.web.authn.challenging.';
// Public form structure observed on ETH Access; no real credentials or tokens.
const accessForm = `
  <form id="dataForm" method="post" action="${accessUrl}">
    <div id="failList" class="failList" role="alert"></div>
    <input type="text" name="${fieldPrefix}username" autocomplete="username">
    <input type="password" name="${fieldPrefix}response" autocomplete="current-password">
    <button type="submit">Next</button>
  </form>`;

function setup(t, { html = accessForm, url = accessUrl, state = {}, bypassed = false } = {}) {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', error => errors.push(error));
  const dom = new JSDOM(html, { url, runScripts: 'outside-only', virtualConsole });
  const { window } = dom;
  window.setTimeout = setTimeout;
  window.clearTimeout = clearTimeout;
  window.setInterval = setInterval;
  window.clearInterval = clearInterval;
  // jsdom has no layout engine; expose non-hidden controls as visible.
  Object.defineProperty(window.HTMLElement.prototype, 'offsetParent', {
    get() { return this.hidden || this.style.display === 'none' ? null : this.parentElement; }
  });
  const stored = { ethz_login_mode: 'password_manager', ...state };
  const reads = [];
  const messages = [];
  const storage = {
    get(keys, callback) {
      reads.push(keys);
      callback(Object.fromEntries(keys.filter(key => key in stored).map(key => [key, stored[key]])));
    },
    set(values) { Object.assign(stored, values); }
  };
  window.chrome = {
    storage: { local: storage, session: storage },
    runtime: { sendMessage(message, callback) {
      messages.push(message);
      if (callback) callback({ bypassed });
    } }
  };
  let submits = 0;
  window.document.addEventListener('submit', event => {
    event.preventDefault();
    submits++;
  });
  t.after(() => {
    dom.window.close();
    assert.deepEqual(errors, [], 'content script must not cause DOM errors');
  });
  return {
    window, reads, messages, stored,
    run: () => window.eval(source),
    tick: ms => t.mock.timers.tick(ms),
    get submits() { return submits; },
    get user() { return window.document.querySelector('input[type="text"]'); },
    get password() { return window.document.querySelector('input[type="password"]'); }
  };
}

test('both manifests inject login automation on the new HTTPS endpoint', () => {
  for (const file of ['manifest.json', 'manifest.firefox.json']) {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'src', file), 'utf8'));
    const matches = manifest.content_scripts.find(script => script.js.includes('content.js')).matches;
    assert.ok(matches.includes('https://access.ethz.ch/idpauthapp/*'));
    assert.ok(matches.includes('https://access.ethz.ch/idpauthapp'));
    assert.ok(!matches.includes('*://*.ethz.ch/*'));
  }
});

test('Access submits browser-filled credentials once without recursive input events', t => {
  const page = setup(t);
  page.run();
  page.user.value = 'test-user';
  page.password.value = 'dummy-password';
  page.password.dispatchEvent(new page.window.Event('input', { bubbles: true }));
  page.tick(300);
  assert.equal(page.submits, 1);
  page.tick(6000);
  assert.equal(page.submits, 1);
  assert.equal(page.stored.ethz_password, undefined);
  assert.equal(page.window.document.querySelector('#ethz-autologin-toast'), null);
});

test('Access fills opt-in credentials and submits its own form, not an unrelated form', t => {
  const page = setup(t, {
    html: '<form id="unrelated"><input name="username"><input type="password"><button>Search</button></form>' + accessForm,
    state: { ethz_login_mode: 'extension_storage', ethz_username: 'test-user', ethz_password: 'dummy-password' }
  });
  const form = page.window.document.querySelector('#dataForm');
  let submittedForm;
  page.window.document.addEventListener('submit', event => { submittedForm = event.target; });
  page.run();
  assert.equal(form.querySelector('input[type="text"]').value, 'test-user');
  assert.equal(form.querySelector('input[type="password"]').value, 'dummy-password');
  assert.equal(page.window.document.querySelector('#unrelated input[type="password"]').value, '');
  page.tick(300);
  assert.equal(page.submits, 1);
  assert.equal(submittedForm, form);
});

test('Access fills stored credentials when the form is rendered after the script starts', t => {
  const page = setup(t, { html: '<main>Loading</main>', state: {
    ethz_login_mode: 'extension_storage', ethz_username: 'test-user', ethz_password: 'dummy-password'
  } });
  page.run();
  page.tick(1000);
  assert.ok(!page.reads.some(keys => keys.includes('ethz_password')));
  page.window.document.body.innerHTML = accessForm;
  page.tick(150);
  assert.equal(page.user.value, 'test-user');
  assert.equal(page.password.value, 'dummy-password');
  page.tick(300);
  assert.equal(page.submits, 1);
  page.tick(15000);
  assert.equal(page.submits, 1);
});

test('Access waits until temporarily disabled credential fields are ready', t => {
  const page = setup(t, { html: accessForm.replace('type="text"', 'type="text" disabled'), state: {
    ethz_login_mode: 'extension_storage', ethz_username: 'test-user', ethz_password: 'dummy-password'
  } });
  page.run();
  page.tick(1000);
  page.user.disabled = false;
  page.tick(150);
  assert.equal(page.password.value, 'dummy-password');
  page.tick(300);
  assert.equal(page.submits, 1);
});

test('Access rechecks a form restored from the back/forward cache', t => {
  const page = setup(t, { state: {
    ethz_login_mode: 'extension_storage', ethz_username: 'test-user', ethz_password: 'dummy-password'
  } });
  page.run();
  page.tick(300);
  assert.equal(page.submits, 1);
  page.window.dispatchEvent(new page.window.PageTransitionEvent('pagehide', { persisted: true }));
  page.user.value = '';
  page.password.value = '';
  page.window.dispatchEvent(new page.window.PageTransitionEvent('pageshow', { persisted: true }));
  assert.equal(page.password.value, 'dummy-password');
  page.tick(300);
  assert.equal(page.submits, 2);
});

test('delayed Access form discovery rechecks pause state before filling', t => {
  const page = setup(t, { html: '<main>Loading</main>', state: {
    ethz_login_mode: 'extension_storage', ethz_username: 'test-user', ethz_password: 'dummy-password'
  } });
  page.run();
  page.stored.ethz_automation_paused_until = Date.now() + 60000;
  page.window.document.body.innerHTML = accessForm;
  page.tick(150);
  page.tick(300);
  assert.equal(page.password.value, '');
  assert.equal(page.submits, 0);
});

test('leaving Access cancels pending submission before a cached page is restored', t => {
  const page = setup(t, { state: {
    ethz_login_mode: 'extension_storage', ethz_username: 'test-user', ethz_password: 'dummy-password'
  } });
  page.run();
  page.window.dispatchEvent(new page.window.PageTransitionEvent('pagehide', { persisted: true }));
  page.tick(300);
  assert.equal(page.submits, 0);
  page.stored.ethz_login_failed = true;
  page.user.value = '';
  page.password.value = '';
  page.window.dispatchEvent(new page.window.PageTransitionEvent('pageshow', { persisted: true }));
  page.tick(300);
  assert.equal(page.password.value, '');
  assert.equal(page.submits, 0);
});

test('Access form discovery stops after its deadline', t => {
  const page = setup(t, { html: '<main>Loading</main>', state: {
    ethz_login_mode: 'extension_storage', ethz_username: 'test-user', ethz_password: 'dummy-password'
  } });
  page.run();
  page.tick(15000);
  page.window.document.body.innerHTML = accessForm;
  page.tick(1000);
  assert.equal(page.password.value, '');
  assert.equal(page.submits, 0);
});

for (const [name, options] of [
  ['paused automation', { state: { ethz_automation_paused_until: Date.now() + 60000 } }],
  ['recent logout', { bypassed: true }],
  ['previous failure', { state: { ethz_login_failed: true } }],
  ['disabled setup', { state: { ethz_login_mode: null } }],
  ['visible Access error', { html: accessForm.replace('role="alert"></div>', 'role="alert">Authentication failed</div>') }],
]) {
  test(`Access does not submit after ${name}`, t => {
    const page = setup(t, options);
    page.user.value = 'test-user';
    page.password.value = 'dummy-password';
    page.run();
    page.tick(6000);
    assert.equal(page.submits, 0);
    if (name === 'visible Access error') assert.ok(page.messages.some(message => message.type === 'LOGIN_FAILED'));
  });
}

for (const [name, options] of [
  ['an unrelated Access path', { url: 'https://access.ethz.ch/other/' }],
  ['a similar path prefix', { url: 'https://access.ethz.ch/idpauthapp-untrusted/' }],
  ['HTTP', { url: 'http://access.ethz.ch/idpauthapp/' }],
  ['a lookalike host', { url: 'https://access.ethz.ch.example.org/idpauthapp/' }],
  ['an external form action', { html: accessForm.replace(`action="${accessUrl}"`, 'action="https://example.org/"') }],
  ['a different form action path', { html: accessForm.replace(`action="${accessUrl}"`, 'action="https://access.ethz.ch/other/"') }],
  ['a GET form', { html: accessForm.replace('method="post"', 'method="get"') }],
  ['a button overriding the form destination', { html: accessForm.replace('<button type="submit">', '<button type="submit" formaction="https://example.org/">') }],
  ['a malformed form action', { html: accessForm.replace(`action="${accessUrl}"`, 'action="https://[invalid"') }],
  ['an OTP challenge', { html: accessForm.replace('autocomplete="current-password"', 'autocomplete="one-time-code"') }],
  ['a hidden username challenge', { html: accessForm.replace('type="text"', 'type="hidden"') }],
]) {
  test(`does not read credentials or submit on ${name}`, t => {
    const page = setup(t, { ...options, state: {
      ethz_login_mode: 'extension_storage', ethz_username: 'test-user', ethz_password: 'dummy-password'
    } });
    page.run();
    page.tick(6000);
    assert.equal(page.submits, 0);
    assert.ok(!page.reads.some(keys => keys.includes('ethz_password')));
    assert.equal(page.password.value, '');
  });
}

test('Access stops waiting and prompts when password-manager autofill never arrives', t => {
  const page = setup(t);
  page.run();
  page.tick(5000);
  assert.match(page.window.document.querySelector('#ethz-autologin-toast').textContent, /Password manager needed/);
  page.user.value = 'test-user';
  page.password.value = 'dummy-password';
  page.password.dispatchEvent(new page.window.Event('input'));
  page.tick(300);
  assert.equal(page.submits, 0);
});

for (const [name, url, html] of [
  ['legacy IdP', 'https://aai-logon.ethz.ch/idp/', '<form><input type="text" name="j_username"><input type="password" name="j_password"><button type="submit" name="_eventId_proceed">Login</button></form>'],
  ['GitLab LDAP', 'https://gitlab.inf.ethz.ch/users/sign_in', '<form><input type="text" id="ldapmain_username"><input type="password" id="ldapmain_password"><button type="submit">Sign in</button></form>'],
]) {
  test(`${name} still submits browser-filled credentials`, t => {
    const page = setup(t, { url, html });
    page.user.value = 'test-user';
    page.password.value = 'dummy-password';
    page.run();
    page.tick(300);
    assert.equal(page.submits, 1);
  });
}
