<template>
  <div class="version-manager">
    <a-card :bordered="false" class="version-card">
      <div class="app-row">
        <img class="app-icon" :src="appIcon" alt="FreeRPA" />
        <div class="app-meta">
          <span class="app-name">FreeRPA</span>
          <span class="app-sub">自动化流程客户端</span>
        </div>
        <span class="app-version">V{{ version }}</span>
      </div>

      <div class="update-panel">
        <div class="update-copy">
          <div class="update-heading">版本更新</div>
          <div class="update-desc">检查是否有可用更新，新版本将跳转官网下载。</div>
        </div>
        <div class="update-actions">
          <a-button type="primary" :loading="checking" @click="checkUpdate">检查更新</a-button>
          <a-button v-if="canUpdate" status="danger" @click="goDownload">立即更新</a-button>
        </div>
      </div>

      <div v-if="checkResult" class="check-status" :class="{ 'is-new': checkResult.hasUpdate }">
        <span class="status-dot"></span>
        <span>{{ checkResult.hasUpdate ? `发现新版本 V${checkResult.version}` : '当前已是最新版本' }}</span>
      </div>
      <div v-if="updateError" class="check-status is-error">
        <span class="status-dot"></span>
        <span>{{ updateError }}</span>
      </div>
    </a-card>
  </div>
</template>

<script setup>
  import { ref, onMounted } from 'vue';
  import { Message } from '@arco-design/web-vue';
  import appIcon from '@/assets/app-icon.png';

  // 下载区地址：「立即更新」跳转的官网下载页（VITE_DOWNLOAD_URL）
  const latestVersionUrl = import.meta.env.VITE_DOWNLOAD_URL || '';
  const version = ref('');

  const checking = ref(false);
  const canUpdate = ref(false);
  const checkResult = ref(null);
  const updateError = ref('');

  onMounted(async () => {
    if (!window.electronAPI?.app?.getVersion) return;
    try {
      version.value = await window.electronAPI.app.getVersion();
    } catch {
      version.value = '未知';
    }
  });

  const checkUpdate = async () => {
    checking.value = true;
    updateError.value = '';
    checkResult.value = null;
    try {
      // 版本检测走主进程 IPC（避免渲染进程 CORS / 直连失败）
      const res = await window.electronAPI.app.checkUpdate();
      if (res?.error) {
        updateError.value = `检查更新失败：${res.error}`;
        canUpdate.value = false;
        return;
      }
      canUpdate.value = !!res?.hasUpdate;
      checkResult.value = { hasUpdate: !!res.hasUpdate, version: res.version };
    } catch (e) {
      canUpdate.value = false;
      updateError.value = `检查更新失败：${e?.message || e}`;
    } finally {
      checking.value = false;
    }
  };

  const goDownload = () => {
    if (!latestVersionUrl) {
      Message.error('未配置下载地址（VITE_DOWNLOAD_URL）');
      return;
    }
    // 用系统浏览器打开官网下载区
    if (window.electronAPI?.shell?.openExternal) {
      window.electronAPI.shell.openExternal(latestVersionUrl);
    } else {
      window.open(latestVersionUrl, '_blank');
    }
  };
</script>

<style lang="less" scoped>
  .version-manager {
    .version-card {
      :deep(.arco-card-body) {
        padding: 0;
      }
    }

    .app-row {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 20px;
    }
    .app-icon {
      width: 52px;
      height: 52px;
      flex-shrink: 0;
      display: block;
      object-fit: contain;
      border-radius: var(--mac-radius-lg);
    }
    .app-meta {
      display: flex;
      flex-direction: column;
      gap: 3px;
      min-width: 0;
    }
    .app-name {
      font-size: 16px;
      font-weight: 600;
      color: var(--mac-text);
      letter-spacing: -0.01em;
    }
    .app-sub {
      font-size: 12px;
      color: var(--mac-text-3);
    }
    .app-version {
      margin-left: auto;
      flex-shrink: 0;
      height: var(--mac-control-h-mini);
      line-height: calc(var(--mac-control-h-mini) - 2px);
      padding: 0 8px;
      border-radius: var(--mac-radius-control-xs);
      background: var(--mac-fill);
      color: var(--mac-text-2);
      font-family: var(--mac-font-mono);
      font-size: 12px;
    }

    .update-panel {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 16px 20px 18px;
      border-top: var(--mac-hairline) solid var(--mac-separator);
    }
    .update-copy {
      min-width: 0;
    }
    .update-heading {
      font-size: 14px;
      font-weight: 600;
      color: var(--mac-text);
      margin-bottom: 4px;
    }
    .update-desc {
      font-size: 12px;
      color: var(--mac-text-3);
      line-height: 1.5;
    }
    .update-actions {
      display: flex;
      gap: 8px;
      flex-shrink: 0;
    }

    .check-status {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0 20px 18px;
      padding: 8px 12px;
      border-radius: var(--mac-radius-sm);
      background: var(--mac-hover-fill);
      font-size: 12px;
      color: var(--mac-text-2);
      .status-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--mac-gray);
        flex-shrink: 0;
      }
      &.is-new {
        background: rgba(52, 199, 89, 0.08);
        color: #248a3d;
        .status-dot {
          background: var(--mac-green);
        }
      }
      &.is-error {
        background: rgba(255, 59, 48, 0.08);
        color: var(--mac-red);
        .status-dot {
          background: var(--mac-red);
        }
      }
    }
  }
</style>
