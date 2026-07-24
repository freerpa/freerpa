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
      <SettingsCenter />
    </a-modal>
  </div>
</template>

<script setup>
import { ref, provide } from 'vue'
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

const showSettingsCenter = () => {
  settingsCenterVisible.value = true
}
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
