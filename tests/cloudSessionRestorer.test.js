const test = require('node:test');
const assert = require('node:assert/strict');

const { restoreAuthenticatedSession } = require('../src/main/cloudSessionRestorer');

test('restored authenticated cloud sessions initialize account stores and retry pending cloud syncs and import audits', () => {
  const calls = [];
  const restored = restoreAuthenticatedSession({
    cloudState: () => ({
      authenticated: true,
      user: { id: 'user_c74e30f6-9f85-4ca0-a5fd-b1f94400cb50', username: 'cloud-user' }
    }),
    accountContext: {
      setCurrentUser(user) {
        calls.push(['set-user', user.accountId, user.username, user.uid]);
      }
    },
    initializeAccountStores() {
      calls.push(['init-stores']);
    },
    schedulePendingCloudSyncRetry() {
      calls.push(['retry-pending']);
    },
    schedulePendingContactImportAuditRetry() {
      calls.push(['retry-contact-imports']);
    }
  });

  assert.equal(restored, true);
  assert.deepEqual(calls, [
    ['set-user', 'user_c74e30f6-9f85-4ca0-a5fd-b1f94400cb50', 'cloud-user', '70865138'],
    ['init-stores'],
    ['retry-pending'],
    ['retry-contact-imports']
  ]);
});

test('restore skips pending sync retry when no authenticated cloud user exists', () => {
  const calls = [];
  const restored = restoreAuthenticatedSession({
    cloudState: () => ({ authenticated: false, user: null }),
    accountContext: {
      setCurrentUser() {
        calls.push(['set-user']);
      }
    },
    initializeAccountStores() {
      calls.push(['init-stores']);
    },
    schedulePendingCloudSyncRetry() {
      calls.push(['retry-pending']);
    },
    schedulePendingContactImportAuditRetry() {
      calls.push(['retry-contact-imports']);
    }
  });

  assert.equal(restored, false);
  assert.deepEqual(calls, []);
});
