const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');

test('renderer exposes a cloud account panel wired to preload cloud APIs', () => {
  const html = fs.readFileSync(path.join(root, 'src', 'renderer', 'index.html'), 'utf-8');
  const renderer = fs.readFileSync(path.join(root, 'src', 'renderer', 'renderer.js'), 'utf-8');
  const preload = fs.readFileSync(path.join(root, 'src', 'main', 'preload.js'), 'utf-8');

  for (const id of [
    'cloudAccountPanel',
    'cloudLoginForm',
    'cloudUsernameInput',
    'cloudPasswordInput',
    'cloudStatusText',
    'cloudRefreshButton',
    'cloudLogoutButton'
  ]) {
    assert.match(html, new RegExp(`id="${id}"`));
    assert.match(renderer, new RegExp(id));
  }

  assert.match(preload, /loginCloudAccount/);
  assert.match(preload, /refreshCloudEntitlements/);
  assert.match(preload, /logoutCloudAccount/);
  assert.match(renderer, /loginCloudAccount/);
  assert.match(renderer, /refreshCloudEntitlements/);
  assert.match(renderer, /logoutCloudAccount/);
});
