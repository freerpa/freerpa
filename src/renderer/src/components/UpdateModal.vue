<template>
  <a-modal
    :visible="visible"
    :title="title"
    :footer="false"
    :closable="true"
    width="480px"
    @cancel="emit('close')"
  >
    <div class="update-modal">
      <template v-if="info">
        <div class="ver-row">
          当前版本
          <b>{{ info.currentVersion }}</b>
          <i class="ri-arrow-right-line" />
          新版本
          <b class="new">{{ info.version }}</b>
        </div>

        <div class="log-box">
          <div class="log-title">更新日志</div>
          <pre v-if="info.updateLog" class="log-text">{{ info.updateLog }}</pre>
          <div v-else class="log-empty">暂无更新日志</div>
        </div>
      </template>

      <div class="modal-actions">
        <a-button @click="$emit('close')">稍后再说</a-button>
        <a-button type="primary" @click="goDownload">立即更新</a-button>
      </div>
    </div>
  </a-modal>
</template>

<script setup>
import { Message } from '@arco-design/web-vue'

defineProps({
  visible: { type: Boolean, default: false },
  info: { type: Object, default: null }
})
const emit = defineEmits(['close'])

const downloadUrl = import.meta.env.VITE_DOWNLOAD_URL || ''

const title = '发现新版本'

const goDownload = async () => {
  if (!downloadUrl) {
    Message.error('未配置下载地址（VITE_DOWNLOAD_URL）')
    return
  }
  // 系统浏览器打开官网下载区
  if (window.electronAPI?.shell?.openExternal) {
    await window.electronAPI.shell.openExternal(downloadUrl)
  } else {
    window.open(downloadUrl, '_blank')
  }
  emit('close')
}
</script>

<style lang="less" scoped>
.update-modal {
  .ver-row {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    color: var(--color-text-2);
    padding: 4px 0 12px;
    b {
      color: var(--color-text-1);
      font-weight: 600;
    }
    .new {
      color: rgb(var(--primary-6));
    }
  }

  .log-box {
    background: var(--color-fill-2);
    border-radius: 4px;
    padding: 12px;
    max-height: 240px;
    overflow: auto;
    .log-title {
      font-size: 13px;
      font-weight: 600;
      color: var(--color-text-1);
      margin-bottom: 6px;
    }
    .log-text {
      margin: 0;
      white-space: pre-wrap;
      word-break: break-word;
      font-size: 13px;
      line-height: 1.7;
      color: var(--color-text-2);
      font-family: inherit;
    }
    .log-empty {
      font-size: 13px;
      color: var(--color-text-3);
    }
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 20px;
  }
}
</style>
