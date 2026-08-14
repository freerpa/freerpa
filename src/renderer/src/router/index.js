import { createRouter, createWebHashHistory } from 'vue-router'
import MainLayout from '../layout/MainLayout.vue'
import MarketView from '../views/MarketView.vue'
import Workflow from '../views/workflowManager/index.vue'
import Data from '../views/data/index.vue'
import BrowserView from '../views/browser/index.vue'
import ElementSet from '../views/elementSet/index.vue'
const routes = [
  {
    path: '/',
    component: MainLayout,
    redirect: '/home',
    children: [
      {
        // 首页 = 扩展市场（嵌入远程无头模式）
        path: 'home',
        component: MarketView
      },
      {
        path: 'workflow',
        component: Workflow,
        keepAlive: true
      },
      {
        path: 'data',
        component: Data
      },
      {
        path: 'browser',
        component: BrowserView
      },
      {
        path: 'elementSet',
        component: ElementSet
      }
    ]
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

// 模块级只执行一次：启动即最大化窗口
window.electronAPI.window.maximize(true)

export default router
