const crypto = require('node:crypto');
const path = require('node:path');

const WORKSPACE_ARG = '--add-whatsapp-workspace=';
const PROXY_ARG = '--add-whatsapp-proxy=';
const WORKSPACE_ID_RULE = /^workspace-\d{8}-[a-f0-9]{8}$/;
const SOCKS5_PROXY_RULE = /^socks5:\/\/[A-Za-z0-9.-]+:\d{2,5}$/;

function createWorkspaceId(date = new Date()) {
  const day = date.toISOString().slice(0, 10).replaceAll('-', '');
  return `workspace-${day}-${crypto.randomBytes(4).toString('hex')}`;
}

function parseWorkspaceId(argv = []) {
  const match = argv
    .map(arg => String(arg || ''))
    .find(arg => arg.startsWith(WORKSPACE_ARG));
  if (!match) return null;
  const value = match.slice(WORKSPACE_ARG.length);
  return WORKSPACE_ID_RULE.test(value) ? value : null;
}

function normalizeProxyServer(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return null;
  const proxy = trimmed.includes('://') ? trimmed : `socks5://${trimmed}`;
  if (!proxy.startsWith('socks5://')) {
    throw new Error('当前只支持 SOCKS5 代理，例如 socks5://186.192.1.1:1080。');
  }
  if (!SOCKS5_PROXY_RULE.test(proxy)) {
    throw new Error('代理格式不正确，请使用 socks5://IP或域名:端口。');
  }
  const port = Number(proxy.split(':').pop());
  if (port < 1 || port > 65535) {
    throw new Error('代理端口不正确。');
  }
  return proxy;
}

function parseWorkspaceProxy(argv = []) {
  const match = argv
    .map(arg => String(arg || ''))
    .find(arg => arg.startsWith(PROXY_ARG));
  if (!match) return null;
  try {
    return normalizeProxyServer(match.slice(PROXY_ARG.length));
  } catch {
    return null;
  }
}

function workspaceUserDataPath(appDataPath, workspaceId) {
  if (!WORKSPACE_ID_RULE.test(workspaceId)) throw new Error('工作台标识不安全。');
  return path.join(appDataPath, 'add-whatsapp-desktop-workspaces', workspaceId);
}

function workspaceLaunchArgs({ isPackaged, appPath, workspaceId, proxyServer = null }) {
  const args = [`${WORKSPACE_ARG}${workspaceId}`];
  const normalizedProxy = proxyServer ? normalizeProxyServer(proxyServer) : null;
  if (normalizedProxy) args.push(`${PROXY_ARG}${normalizedProxy}`);
  return isPackaged ? args : [appPath, ...args];
}

module.exports = {
  WORKSPACE_ARG,
  PROXY_ARG,
  createWorkspaceId,
  normalizeProxyServer,
  parseWorkspaceId,
  parseWorkspaceProxy,
  workspaceLaunchArgs,
  workspaceUserDataPath
};
