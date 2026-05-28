const { mapCloudEntitlements } = require('../core/cloudApiClient');
const crypto = require('node:crypto');

function createCloudDesktopController({ client, sessionStore, deviceId = 'desktop' }) {
  async function login({ username, password }) {
    const session = await client.login({ username, password, deviceId });
    const entitlements = await client.getEntitlements(session.accessToken);
    const subscription = mapCloudEntitlements(entitlements);
    sessionStore.save({
      user: session.user,
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      entitlements
    });
    return {
      ok: true,
      cloud: publicCloudState({ ...sessionStore.load(), entitlements }),
      subscription
    };
  }

  async function refreshEntitlements() {
    const session = sessionStore.load();
    if (!session.authenticated || !session.accessToken) {
      return { ok: false, authRequired: true, error: '请先登录云端账号。' };
    }
    const entitlements = await client.getEntitlements(session.accessToken);
    const subscription = mapCloudEntitlements(entitlements);
    sessionStore.save({ ...session, entitlements });
    return {
      ok: true,
      cloud: publicCloudState({ ...session, entitlements }),
      subscription
    };
  }

  async function consumeSuccessfulAdds({ taskId, sentRows = [], workspaceId = 'main', sentAt }) {
    const session = sessionStore.load();
    if (!session.authenticated || !session.accessToken) {
      return { ok: true, skipped: true, authRequired: true };
    }
    const rows = Array.isArray(sentRows) ? sentRows : [];
    let entitlements = session.entitlements;
    for (const row of rows) {
      const rowKey = row && row.rowNumber ? row.rowNumber : rows.indexOf(row) + 1;
      const contactHash = hashContact(row && row.whatsappId ? row.whatsappId : `${taskId}:${rowKey}`);
      entitlements = await client.consumeCredit(session.accessToken, {
        idempotencyKey: `desktop-send:${taskId}:${rowKey}:${contactHash.slice(0, 16)}`,
        taskId,
        contactHash,
        workspaceId,
        sentAt
      });
    }
    const subscription = mapCloudEntitlements(entitlements);
    sessionStore.save({ ...session, entitlements });
    return {
      ok: true,
      consumed: rows.length,
      cloud: publicCloudState({ ...session, entitlements }),
      subscription
    };
  }

  function logout() {
    sessionStore.clear();
    return { ok: true, cloud: publicCloudState(sessionStore.load()) };
  }

  function getState() {
    return publicCloudState(sessionStore.load());
  }

  return {
    getState,
    consumeSuccessfulAdds,
    login,
    logout,
    refreshEntitlements
  };
}

function hashContact(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function publicCloudState(session) {
  return {
    authenticated: Boolean(session && session.authenticated),
    user: session && session.authenticated ? session.user : null,
    entitlements: session && session.authenticated ? session.entitlements : null
  };
}

module.exports = {
  createCloudDesktopController,
  publicCloudState
};
