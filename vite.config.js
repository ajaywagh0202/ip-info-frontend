import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/ip-manager/',
  server: {
    port: 3000,
    strictPort: true, 
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        // Preserve the browser's LAN address for /api/ip instead of exposing
        // the Vite-to-backend loopback connection (::1).
        xfwd: true,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.removeHeader('origin');
          });
        },
      },
    },
  },
});
