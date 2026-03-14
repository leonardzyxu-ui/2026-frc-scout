import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(), 
    tailwindcss(),
    viteSingleFile(),
    VitePWA({
      injectRegister: 'auto',
      workbox: {
        globPatterns: []
      }
    })
  ],
  define: {
    'import.meta.env.VITE_LOCAL_MODE': JSON.stringify('true'),
  },
  build: {
    outDir: 'dist-local',
    emptyOutDir: true,
  },
});
