import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [
    react(), 
    tailwindcss(),
    viteSingleFile({ useRecommendedBuildConfig: true }),
    {
      name: 'mock-pwa',
      resolveId(id) {
        if (id === 'virtual:pwa-register') return '\0virtual:pwa-register';
      },
      load(id) {
        if (id === '\0virtual:pwa-register') return 'export const registerSW = () => () => {};';
      }
    }
  ],
  define: {
    'import.meta.env.VITE_LOCAL_MODE': JSON.stringify('true'),
    'process': JSON.stringify({ env: { NODE_ENV: "production" } }),
  },
  build: {
    outDir: 'dist-local',
    emptyOutDir: true,
  },
});
