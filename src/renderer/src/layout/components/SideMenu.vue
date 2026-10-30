<template>
  <div class="side-menu-container">
    <a-menu
      :collapsed="isCollapse"
      class="side-menu"
      :selected-keys="[route.path.split('/')[1] || 'home']"
      @menuItemClick="handleMenuClick"
    >
      <a-menu-item key="home">
        <template #icon><ri-puzzle-line /></template>
        <span>扩展坞</span>
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
      <a-menu-item key="elementSet">
        <template #icon><ri-stack-line /></template>
        <span>元素集</span>
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
  import { ref } from 'vue';
  import { useRouter, useRoute } from 'vue-router';
  import {
    IconMenuFold,
    IconMenuUnfold,
  } from '@arco-design/web-vue/es/icon';
  import {
    RiPuzzleLine,
    RiFlowChart,
    RiChromeLine,
    RiDatabase2Line,
    RiSettings2Line,
    RiStackLine,
  } from '@remixicon/vue';

  const isCollapse = ref(false);
  const router = useRouter();
  const route = useRoute();

  const emit = defineEmits(['settingsCenter']);

  const handleMenuClick = (key) => {
    if (key === 'settings') {
      emit('settingsCenter');
      return;
    }
    router.push(`/${key}`);
  };

  const toggleMenu = () => {
    isCollapse.value = !isCollapse.value;
  };

  // 如果访问根路径，重定向到home
  if (route.path === '/') {
    router.push('/home');
  }
</script>

<style lang="less" scoped>
  .side-menu-container {
    position: relative;
    height: 100%;
    flex: 0 0 auto;

    .side-menu {
      height: 100%;
      background: transparent;
      border: none;
      padding: 0 4px;
      :deep(.arco-menu-inner) {
        padding: 0;
      }

      &:not(.arco-menu-collapsed) {
        width: 212px;
      }
      &.arco-menu-collapsed {
        width: 60px;
      }
    }
    .arco-menu-item {
      padding: 0 10px;
      margin: 2px 6px;
      &:first-child {
        margin-top: 0;
      }
    }
    :deep(.arco-menu-collapsed .arco-menu-item:first-child) {
      margin-top: 0;
    }
    .collapse-btn {
      position: absolute;
      bottom: 14px;
      left: 16px;
      width: 30px;
      height: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--mac-text-2);
      background: rgba(255, 255, 255, 0.55);
      border: 0.5px solid rgba(0, 0, 0, 0.08);
      border-radius: var(--mac-radius-sm);
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
      cursor: pointer;
      transition:
        background-color 0.15s ease,
        color 0.15s ease;
      &:hover {
        background: rgba(255, 255, 255, 0.85);
        color: var(--mac-text);
      }
    }
  }
</style>
