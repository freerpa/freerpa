<template>
  <div class="layout">
    <TitleBar />
    <div class="layout-content">
      <SideMenu @settingsCenter="showSettingsCenter" />
      <div class="layout-page">
        <router-view v-slot="{ Component }">
          <transition>
            <keep-alive>
              <component :is="Component" />
            </keep-alive>
          </transition>
        </router-view>
      </div>
    </div>
    <template v-for="(tab, id) in openedTabs" :key="id">
      <div class="tab-content" v-show="tab.visible">
        <div v-if="tab.type === 'workflow'" class="workflow-editor">
          <Workflow :show-editor="tab.visible" :workflow-id="id" :visible="tab.visible" />
        </div>
        <div v-if="tab.type === 'dataViewer'" class="data-viewer">
          <DataViewer :model="tab.model" :visible="tab.visible" />
        </div>
      </div>
    </template>

    <!-- 设置 -->
    <a-modal
      v-model:visible="settingsCenterVisible"
      title="设置"
      width="900px"
      body-style="padding: 0;height: 600px"
      unmount-on-close
      :footer="false"
    >
      <SettingsCenter :initial-tab="settingsTab" />
    </a-modal>
  </div>
</template>

<script setup>
import { ref, provide, onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import TitleBar from './components/TitleBar.vue'
import SideMenu from './components/SideMenu.vue'
import SettingsCenter from '@/views/settings/index.vue'
import Workflow from '@/workflow/index.vue'
import DataViewer from '@/views/data/components/DataViewer.vue'
import { useStore } from '@/store'

const store = useStore()
const { openedTabs } = storeToRefs(store)

const settingsCenterVisible = ref(false)
// 打开设置中心时指定初始选项卡（如「去安装」→ 本地插件）；modal 为 unmount-on-close，
// 需通过 prop 在 SettingsCenter 挂载时初始化，而非依赖事件（事件派发早于组件挂载会丢失）
const settingsTab = ref('')

const showSettingsCenter = () => {
  settingsCenterVisible.value = true
}

// 全局事件：节点占位提示「去安装」快捷链接打开设置中心（detail.tab 指定菜单）
const onOpenSettingsCenter = (event) => {
  settingsTab.value = event?.detail?.tab || ''
  showSettingsCenter()
}
onMounted(() => {
  window.addEventListener('open-settings-center', onOpenSettingsCenter)
})
onUnmounted(() => {
  window.removeEventListener('open-settings-center', onOpenSettingsCenter)
})
</script>

<style lang="less" scoped>
.layout {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: var(--color-bg-1);

  &-content {
    flex: 1;
    display: flex;
    min-height: 0;
  }

  &-page {
    flex: 1;
    height: 100%;
    overflow: hidden;

    :deep(> *) {
      height: 100%;
    }
  }

  .tab-content {
    height: calc(100vh - 40px);
    background-color: var(--color-bg-2);
    position: fixed;
    top: 40px;
    left: 0;
    width: 100vw;
    z-index: 1000;
    .workflow-editor {
      height: 100%;
      width: 100%;
    }
    .data-viewer {
      padding: 20px;
      height: 100%;
      width: 100%;
    }
  }
}
</style>
