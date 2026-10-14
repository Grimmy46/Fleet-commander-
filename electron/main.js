// ═══════════════════════════════════════════════════════════════
//  ELECTRON ENTRY — opens the game window
//
//  Three ways to run:
//    npm start          new engine, live Vite dev server with hot reload
//    npm run preview    new engine, built files (same as the installer)
//    npm run legacy     the old 0.14 canvas game (game.html + js/)
//
//  The installed app always runs the built new engine. Start it
//  with --legacy to get the 0.14 game.
// ═══════════════════════════════════════════════════════════════
const { app, BrowserWindow, screen } = require('electron');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LEGACY = process.argv.includes('--legacy');
const PROD = app.isPackaged || process.argv.includes('--prod');

// GPU acceleration, but KEEP vsync. Disabling the frame-rate
// limit makes Chromium render uncapped into a queue it cannot
// present, which reads as a high FPS counter and a frozen
// picture. Vsync-locked is both smoother and faster here.
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('canvas-oop-rasterization');

let win;
let devServer = null;

// Starts Vite inside the Electron process so `npm start` is a
// single command: no second terminal, no extra tools.
async function startDevServer() {
  const { createServer } = await import('vite');
  devServer = await createServer({
    configFile: path.join(ROOT, 'vite.config.mjs'),
    server: { port: 5173, strictPort: false }
  });
  await devServer.listen();
  return devServer.resolvedUrls.local[0];
}

async function loadContent() {
  if (LEGACY) return win.loadFile(path.join(ROOT, 'game.html'));
  if (PROD) return win.loadFile(path.join(ROOT, 'out', 'renderer', 'index.html'));
  try {
    const url = await startDevServer();
    console.log('[dev] Vite dev server at ' + url);
    return win.loadURL(url);
  } catch (e) {
    console.error('[dev] Could not start Vite, loading built files instead:', e.message);
    return win.loadFile(path.join(ROOT, 'out', 'renderer', 'index.html'));
  }
}

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  win = new BrowserWindow({
    width: Math.min(1920, width),
    height: Math.min(1080, height),
    minWidth: 1024,
    minHeight: 700,
    title: LEGACY ? 'Fleet Command — Deep Water (0.14)' : 'Fleet Command',
    backgroundColor: '#04080f',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false
    }
  });

  loadContent();

  // Go fullscreen AFTER the window exists and content is ready.
  // Creating a window with frame:false + fullscreen:true together
  // renders black on some Windows/GPU combinations.
  win.once('ready-to-show', () => {
    win.show();
    win.focus();
    setTimeout(() => {
      try { win.setFullScreen(true); } catch (e) {}
    }, 120);
  });

  // Surface renderer crashes instead of showing a black window
  win.webContents.on('render-process-gone', (e, details) => {
    console.error('RENDERER GONE:', details);
  });
  win.webContents.on('did-fail-load', (e, code, desc) => {
    console.error('LOAD FAILED:', code, desc);
  });
  win.webContents.on('console-message', (e) => {
    if (e.level === 'error' || e.level === 'warning') {
      console.error(`[renderer] ${e.message}  (${e.sourceId}:${e.lineNumber})`);
    }
  });

  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11' || (input.key === 'Enter' && input.alt)) {
      win.setFullScreen(!win.isFullScreen());
      win.setMenuBarVisibility(false);
      e.preventDefault();
    }
    // F12 opens devtools so problems are diagnosable
    if (input.key === 'F12') {
      win.webContents.toggleDevTools();
      e.preventDefault();
    }
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (devServer) devServer.close();
  if (process.platform !== 'darwin') app.quit();
});
