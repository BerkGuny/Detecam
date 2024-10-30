const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('api', {
    getUserPassword: () => ipcRenderer.sendSync('get-user-password'),
    navigateToCameraPage: () => ipcRenderer.send('navigate-to-camera-page'),
    authenticate: (password) => ipcRenderer.invoke('authenticate', password)
});
