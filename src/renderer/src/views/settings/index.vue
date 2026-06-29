<template>
  <div class="settings-center">
    <div class="nav-menu">
      <a-menu :selected-keys="[activeTab]" @menu-item-click="handleMenuClick">
        <a-menu-item key="feedback">
          <template #icon><icon-edit /></template>
          意见反馈
        </a-menu-item>
      </a-menu>
    </div>
    <div class="content">
      <Feedback v-if="activeTab === 'feedback'" />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { IconEdit } from '@arco-design/web-vue/es/icon'
import Feedback from '@/views/user/components/Feedback.vue'

const activeTab = ref('feedback')

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
