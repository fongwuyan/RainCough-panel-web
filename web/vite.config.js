import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  base: '/',
  publicDir: false,
  // 用带模板编译器的完整版 Vue: 系统扩展产物以 template 字符串写组件,
  // 由宿主运行时统一提供同一个 Vue 实例(见 src/ext-host.js)
  resolve: {
    alias: { vue: 'vue/dist/vue.esm-bundler.js' },
  },
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
