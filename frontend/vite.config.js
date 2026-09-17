import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5100',
        changeOrigin: true,
      },
    },
  },
  // Used when the app is started with `vite preview` (e.g. on Render).
  // Vite blocks requests whose Host header isn't localhost or explicitly
  // allow-listed here, to prevent DNS-rebinding attacks — without this,
  // a public deployment gets a 403 "Blocked request" on every page.
  preview: {
    host: '0.0.0.0',
    port: Number(process.env.PORT) || 4173,
    allowedHosts: ['employeeos-1.onrender.com'],
  },
});
