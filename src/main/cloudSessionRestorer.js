const crypto = require('node:crypto');

function shortUserUid(userId) {
  const digest = crypto.createHash('sha256').update(String(userId || '')).digest('hex');
  const number = Number.parseInt(digest.slice(0, 12), 16) % 100000000;
  return String(number).padStart(8, '0');
}

function desktopUserFromCloudUser(user = {}) {
  const uidSource = user.id || user.cloudUserId || user.accountId;
  return {
    accountId: user.id || user.accountId || user.username,
    username: user.username || user.email || user.id,
    cloudUserId: user.id || user.cloudUserId || null,
    uid: user.uid || (uidSource ? shortUserUid(uidSource) : null)
  };
}

function restoreAuthenticatedSession({
  cloudState,
  accountContext,
  initializeAccountStores,
  schedulePendingCloudSyncRetry,
  mapCloudUser = desktopUserFromCloudUser
}) {
  const cloud = cloudState();
  if (!cloud.authenticated || !cloud.user) return false;
  accountContext.setCurrentUser(mapCloudUser(cloud.user));
  initializeAccountStores();
  if (typeof schedulePendingCloudSyncRetry === 'function') schedulePendingCloudSyncRetry();
  return true;
}

module.exports = {
  restoreAuthenticatedSession
};
