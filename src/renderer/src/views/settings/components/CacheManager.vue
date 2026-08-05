<template>
  <div class="cache-manager">
    <a-card title="缓存管理" :bordered="false">
      <template #extra>
        <a-popover
          content="缓存包含浏览器 Session 数据（Cookie、LocalStorage 等）和 Chromium 运行时临时文件。清空缓存不会影响您的浏览器配置和工作流数据。"
        >
          <icon-info-circle class="info-icon" />
        </a-popover>
      </template>

      <div class="cache-info">
        <div class="size-display">
          <span class="label">当前缓存大小：</span>
          <a-tag :color="sizeColor" size="large">{{ totalLabel || '计算中...' }}</a-tag>
          <a-button type="outline" size="medium" style="margin-left: 12px" @click="refresh" :loading="loading">
            <template #icon><icon-refresh /></template>
            刷新
          </a-button>
        </div>

        <a-divider />

        <div class="cache-details" v-if="details.length">
          <div class="detail-item" v-for="d in details" :key="d.path">
            <span class="detail-path">{{ d.path }}</span>
            <a-tag size="small" :color="d.exists ? 'arcoblue' : 'gray'">{{ d.exists ? d.label : '不存在' }}</a-tag>
          </div>
        </div>

        <a-divider />

        <a-popconfirm content="确认清空所有浏览器缓存？此操作不可撤销。" @ok="handleClear">
          <a-button type="primary" status="danger" :loading="clearing">
            <template #icon><icon-delete /></template>
            一键清空缓存
          </a-button>
        </a-popconfirm>
      </div>
    </a-card>
  </div>
</template>

<script setup>
  import { ref, computed, onMounted } from 'vue';
  import { Message } from '@arco-design/web-vue';
  import { IconRefresh, IconDelete, IconInfoCircle } from '@arco-design/web-vue/es/icon';

  const totalSize = ref(0);
  const totalLabel = ref('');
  const details = ref([]);
  const loading = ref(false);
  const clearing = ref(false);

  const sizeColor = computed(() => {
    if (totalSize.value === 0) return 'green';
    if (totalSize.value < 100 * 1024 * 1024) return 'arcoblue';
    if (totalSize.value < 500 * 1024 * 1024) return 'orange';
    return 'red';
  });

  const refresh = async () => {
    loading.value = true;
    try {
      const result = await window.electronAPI.cache.getSize();
      totalSize.value = result.totalSize;
      totalLabel.value = result.label;
      details.value = result.details;
    } catch (e) {
      Message.error('获取缓存大小失败');
    } finally {
      loading.value = false;
    }
  };

  const handleClear = async () => {
    clearing.value = true;
    try {
      await window.electronAPI.cache.clear();
      Message.success('缓存已清空');
      await refresh();
    } catch (e) {
      Message.error('清空缓存失败: ' + e.message);
    } finally {
      clearing.value = false;
    }
  };

  onMounted(refresh);
</script>

<style lang="less" scoped>
  .cache-manager {
    .cache-info {
      .size-display {
        display: flex;
        align-items: center;
        .label {
          font-weight: 500;
        }
      }
      .cache-details {
        .detail-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 0;
          .detail-path {
            font-size: 12px;
            color: var(--color-text-3);
            max-width: 70%;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
        }
      }
    }
  }
  .info-icon {
    cursor: pointer;
    color: var(--color-text-3);
    font-size: 16px;
  }
</style>
