import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { VueQueryPlugin } from '@tanstack/vue-query'
// 开发调试工具，生产自动移除
import { VueQueryDevtools } from '@tanstack/vue-query-devtools'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
// 本地字体（避免 CDN 依赖）：展示字体 Bricolage Grotesque + 等宽 JetBrains Mono
import '@fontsource-variable/bricolage-grotesque'
import '@fontsource-variable/jetbrains-mono'
import App from './App.vue'
import router from './router'
import './styles/globals.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(ElementPlus)
app.use(VueQueryPlugin, {
  queryClientConfig: {
    defaultOptions: {
      queries: {
        retry: 1, // 接口失败重试1次
        staleTime: 30_000, // 30秒内数据新鲜，不重复请求
        refetchOnWindowFocus: true,
        refetchOnReconnect: true, // 断网重连刷新
        refetchOnMount: true, // 组件挂载不重复请求缓存数据
      },
    },
  },
})

// 全局挂载调试工具
app.component('VueQueryDevtools', VueQueryDevtools)

app.mount('#app')
