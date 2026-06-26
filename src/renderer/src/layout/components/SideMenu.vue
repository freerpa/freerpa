<template>
  <div class="side-menu-container">
    <a-menu
      :collapsed="isCollapse"
      class="side-menu"
      :selected-keys="[route.path.split('/')[1] || 'home']"
      @menuItemClick="handleMenuClick"
    >
      <a-menu-item key="home">
        <template #icon><icon-home /></template>
        <span>首页</span>
      </a-menu-item>
      <a-menu-item key="workflow">
        <template #icon><icon-branch /></template>
        <span>工作流</span>
      </a-menu-item>
      <a-menu-item key="data">
        <template #icon><icon-storage /></template>
        <span>本地数据</span>
      </a-menu-item>
      <a-menu-item key="browser">
        <template #icon><icon-computer /></template>
        <span>浏览器管理</span>
      </a-menu-item>
      <a-menu-item key="user">
        <template #icon><icon-user /></template>
        <span>个人中心</span>
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

const isCollapse = ref(false)
const router = useRouter()
const route = useRoute()

const emit = defineEmits(['userCenter'])

const handleMenuClick = (key) => {
  if (key === 'user') {
    emit('userCenter')
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
