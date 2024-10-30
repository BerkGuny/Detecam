const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const authenticate = require('./auth'); // auth.js'i içe aktar
global.userPassword = '';

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            enableRemoteModule: false,
        },
    });
    mainWindow.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// Şifre doğrulama işlemini yönet
ipcMain.handle('authenticate', async (event, password) => {
    const isAuthenticated = await authenticate(password); // Şifre doğrulama
    if (isAuthenticated) {
        global.userPassword = password; // Kullanıcı şifresini global değişkende sakla
        mainWindow.loadFile(path.join(__dirname, 'cameraPage.html')); // Doğrulama başarılı ise yönlendir
        return true;
    } else {
        global.userPassword = ''; // Doğrulama başarısızsa şifreyi temizle
        return false;
    }
});

ipcMain.on('get-user-password', (event) => {
    event.returnValue = global.userPassword; // Yardımcı işleme şifreyi gönder
  });