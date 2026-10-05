const { app, BrowserWindow, screen } = require('electron');
const path = require('path');

// GPU acceleration, but KEEP vsync. Disabling the frame-rate
// limit makes Chromium render uncapped into a queue it cannot
// present, which reads as a high FPS counter and a frozen
// picture. Vsync-locked is both smoother and faster here.
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('canvas-oop-rasterization');

let win;

function createWindow() {
  const display = screen.getPrimaryDisplay();
  const { width, height } = display.workAreaSize;

  win = new BrowserWindow({
    width: Math.min(1920, width),
    height: Math.min(1080, height),
    minWidth: 1024,
    minHeight: 700,
    title: 'Fleet Command — Deep Water',
    backgroundColor: '#04080f',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false
    }
  });

  win.loadFile('game.html');

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
  win.webContents.on('console-message', (e, level, message, line, sourceId) => {
    if (level >= 2) console.error(`[renderer] ${message}  (${sourceId}:${line})`);
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
  if (process.platform !== 'darwin') app.quit();
});
