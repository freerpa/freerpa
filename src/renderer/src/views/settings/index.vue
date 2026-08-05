<template>
  <div class="settings-center">
    <div class="nav-menu">
      <a-menu :selected-keys="[activeTab]" @menu-item-click="handleMenuClick">
        <a-menu-item key="cache">
          <template #icon><RiArchiveStackLine /></template>
          缓存管理
        </a-menu-item>
        <a-menu-item key="plugin">
          <template #icon><RiPlugLine /></template>
          本地插件
        </a-menu-item>
        <a-menu-item key="security">
          <template #icon><RiShieldKeyholeLine /></template>
          权限管理
        </a-menu-item>
        <a-menu-item key="data">
          <template #icon><RiDatabase2Line /></template>
          数据库
        </a-menu-item>
        <a-menu-item key="shortcut">
          <template #icon><RiCommandLine /></template>
          快捷键
        </a-menu-item>
      </a-menu>
    </div>
    <div class="content">
      <CacheManager v-if="activeTab === 'cache'" />
      <PluginManager v-if="activeTab === 'plugin'" />
      <PermissionManager v-if="activeTab === 'security'" />
      <DataManager v-if="activeTab === 'data'" />
      <ShortcutManager v-if="activeTab === 'shortcut'" />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { RiArchiveStackLine, RiPlugLine, RiShieldKeyholeLine, RiDatabase2Line, RiCommandLine } from '@remixicon/vue'
import CacheManager from './components/CacheManager.vue'
import PluginManager from './components/PluginManager.vue'
import PermissionManager from './components/PermissionManager.vue'
import DataManager from './components/DataManager.vue'
import ShortcutManager from './components/ShortcutManager.vue'

// initialTab：设置中心打开时指定的初始选项卡（如「去安装」→ 本地插件）
const props = defineProps({
  initialTab: {
    type: String,
    default: ''
  }
})

const activeTab = ref(props.initialTab || 'cache')

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
