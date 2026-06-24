<template>
  <div class="layout">
    <TitleBar @userCenter="userCenter" />
    <div class="layout-content">
      <SideMenu @userCenter="userCenter" />
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

    <a-modal
      title="用户中心"
      v-model:visible="userCenterVisible"
      width="1000px"
      body-style="padding: 0;height: 600px"
      unmount-on-close
      :footer="false"
    >
      <template #title>
        <div style="width: 100%">
          <b>个人中心</b>
        </div>
      </template>
      <UserCenter />
    </a-modal>
  </div>
</template>

<script setup>
import TitleBar from './components/TitleBar.vue'
import SideMenu from './components/SideMenu.vue'
import UserCenter from '@/views/user/index.vue'
import { ref } from 'vue'
import Workflow from '@/workflow/index.vue'
import DataViewer from '@/views/data/components/DataViewer.vue'
import { useStore } from '@/store'
import { storeToRefs } from 'pinia'

const { openedTabs } = storeToRefs(useStore())

const userCenterVisible = ref(false)

const userCenter = () => {
  userCenterVisible.value = true
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
