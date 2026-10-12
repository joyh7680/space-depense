import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  base: './',
  server: { port: 5174, strictPort: true },
  build: { rollupOptions: { output: { manualChunks: { phaser: ['phaser'] } } } },
});
