import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  base: '/',
  publicDir: false,
  build: {
    outDir: '../public',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1024,
    target: 'esnext',
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
