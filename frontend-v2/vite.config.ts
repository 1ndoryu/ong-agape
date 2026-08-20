import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/* El proxy apunta al backend de Ágape. BACKEND_PROXY permite redirigirlo en
 * entornos donde el puerto 3000 esté ocupado (p. ej. BACKEND_PROXY=http://localhost:58588). */
const backendTarget = process.env.BACKEND_PROXY || 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    /* 5173-5175 suelen estar ocupados por otros dev servers del área de trabajo */
    port: 5176,
    proxy: {
      '/api': {
        target: backendTarget,
        changeOrigin: true,
      },
    },
  },
});
