import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  build: { rollupOptions: { input: { main: resolve('index.html'), roadquest: resolve('roadquest.html') } } },
  server: {
    port: 5173,
    proxy: { '/api': 'http://127.0.0.1:4174', '/game-api': 'http://127.0.0.1:4174' }
  }
});
