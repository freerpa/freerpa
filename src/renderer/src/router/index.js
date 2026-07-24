import { createRouter, createWebHashHistory } from 'vue-router'
import MainLayout from '../layout/MainLayout.vue'
import Home from '../views/Home.vue'
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
        path: 'home',
        component: Home
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

let firstLoad = true
if (firstLoad) {
  window.electronAPI.window.maximize(true)
  firstLoad = false
}

export default router
