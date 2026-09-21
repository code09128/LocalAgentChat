import { app, BrowserWindow, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { pythonManager } from './python-manager.js';
import { writeLog } from './local_smart.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 解決 Linux 環境 GPU 驅動權限、沙箱與 /dev/shm 記憶體存取相容問題
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('no-sandbox');
  app.commandLine.appendSwitch('disable-gpu');
  app.commandLine.appendSwitch('disable-software-rasterizer');
  app.commandLine.appendSwitch('disable-dev-shm-usage');
}

let mainWindow: BrowserWindow | null = null;

async function detectAvailableDevUrl(): Promise<string> {
  const ports = [5173, 5174, 5175];
  for (const port of ports) {
    try {
      const res = await fetch(`http://localhost:${port}`);
      if (res.ok || res.status === 200 || res.status === 304) {
        return `http://localhost:${port}`;
      }
    } catch {
      // 該 port 未啟用，嘗試下一個
    }
  }
  return 'http://localhost:5173';
}

function resolvePreloadPath(): string {
  const candidates = [
    path.join(__dirname, 'preload.cjs'),
    path.resolve(process.cwd(), 'src/main/preload.cjs'),
    path.resolve(process.cwd(), 'dist-backend/main/preload.cjs'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return path.join(__dirname, 'preload.cjs');
}

export async function createDesktopWindow(devUrl?: string): Promise<BrowserWindow> {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.focus();
    return mainWindow;
  }

  const targetDevUrl = devUrl || await detectAvailableDevUrl();

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 960,
    minHeight: 600,
    title: 'Local Smart Desktop',
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: resolvePreloadPath(),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
  });

  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL || targetDevUrl);
  } else {
    const prodPath = path.resolve(process.cwd(), 'dist/index.html');
    if (fs.existsSync(prodPath)) {
      mainWindow.loadFile(prodPath);
    } else {
      mainWindow.loadURL(targetDevUrl);
    }
  }

  // 攔截外連網址以預設瀏覽器開啟
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  writeLog('INFO', 'Desktop: Main window created');
  return mainWindow;
}

export function setupDesktopLifecycle() {
  app.on('window-all-closed', () => {
    writeLog('INFO', 'Desktop: All windows closed');
    // 關閉 Python 後端以防殘留孤兒進程
    pythonManager.stop();
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('before-quit', () => {
    pythonManager.stop();
  });
}
