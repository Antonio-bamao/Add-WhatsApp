const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('addWhatsapp', {
  importContacts: () => ipcRenderer.invoke('contacts:select-and-import'),
  exportReport: rows => ipcRenderer.invoke('report:export', { rows })
});
