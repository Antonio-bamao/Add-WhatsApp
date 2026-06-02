const { clipboard, contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('addWhatsapp', {
  getAuthState: () => ipcRenderer.invoke('auth:get-state'),
  registerAccount: payload => ipcRenderer.invoke('auth:register', payload),
  loginAccount: payload => ipcRenderer.invoke('auth:login', payload),
  logoutAccount: () => ipcRenderer.invoke('auth:logout'),
  clearWhatsAppSession: () => ipcRenderer.invoke('auth:clear-whatsapp-session'),
  refreshCloudEntitlements: () => ipcRenderer.invoke('cloud:refresh-entitlements'),
  startManualTopUp: payload => ipcRenderer.invoke('cloud:manual-top-up', payload),
  startAlipayTopUp: payload => ipcRenderer.invoke('cloud:alipay-top-up', payload),
  startZpayTopUp: payload => ipcRenderer.invoke('cloud:zpay-top-up', payload),
  startWechatTopUp: payload => ipcRenderer.invoke('cloud:wechat-top-up', payload),
  openExternalUrl: url => ipcRenderer.invoke('app:open-external-url', url),
  copyText: text => ipcRenderer.invoke('app:copy-text', text),
  openAnotherWorkspace: payload => ipcRenderer.invoke('workspace:open-another-account', payload),
  getProxySettings: () => ipcRenderer.invoke('proxy:get'),
  testProxySettings: payload => ipcRenderer.invoke('proxy:test', payload),
  saveProxySettings: payload => ipcRenderer.invoke('proxy:save', payload),
  getSubscriptionState: () => ipcRenderer.invoke('subscription:get-state'),
  exportSyncPackage: password => ipcRenderer.invoke('sync:export', { password }),
  importSyncPackage: password => ipcRenderer.invoke('sync:import', { password }),
  getBootstrapState: () => ipcRenderer.invoke('app:bootstrap'),
  closeChoiceAction: action => ipcRenderer.invoke('app:close-choice-action', action),
  importContacts: options => ipcRenderer.invoke('contacts:select-and-import', options),
  exportReport: rows => ipcRenderer.invoke('report:export', { rows }),
  startTask: config => ipcRenderer.invoke('task:start', config),
  stopTask: () => ipcRenderer.invoke('task:stop'),
  getCurrentProgress: () => ipcRenderer.invoke('progress:get-current'),
  getTemplates: () => ipcRenderer.invoke('templates:get'),
  saveTemplates: templates => ipcRenderer.invoke('templates:save', templates),
  listHistory: () => ipcRenderer.invoke('history:list'),
  onTaskEvent: callback => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('task:event', listener);
    return () => ipcRenderer.removeListener('task:event', listener);
  },
  onHistoryUpdated: callback => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('history:updated', listener);
    return () => ipcRenderer.removeListener('history:updated', listener);
  },
  onShowCloseChoice: callback => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('app:show-close-choice', listener);
    return () => ipcRenderer.removeListener('app:show-close-choice', listener);
  },
  onAuthChanged: callback => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('auth:changed', listener);
    return () => ipcRenderer.removeListener('auth:changed', listener);
  }
});
