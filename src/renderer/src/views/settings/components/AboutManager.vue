<template>
  <div class="about-manager">
    <a-card title="版本更新" :bordered="false">
      <!-- 版本信息 -->
      <div class="about-row">
        <span class="label">当前版本</span>
        <span class="value">{{ version }}</span>
      </div>
      <a-divider />

      <!-- 检查更新 -->
      <div class="update-section">
        <h3 class="update-title">检查更新</h3>
        <p class="update-hint">有新版本时「立即更新」将跳转到官网下载区下载最新安装包。</p>
        <div class="update-actions">
          <a-button type="primary" :loading="checking" @click="checkUpdate">检查更新</a-button>
          <a-button type="primary" status="danger" :disabled="!canUpdate" @click="goDownload">立即更新</a-button>
        </div>

        <!-- 检查结果 -->
        <div v-if="checkResult" class="check-result">
          <a-alert
            v-if="checkResult.hasUpdate"
            type="success"
            :title="`发现新版本 ${checkResult.targetVersion}，点击「立即更新」前往官网下载区`"
          />
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
  // 远程最新版本检测地址：独立于下载区地址，需返回 {"version": "x.y.z"}（VITE_VERSION_URL）
  const remoteInfoUrl = import.meta.env.VITE_VERSION_URL || '';
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
      if (!remoteInfoUrl) {
        updateError.value = '未配置最新版本检测地址（VITE_VERSION_URL），无法检查更新';
        canUpdate.value = false;
        return;
      }
      const res = await fetch(remoteInfoUrl, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const info = await res.json();
      const targetVersion = info?.version || '';
      // 请求目标URL为空：认为有可跳转下载区的新版本（以官网为准）
      const hasUpdate = !targetVersion || targetVersion !== version.value;
      canUpdate.value = true;
      checkResult.value = { hasUpdate, targetVersion: targetVersion || '官方最新' };
      if (hasUpdate) {
        Message.success('发现新版本，可「立即更新」');
      } else {
        Message.success('当前已是最新版本');
      }
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
  .about-manager {
    .about-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 4px 0;
      .label {
        color: var(--color-text-2);
      }
      .value {
        font-weight: 500;
      }
    }

    .update-section {
      .update-title {
        font-size: 14px;
        font-weight: 600;
        margin-bottom: 4px;
      }
      .update-hint {
        font-size: 12px;
        color: var(--color-text-3);
        margin-bottom: 12px;
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
