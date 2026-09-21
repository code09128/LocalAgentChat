const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('desktopApp', {
  platform: process.platform,
  isElectron: true,
  version: process.env.npm_package_version || '1.0.0',
});
