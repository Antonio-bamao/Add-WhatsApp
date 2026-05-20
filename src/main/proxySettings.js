const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');

const HOST_RULE = /^[A-Za-z0-9.-]+$/;

function isValidProxyHost(host) {
  return Boolean(host && (net.isIP(host) || HOST_RULE.test(host)));
}

function normalizeProxySettings(value = {}) {
  const type = String(value.type || 'socks5').toLowerCase();
  if (type !== 'socks5') throw new Error('当前只支持 SOCKS5 代理。');
  const host = String(value.host || '').trim();
  const port = Number(value.port);
  const username = String(value.username || '').trim();
  const password = String(value.password || '');
  const ipMode = ['speed', 'ipv4', 'ipv6'].includes(String(value.ipMode || '').toLowerCase())
    ? String(value.ipMode).toLowerCase()
    : 'ipv4';
  const lookupChannel = String(value.lookupChannel || 'IP2Location').trim() || 'IP2Location';
  const changeReminder = value.changeReminder !== false;

  if (!isValidProxyHost(host)) throw new Error('代理主机格式不正确。');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('代理端口不正确。');
  if (username.length > 255 || password.length > 255) throw new Error('代理账号或密码过长。');

  return {
    type,
    host,
    port,
    username,
    password,
    ipMode,
    lookupChannel,
    changeReminder,
    baselineIp: value.baselineIp || null,
    lastExitIp: value.lastExitIp || null,
    lastProxyError: value.lastProxyError || null,
    savedAt: value.savedAt || null,
    lastCheckedAt: value.lastCheckedAt || null
  };
}

function buildProxyServer(settings) {
  const normalized = normalizeProxySettings(settings);
  const host = net.isIP(normalized.host) === 6 ? `[${normalized.host}]` : normalized.host;
  return `socks5://${host}:${normalized.port}`;
}

function publicProxySettings(settings) {
  if (!settings) return null;
  const normalized = normalizeProxySettings(settings);
  return {
    type: normalized.type,
    host: normalized.host,
    port: normalized.port,
    username: normalized.username,
    hasPassword: Boolean(normalized.password),
    ipMode: normalized.ipMode,
    lookupChannel: normalized.lookupChannel,
    changeReminder: normalized.changeReminder,
    savedAt: normalized.savedAt,
    lastCheckedAt: normalized.lastCheckedAt,
    baselineIp: normalized.baselineIp,
    lastExitIp: normalized.lastExitIp,
    lastProxyError: normalized.lastProxyError,
    proxyServer: buildProxyServer(normalized)
  };
}

class JsonProxySettingsStore {
  constructor(filePath) {
    this.filePath = filePath;
  }

  load() {
    if (!fs.existsSync(this.filePath)) return null;
    try {
      return normalizeProxySettings(JSON.parse(fs.readFileSync(this.filePath, 'utf-8')));
    } catch {
      return null;
    }
  }

  save(settings) {
    const normalized = normalizeProxySettings({
      ...settings,
      savedAt: settings.savedAt || new Date().toISOString()
    });
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(normalized, null, 2));
    return normalized;
  }
}

function writeAndWait(socket, bytes, expectedLength, timeoutMs) {
  return new Promise((resolve, reject) => {
    let buffer = Buffer.alloc(0);
    const timer = setTimeout(() => reject(new Error('代理检测超时。')), timeoutMs);
    const cleanup = () => {
      clearTimeout(timer);
      socket.off('data', onData);
      socket.off('error', onError);
    };
    const onError = error => {
      cleanup();
      reject(error);
    };
    const onData = chunk => {
      buffer = Buffer.concat([buffer, chunk]);
      if (buffer.length >= expectedLength) {
        cleanup();
        resolve(buffer);
      }
    };
    socket.on('data', onData);
    socket.on('error', onError);
    socket.write(bytes);
  });
}

function connectSocket({ host, port, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error('连接代理服务器超时。'));
    }, timeoutMs);
    socket.once('connect', () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.once('error', error => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

async function testSocks5Proxy(settings, options = {}) {
  const normalized = normalizeProxySettings(settings);
  const timeoutMs = Number(options.timeoutMs || 10000);
  const targetHost = options.targetHost || '1.1.1.1';
  const targetPort = Number(options.targetPort || 443);
  let socket;
  try {
    socket = await connectSocket({ host: normalized.host, port: normalized.port, timeoutMs });
    const methods = normalized.username || normalized.password
      ? Buffer.from([0x05, 0x02, 0x00, 0x02])
      : Buffer.from([0x05, 0x01, 0x00]);
    const methodResponse = await writeAndWait(socket, methods, 2, timeoutMs);
    if (methodResponse[0] !== 0x05 || methodResponse[1] === 0xff) {
      throw new Error('代理不接受当前认证方式。');
    }
    if (methodResponse[1] === 0x02) {
      const user = Buffer.from(normalized.username);
      const pass = Buffer.from(normalized.password);
      const authResponse = await writeAndWait(
        socket,
        Buffer.concat([Buffer.from([0x01, user.length]), user, Buffer.from([pass.length]), pass]),
        2,
        timeoutMs
      );
      if (authResponse[1] !== 0x00) throw new Error('代理账号或密码不正确。');
    }

    const hostParts = targetHost.split('.').map(part => Number(part));
    const request = Buffer.from([0x05, 0x01, 0x00, 0x01, ...hostParts, (targetPort >> 8) & 0xff, targetPort & 0xff]);
    const connectResponse = await writeAndWait(socket, request, 10, timeoutMs);
    if (connectResponse[1] !== 0x00) throw new Error(`代理无法连接测试目标，错误码 ${connectResponse[1]}。`);
    return {
      ok: true,
      checkedAt: new Date().toISOString(),
      proxyServer: buildProxyServer(normalized)
    };
  } finally {
    if (socket) socket.destroy();
  }
}

async function lookupExitIpViaSocks5(settings, options = {}) {
  const normalized = normalizeProxySettings(settings);
  const timeoutMs = Number(options.timeoutMs || 12000);
  const targetHost = options.targetHost || 'api.ipify.org';
  const targetPort = Number(options.targetPort || 80);
  let socket;
  try {
    socket = await connectSocket({ host: normalized.host, port: normalized.port, timeoutMs });
    const methods = normalized.username || normalized.password
      ? Buffer.from([0x05, 0x02, 0x00, 0x02])
      : Buffer.from([0x05, 0x01, 0x00]);
    const methodResponse = await writeAndWait(socket, methods, 2, timeoutMs);
    if (methodResponse[0] !== 0x05 || methodResponse[1] === 0xff) {
      throw new Error('代理不接受当前认证方式。');
    }
    if (methodResponse[1] === 0x02) {
      const user = Buffer.from(normalized.username);
      const pass = Buffer.from(normalized.password);
      const authResponse = await writeAndWait(
        socket,
        Buffer.concat([Buffer.from([0x01, user.length]), user, Buffer.from([pass.length]), pass]),
        2,
        timeoutMs
      );
      if (authResponse[1] !== 0x00) throw new Error('代理账号或密码不正确。');
    }

    const hostBuffer = Buffer.from(targetHost);
    const request = Buffer.concat([
      Buffer.from([0x05, 0x01, 0x00, 0x03, hostBuffer.length]),
      hostBuffer,
      Buffer.from([(targetPort >> 8) & 0xff, targetPort & 0xff])
    ]);
    const connectResponse = await writeAndWait(socket, request, 10, timeoutMs);
    if (connectResponse[1] !== 0x00) throw new Error(`代理无法连接出口 IP 查询服务，错误码 ${connectResponse[1]}。`);

    const httpResponse = await writeAndWait(
      socket,
      Buffer.from(`GET /?format=text HTTP/1.1\r\nHost: ${targetHost}\r\nConnection: close\r\n\r\n`),
      32,
      timeoutMs
    );
    const chunks = [httpResponse];
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('出口 IP 查询超时。')), timeoutMs);
      socket.on('data', chunk => chunks.push(chunk));
      socket.once('end', () => {
        clearTimeout(timer);
        resolve();
      });
      socket.once('error', error => {
        clearTimeout(timer);
        reject(error);
      });
    });
    const text = Buffer.concat(chunks).toString('utf-8');
    const body = text.split('\r\n\r\n').pop().trim();
    if (!/^[0-9a-fA-F:.]+$/.test(body)) throw new Error('出口 IP 查询返回异常。');
    return body;
  } finally {
    if (socket) socket.destroy();
  }
}

module.exports = {
  JsonProxySettingsStore,
  buildProxyServer,
  lookupExitIpViaSocks5,
  normalizeProxySettings,
  publicProxySettings,
  testSocks5Proxy
};
