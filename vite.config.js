import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import { localAiOnly } from './server/ai/access.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    {
      name: 'local-ai-access',
      configureServer(server) {
        server.middlewares.use('/ai-api', localAiOnly)
      },
      configurePreviewServer(server) {
        server.middlewares.use('/ai-api', localAiOnly)
      },
    },
    vue(),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // 监听 0.0.0.0，允许局域网设备访问（手机/同网设备）
    host: true,
    // Runtime caches can contain locked database files; they are not frontend sources.
    watch: {
      ignored: ['**/.desktop-cache/**', '**/.impeccable/review/**'],
    },
    proxy: {
      '/ai-api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
