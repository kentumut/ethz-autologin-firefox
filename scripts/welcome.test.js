const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { JSDOM } = require('jsdom');

function setup(t, initial = {}) {
  const src = path.resolve(__dirname, '../src');
  const dom = new JSDOM(fs.readFileSync(path.join(src, 'welcome.html'), 'utf8'), {
    url: 'https://extension.test/welcome.html', runScripts: 'outside-only'
  });
  t.after(() => dom.window.close());
  const state = { ...initial };
  let writes = 0;
  dom.window.chrome = {
    runtime: {},
    action: { setBadgeText() {} },
    storage: { local: {
      set(values, callback) { writes++; Object.assign(state, values); callback(); },
      remove(keys, callback) { writes++; keys.forEach(key => delete state[key]); callback(); }
    } }
  };
  dom.window.eval(fs.readFileSync(path.join(src, 'welcome.js'), 'utf8'));
  const el = id => dom.window.document.getElementById(id);
  return { state, el, get writes() { return writes; }, choose(id) { el(id).click(); el('next-1').click(); } };
}

test('welcome requires an explicit login method and validates stored credentials', t => {
  const page = setup(t);
  page.el('next-1').click();
  assert.match(page.el('error-1').textContent, /choose/);
  page.choose('mode-extension');
  assert.equal(page.el('extension-fields').hidden, false);
  assert.equal(page.el('browser-help').hidden, true);
  page.el('next-2').click();
  assert.match(page.el('error-2').textContent, /username/);
  page.el('username').value = 'test-user';
  page.el('next-2').click();
  assert.match(page.el('error-2').textContent, /password/);
  assert.equal(page.writes, 0);
});

test('welcome saves opt-in credentials and clears stale failure/pause flags', t => {
  const page = setup(t, { ethz_login_failed: true, ethz_automation_paused_until: Date.now() + 60000 });
  page.choose('mode-extension');
  page.el('username').value = ' test-user ';
  page.el('password').value = 'dummy-password';
  page.el('next-2').click();
  assert.deepEqual(page.state, {
    ethz_username: 'test-user', ethz_password: 'dummy-password',
    ethz_login_mode: 'extension_storage', ethz_password_manager_enabled: false
  });
  assert.equal(page.el('password').value, '');
  assert.ok(page.el('step-3').classList.contains('active'));
  assert.match(page.el('done-mode').textContent, /saved in this extension/);
});

test('browser mode removes any old extension password without asking for a new one', t => {
  const page = setup(t, { ethz_password: 'old-dummy-password' });
  page.choose('mode-browser');
  assert.equal(page.el('extension-fields').hidden, true);
  page.el('username').value = 'test-user';
  page.el('next-2').click();
  assert.equal(page.state.ethz_login_mode, 'password_manager');
  assert.equal(page.state.ethz_password_manager_enabled, true);
  assert.equal(page.state.ethz_password, undefined);
  assert.match(page.el('done-mode').textContent, /browser password manager/);
});

test('back and skip clear password input without saving or enabling anything', t => {
  const page = setup(t);
  page.choose('mode-extension');
  page.el('password').value = 'dummy-password';
  page.el('back-2').click();
  assert.equal(page.el('password').value, '');
  page.choose('mode-extension');
  page.el('password').value = 'dummy-password';
  page.el('skip-2').click();
  assert.equal(page.el('password').value, '');
  assert.equal(page.writes, 0);
  assert.equal(page.el('done-title').textContent, 'Set up later.');
});
