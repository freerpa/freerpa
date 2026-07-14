<template>
  <div class="settings-center">
    <div class="nav-menu">
      <a-menu :selected-keys="[activeTab]" @menu-item-click="handleMenuClick">
        <a-menu-item key="cache">
          <template #icon><icon-storage /></template>
          缓存
        </a-menu-item>
        <a-menu-item key="plugin">
          <template #icon><icon-apps /></template>
          本地插件
        </a-menu-item>
        <a-menu-item key="security">
          <template #icon><icon-safe /></template>
          安全目录
        </a-menu-item>
        <a-menu-item key="data">
          <template #icon><icon-drive-file /></template>
          数据
        </a-menu-item>
        <a-menu-item key="shortcut">
          <template #icon><icon-command /></template>
          快捷键
        </a-menu-item>
        <a-menu-item key="feedback">
          <template #icon><icon-edit /></template>
          意见反馈
        </a-menu-item>
      </a-menu>
    </div>
    <div class="content">
      <CacheManager v-if="activeTab === 'cache'" />
      <PluginManager v-if="activeTab === 'plugin'" />
      <SecurityDir v-if="activeTab === 'security'" />
      <DataManager v-if="activeTab === 'data'" />
      <ShortcutManager v-if="activeTab === 'shortcut'" />
      <Feedback v-if="activeTab === 'feedback'" />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { IconEdit, IconStorage, IconApps, IconSafe, IconDriveFile, IconCommand } from '@arco-design/web-vue/es/icon'
import Feedback from '@/views/user/components/Feedback.vue'
import CacheManager from './components/CacheManager.vue'
import PluginManager from './components/PluginManager.vue'
import SecurityDir from './components/SecurityDir.vue'
import DataManager from './components/DataManager.vue'
import ShortcutManager from './components/ShortcutManager.vue'

const activeTab = ref('cache')

const handleMenuClick = (key) => {
  activeTab.value = key
}
</script>

<style lang="less" scoped>
.settings-center {
  display: flex;
  height: 100%;
  .nav-menu {
    width: 200px;
    background-color: var(--color-bg-2);
    padding: 8px;
    border-right: solid 1px var(--color-border);
  }
  .content {
    flex: 1;
    background-color: var(--color-bg-2);
    border-radius: 4px;
    overflow: auto;
  }
}
</style>
