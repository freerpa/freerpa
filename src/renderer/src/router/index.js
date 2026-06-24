import { createRouter, createWebHashHistory } from 'vue-router'
import MainLayout from '../layout/MainLayout.vue'
import Home from '../views/Home.vue'
import Workflow from '../views/workflowManager/index.vue'
import Data from '../views/data/index.vue'
import Env from '../views/env/index.vue'
import Login from '../views/login/index.vue'
import { getToken, removeToken } from '@/utils/token'

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
        path: 'env',
        component: Env
      }
    ],
    meta: {
      requiresAuth: true
    }
  },
  {
    path: '/login',
    component: Login,
    meta: {
      requiresAuth: false
    }
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
// 路由守卫
router.beforeEach((to, from, next) => {
  const token = getToken()
  if (to.meta.requiresAuth && !token) {
    window.electronAPI.window.size(800, 600)
    next('/login')
  } else if (to.path === '/login') {
    removeToken()
    window.electronAPI.emitFlowEvent('cleanup')
    window.electronAPI.window.size(800, 600)
    next()
  } else if (from.path === '/login' && token) {
    window.electronAPI.window.maximize()
    next()
  } else {
    next()
  }
})

export default router
