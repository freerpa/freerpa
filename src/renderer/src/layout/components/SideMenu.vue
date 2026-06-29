<template>
  <div class="side-menu-container">
    <a-menu
      :collapsed="isCollapse"
      class="side-menu"
      :selected-keys="[route.path.split('/')[1] || 'home']"
      @menuItemClick="handleMenuClick"
    >
      <a-menu-item key="home">
        <template #icon><ri-home2-line /></template>
        <span>首页</span>
      </a-menu-item>
      <a-menu-item key="workflow">
        <template #icon><ri-flow-chart /></template>
        <span>工作流</span>
      </a-menu-item>
      <a-menu-item key="browser">
        <template #icon><ri-chrome-line /></template>
        <span>浏览器</span>
      </a-menu-item>
      <a-menu-item key="data">
        <template #icon><ri-database2-line /></template>
        <span>数据表</span>
      </a-menu-item>
      <a-menu-item key="my">
        <template #icon><ri-user-3-line /></template>
        <span>我的</span>
      </a-menu-item>
      <a-menu-item key="settings">
        <template #icon><ri-settings2-line /></template>
        <span>设置</span>
      </a-menu-item>
    </a-menu>
    <div class="collapse-btn" @click="toggleMenu">
      <icon-menu-fold v-if="!isCollapse" />
      <icon-menu-unfold v-else />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  IconHome,
  IconBranch,
  IconMenuFold,
  IconMenuUnfold,
  IconStorage,
  IconComputer,
  IconUser
} from '@arco-design/web-vue/es/icon'
import {RiHome2Line,RiFlowChart,RiChromeLine,RiDatabase2Line,RiSettings2Line,RiUser3Line} from '@remixicon/vue';
import { useStore } from '@/store'

const store = useStore()
const isCollapse = ref(false)
const router = useRouter()
const route = useRoute()

const emit = defineEmits(['myCenter', 'settingsCenter'])

const handleMenuClick = (key) => {
  if (key === 'my') {
    // 未登录：弹出登录窗口
    if (!store.userInfo) {
      store.showLogin()
      return
    }
    emit('myCenter')
    return
  }
  if (key === 'settings') {
    emit('settingsCenter')
    return
  }
  router.push(`/${key}`)
}

const toggleMenu = () => {
  isCollapse.value = !isCollapse.value
}

// 如果访问根路径，重定向到home
if (route.path === '/') {
  router.push('/home')
}
</script>

<style lang="less" scoped>
.side-menu-container {
  position: relative;
  height: 100%;

  .side-menu {
    height: 100%;
    border-right: solid 1px var(--color-border);

    &:not(.arco-menu-collapsed) {
      width: 200px;
    }
  }
  .arco-menu-item {
    padding: 0 16px;
  }
  .collapse-btn {
    position: absolute;
    bottom: 20px;
    left: 20px;
    cursor: pointer;
  }
}
</style>
