const http = require('node:http');
const { URL } = require('node:url');
const { SocksClient } = require('socks');

function socksProxyOptions(settings) {
  return {
    host: settings.host,
    port: settings.port,
    type: 5,
    userId: settings.username || undefined,
    password: settings.password || undefined
  };
}

function parseConnectTarget(value) {
  const [host, port] = String(value || '').split(':');
  if (!host || !port) throw new Error('代理目标地址不正确。');
  return { host, port: Number(port) };
}

class LocalProxyBridge {
  constructor(settings, options = {}) {
    this.settings = settings;
    this.socksClient = options.socksClient || SocksClient;
    this.server = null;
    this.serverUrl = null;
  }

  async start() {
    if (this.serverUrl) return this.serverUrl;
    this.server = http.createServer((request, response) => {
      this.handleHttpRequest(request, response).catch(error => {
        response.writeHead(502);
        response.end(error.message);
      });
    });
    this.server.on('connect', (request, clientSocket, head) => {
      this.handleConnectRequest(request, clientSocket, head).catch(() => {
        clientSocket.end('HTTP/1.1 502 Bad Gateway\r\n\r\n');
      });
    });

    await new Promise((resolve, reject) => {
      this.server.once('error', reject);
      this.server.listen(0, '127.0.0.1', resolve);
    });
    const address = this.server.address();
    this.serverUrl = `http://127.0.0.1:${address.port}`;
    return this.serverUrl;
  }

  async stop() {
    if (!this.server) return;
    const server = this.server;
    this.server = null;
    this.serverUrl = null;
    await new Promise(resolve => server.close(resolve));
  }

  async createSocksConnection(destination) {
    const result = await this.socksClient.createConnection({
      command: 'connect',
      destination,
      proxy: socksProxyOptions(this.settings),
      timeout: 15000
    });
    return result.socket;
  }

  async handleConnectRequest(request, clientSocket, head) {
    const destination = parseConnectTarget(request.url);
    const proxySocket = await this.createSocksConnection(destination);
    clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
    if (head && head.length) proxySocket.write(head);
    clientSocket.pipe(proxySocket);
    proxySocket.pipe(clientSocket);
  }

  async handleHttpRequest(request, response) {
    const target = new URL(request.url);
    const port = Number(target.port || (target.protocol === 'https:' ? 443 : 80));
    const proxySocket = await this.createSocksConnection({ host: target.hostname, port });
    const path = `${target.pathname}${target.search}`;
    proxySocket.write(`${request.method} ${path} HTTP/${request.httpVersion}\r\n`);
    for (const [name, value] of Object.entries(request.headers)) {
      if (name.toLowerCase() === 'proxy-connection') continue;
      proxySocket.write(`${name}: ${value}\r\n`);
    }
    proxySocket.write('\r\n');
    request.pipe(proxySocket);
    proxySocket.pipe(response.socket);
  }
}

module.exports = {
  LocalProxyBridge,
  parseConnectTarget,
  socksProxyOptions
};
