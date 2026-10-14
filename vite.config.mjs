// Vite builds the new engine from src/ into out/renderer/.
// base './' makes every path relative so Electron can load the
// built index.html straight from disk.
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src',
  base: './',
  publicDir: false,
  build: {
    outDir: '../out/renderer',
    emptyOutDir: true,
    target: 'chrome120',
    chunkSizeWarningLimit: 1500
  },
  server: {
    port: 5173
  }
});
