import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    host: '::',
    port: 5173,
    strictPort: true,
    allowedHosts: true, // Разрешаем любые публичные туннели (*.loca.lt, *.trycloudflare.com и др.)
  },
  preview: {
    host: '::',
    port: 5173,
    allowedHosts: true,
  },
});
