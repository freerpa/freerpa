<template>
  <div class="version-manager">
    <a-card title="版本更新" :bordered="false">
      <!-- 当前版本 -->
      <div class="update-section">
        <h3 class="update-title">当前版本 {{ version }}</h3>
        <div class="update-actions">
          <a-button type="primary" :loading="checking" @click="checkUpdate">检查更新</a-button>
          <a-button type="primary" status="danger" v-if="canUpdate" @click="goDownload">立即更新</a-button>
        </div>

        <!-- 检查结果 -->
        <div v-if="checkResult && !updateError" class="check-result">
          <a-alert v-if="checkResult.hasUpdate" type="success">发现新版本 V{{ checkResult.version }}</a-alert>
          <a-alert v-else type="normal" title="当前已是最新版本" />
        </div>
        <div v-if="updateError" class="check-result">
          <a-alert type="error" :title="updateError" />
        </div>
      </div>
    </a-card>
  </div>
</template>

<script setup>
  import { ref, onMounted } from 'vue';
  import { Message } from '@arco-design/web-vue';

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
    .update-section {
      .update-title {
        font-size: 16px;
        margin-bottom: 16px;
      }
      .update-actions {
        display: flex;
        gap: 12px;
        margin-bottom: 12px;
      }
      .check-result {
        margin-top: 4px;
      }
    }
  }
</style>
