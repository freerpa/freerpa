import { createApp } from 'vue'
import ArcoVue from '@arco-design/web-vue'
import '@arco-design/web-vue/dist/arco.css'
import '@arco-themes/vue-xavier/css/arco.css'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import { loadPluginNodes } from '@/workflow/nodes'
import { confirmExit } from '@/utils/confirmExit'

const app = createApp(App)
const pinia = createPinia()

app.use(ArcoVue)
app.use(pinia)
app.use(router)
app.mount('#app')

// 托盘「退出软件」：主进程已恢复主窗口，弹确认框（与关闭确认逻辑一致），确认后退出
window.electronAPI.window.onRequestExit(() => confirmExit())

// 预加载本地插件节点注册（plu_<插件id>），供节点面板/工作流加载使用
loadPluginNodes()
