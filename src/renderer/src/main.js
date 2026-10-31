import { createApp } from 'vue'
import ArcoVue from '@arco-design/web-vue'
import '@arco-design/web-vue/dist/arco.css'
import '@arco-themes/vue-xavier/css/arco.css'
import './styles/macos.less'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import { loadPluginNodes } from '@/workflow/nodes'
import { confirmExit } from '@/utils/confirmExit'
import { registerMcpExecutor } from './mcp'

// 平台标识：全局样式据此做平台差异适配（Windows 下 0.5px 发丝边框会因
// 设备像素取整而消失，需升级为 1px）。用 UA 同步判断，避免首帧闪烁。
document.body.classList.add(/Windows/i.test(navigator.userAgent) ? 'platform-win32' : 'platform-darwin')

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

// MCP 执行委托：主进程桥接把工作流执行 / Agent 工具调用转交渲染端执行
registerMcpExecutor()
