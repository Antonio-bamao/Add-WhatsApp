const path = require('node:path');

const AUTH_REQUIRED_ERROR = /请先登录本地账号/;

function accountDirectoryFor(userDataPath, accountId) {
  return path.join(userDataPath, 'accounts', accountId);
}

class AccountContext {
  constructor({ userDataPath }) {
    if (!userDataPath) throw new Error('userDataPath is required.');
    this.userDataPath = userDataPath;
    this.currentUser = null;
  }

  setCurrentUser(user) {
    if (!user || !user.accountId) throw new Error('账号上下文缺少 accountId。');
    this.currentUser = { ...user };
    return this.currentUser;
  }

  getCurrentUser() {
    return this.currentUser ? { ...this.currentUser } : null;
  }

  clear() {
    this.currentUser = null;
  }

  requireCurrentUser() {
    if (!this.currentUser) throw new Error('请先登录本地账号。');
    return this.getCurrentUser();
  }

  accountDir(accountId = this.requireCurrentUser().accountId) {
    return accountDirectoryFor(this.userDataPath, accountId);
  }

  accountPath(...segments) {
    return path.join(this.accountDir(), ...segments);
  }
}

module.exports = {
  AUTH_REQUIRED_ERROR,
  AccountContext,
  accountDirectoryFor
};
