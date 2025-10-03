import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In Codespaces the browser cannot reach container's localhost:5000 directly.
// Proxy backend API paths through the Vite dev server.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/auth': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/files': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});
