import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
        ws: true, // Proxy WebSocket connections
      },
      '/manifest.json': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/icons': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      }
    }
  },
  build: {
    outDir: '../server/public',
    emptyOutDir: true,
    assetsDir: 'assets',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        overlay: resolve(__dirname, 'overlay.html'),
        mobile: resolve(__dirname, 'mobile.html'),
        test: resolve(__dirname, 'test-livepix.html')
      }
    }
  }
});
