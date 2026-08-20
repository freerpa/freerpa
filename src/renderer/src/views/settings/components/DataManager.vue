<template>
  <div class="data-manager">
    <a-card title="数据管理" :bordered="false">
      <!-- 数据库信息 -->
      <div class="info-row">
        <span class="label">数据库大小</span>
        <a-tag :color="dbInfo.exists ? 'arcoblue' : 'gray'" size="large">{{ dbInfo.label || '加载中...' }}</a-tag>
      </div>

      <div class="info-row">
        <span class="label">数据库位置</span>
        <span class="path-text">{{ dbInfo.path || '加载中...' }}</span>
        <a-button type="text" size="small" @click="openFolder">
          <template #icon><icon-folder /></template>
        </a-button>
      </div>
    </a-card>
  </div>
</template>

<script setup>
  import { reactive, onMounted } from 'vue';
  import { Message } from '@arco-design/web-vue';
  import { IconFolder } from '@arco-design/web-vue/es/icon';

  const dbInfo = reactive({
    path: '',
    exists: false,
    size: 0,
    label: '',
  });

  const fetchInfo = async () => {
    try {
      const result = await window.electronAPI.dbInfo.getInfo();
      Object.assign(dbInfo, result);
    } catch (e) {
      Message.error('获取数据库信息失败');
    }
  };

  const openFolder = () => {
    window.electronAPI.dbInfo.openFolder();
  };

  onMounted(fetchInfo);
</script>

<style lang="less" scoped>
  .data-manager {
    .info-row {
      display: flex;
      align-items: center;
      margin-bottom: 12px;
      gap: 8px;
      .label {
        padding-right: 8px;
        white-space: nowrap;
        text-align: left;
      }
      .path-text {
        font-size: 13px;
        color: var(--color-text-3);
        word-break: break-all;
        margin-right: 8px;
      }
    }
  }
</style>
