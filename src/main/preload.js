const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('addWhatsapp', {
  getBootstrapState: () => ipcRenderer.invoke('app:bootstrap'),
  importContacts: () => ipcRenderer.invoke('contacts:select-and-import'),
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
  }
});
