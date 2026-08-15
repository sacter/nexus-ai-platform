import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      // 纯常量 workspace 包直接消费 TS 源（api 侧仍消费 dist）；避免 Rollup 对 CJS dist 的命名导出检测问题
      '@nexus/model-config': resolve(__dirname, '../../packages/model-config/src/index.ts'),
    },
  },
  server: {
    port: 3034,
    proxy: {
      // 仅代理 API 请求；SPA 路由（如 /api-keys）不受影响
      '/api/v1': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
