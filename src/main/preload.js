const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('addWhatsapp', {
  importContacts: () => ipcRenderer.invoke('contacts:select-and-import'),
  exportReport: rows => ipcRenderer.invoke('report:export', { rows }),
  startTask: config => ipcRenderer.invoke('task:start', config),
  stopTask: () => ipcRenderer.invoke('task:stop'),
  onTaskEvent: callback => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('task:event', listener);
    return () => ipcRenderer.removeListener('task:event', listener);
  }
});
