class ProxyMonitor {
  constructor({ loadSettings, saveSettings = () => {}, testProxy }) {
    this.loadSettings = loadSettings;
    this.saveSettings = saveSettings;
    this.testProxy = testProxy;
  }

  async checkNow() {
    const settings = this.loadSettings();
    if (!settings) {
      return { ok: false, error: '请先保存并检测 SOCKS5 代理。' };
    }

    try {
      const result = await this.testProxy(settings);
      const exitIp = result.exitIp || null;
      const checkedAt = result.checkedAt || new Date().toISOString();
      if (settings.baselineIp && exitIp && settings.baselineIp !== exitIp) {
        this.saveSettings({
          ...settings,
          lastCheckedAt: checkedAt,
          lastExitIp: exitIp,
          lastProxyError: `出口 IP 已变化：${settings.baselineIp} -> ${exitIp}`
        });
        return {
          ok: false,
          exitIp,
          error: `出口 IP 已变化：${settings.baselineIp} -> ${exitIp}`
        };
      }

      const next = {
        ...settings,
        baselineIp: settings.baselineIp || exitIp,
        lastExitIp: exitIp || settings.lastExitIp || null,
        lastCheckedAt: checkedAt,
        lastProxyError: null
      };
      this.saveSettings(next);
      return {
        ok: true,
        exitIp: next.lastExitIp,
        checkedAt
      };
    } catch (error) {
      this.saveSettings({
        ...settings,
        lastCheckedAt: new Date().toISOString(),
        lastProxyError: error.message
      });
      return { ok: false, error: error.message };
    }
  }
}

module.exports = {
  ProxyMonitor
};
