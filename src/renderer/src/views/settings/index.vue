<template>
  <div class="settings-center">
    <div class="nav-menu">
      <a-menu :selected-keys="[activeTab]" @menu-item-click="handleMenuClick">
        <a-menu-item key="plugin">
          <template #icon><RiPlugLine /></template>
          插件管理
        </a-menu-item>
        <a-menu-item key="ai">
          <template #icon><RiRobot2Line /></template>
          模型管理
        </a-menu-item>
        <a-menu-item key="security">
          <template #icon><RiShieldKeyholeLine /></template>
          权限管理
        </a-menu-item>
        <a-menu-item key="network">
          <template #icon><RiServerLine /></template>
          网络服务
        </a-menu-item>
        <a-menu-item key="data">
          <template #icon><RiDatabase2Line /></template>
          数据库
        </a-menu-item>
        <a-menu-item key="shortcut">
          <template #icon><RiCommandLine /></template>
          快捷键
        </a-menu-item>
        <a-menu-item key="version">
          <template #icon><RiInformationLine /></template>
          版本更新
        </a-menu-item>
      </a-menu>
    </div>
    <div class="content">
      <PluginManager v-if="activeTab === 'plugin'" />
      <PermissionManager v-if="activeTab === 'security'" />
      <DataManager v-if="activeTab === 'data'" />
      <ShortcutManager v-if="activeTab === 'shortcut'" />
      <ModelManager v-if="activeTab === 'ai'" />
      <NetworkServerManager v-if="activeTab === 'network'" />
      <VersionManager v-if="activeTab === 'version'" />
    </div>
  </div>
</template>

<script setup>
  // 显式组件名（规避 vue/multi-word-component-names 对 index.vue 的规则警告）
  defineOptions({ name: 'SettingsCenter' });

  import { ref } from 'vue';
  import {
    RiPlugLine,
    RiShieldKeyholeLine,
    RiDatabase2Line,
    RiCommandLine,
    RiRobot2Line,
    RiServerLine,
    RiInformationLine,
  } from '@remixicon/vue';
  import PluginManager from './components/PluginManager.vue';
  import PermissionManager from './components/PermissionManager.vue';
  import DataManager from './components/DataManager.vue';
  import ShortcutManager from './components/ShortcutManager.vue';
  import ModelManager from './components/ModelManager.vue';
  import NetworkServerManager from './components/NetworkServerManager.vue';
  import VersionManager from './components/VersionManager.vue';

  // initialTab：设置中心打开时指定的初始选项卡（如「去安装」→ 插件管理）
  const props = defineProps({
    initialTab: {
      type: String,
      default: '',
    },
  });

  const activeTab = ref(
    ['plugin', 'ai', 'security', 'network', 'data', 'shortcut', 'version'].includes(props.initialTab)
      ? props.initialTab
      : 'plugin'
  );

  const handleMenuClick = (key) => {
    activeTab.value = key;
  };
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
