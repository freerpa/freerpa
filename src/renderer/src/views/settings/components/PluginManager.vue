<template>
  <div class="plugin-manager">
    <a-card title="插件管理" :bordered="false">
      <template #extra>
        <a-space>
          <a-button type="primary" @click="handleInstall">
            <template #icon><icon-plus /></template>
            安装插件
          </a-button>
          <a-button @click="handleImportDev">
            <template #icon><icon-folder-add /></template>
            导入开发插件
          </a-button>
          <a-button @click="refresh" :loading="loading">
            <template #icon><icon-refresh /></template>
            刷新
          </a-button>
        </a-space>
      </template>

      <!-- 进度条 -->
      <a-progress
        v-if="progress.visible"
        class="install-progress"
        :percent="progress.percent"
        :status="progress.status"
        :style="{ width: '100%' }"
      >
        <span v-if="progress.label" class="progress-label">{{ progress.label }}</span>
      </a-progress>

      <!-- 已安装插件列表 -->
      <a-spin :loading="loading" style="width: 100%">
        <div v-if="plugins.length === 0" class="empty-hint">暂无已安装插件，请点击「安装插件」或「导入开发插件」</div>
        <div v-for="plg in plugins" :key="plg.identifier || plg.pluginId" class="plugin-card">
          <a-card size="small" :bordered="true">
            <template #title>
              <div class="plugin-header">
                <span class="plugin-name">{{ plg.name }}@{{ plg.version }}</span>
                <a-tag v-if="plg.isDev" size="small" color="purple">开发版</a-tag>
              </div>
            </template>
            <template #extra>
              <div class="plugin-ops">
                <a-button v-if="plg.isDev" size="mini" @click="handlePack(plg)">打包为 .frp</a-button>
                <a-button size="mini" status="danger" @click="handleUninstall(plg)">卸载</a-button>
              </div>
            </template>
            <div class="plugin-body">
              <p class="plugin-desc">
                <span class="label">描述</span>
                {{ plg.description || '无描述' }}
              </p>
              <div v-if="pluginFields(plg).length" class="plugin-config-preview">
                <span class="label">配置</span>
                <a-tag v-for="item in pluginFields(plg)" :key="item.id" size="small">{{ item.name || item.id }}</a-tag>
              </div>
              <div v-if="pluginInputs(plg).length" class="plugin-io-preview">
                <span class="label">输入</span>
                <a-tag v-for="inp in pluginInputs(plg)" :key="inp.id" size="small">{{ inp.name || inp.id }}</a-tag>
              </div>
              <div v-if="pluginOutputs(plg).length" class="plugin-io-preview">
                <span class="label">输出</span>
                <a-tag v-for="out in pluginOutputs(plg)" :key="out.id" size="small">{{ out.name || out.id }}</a-tag>
              </div>
            </div>
          </a-card>
        </div>
      </a-spin>
    </a-card>
  </div>
</template>

<script setup>
  import { ref, onMounted, onUnmounted } from 'vue';
  import { Message, Modal } from '@arco-design/web-vue';
  import { IconPlus, IconRefresh, IconInfoCircle, IconFolderAdd } from '@arco-design/web-vue/es/icon';
  import nodes, { loadPluginNodes, PLUGIN_NODE_PREFIX } from '@/workflow/nodes';

  const plugins = ref([]);

  /**
   * 定位插件对应的已注册节点定义（index.js 的 registerPluginNode 已把入口文件导出的
   * config/inputs/outputs 解析到 nodes[type]，原始插件列表里的 config/inputs/outputs 恒为空数组）。
   */
  const nodeDefOf = (plg) => {
    if (!plg?.pluginId) return null;
    const identifier =
      plg.identifier || (plg.isDev ? `${plg.pluginId}@dev` : `${plg.pluginId}@${plg.version}`);
    return nodes[PLUGIN_NODE_PREFIX + identifier] || null;
  };

  /** 是否隐藏字段（pluginId/_pluginIdentifier 等自动注入字段标 show:'false'） */
  const isHidden = (f) => /^(false|hidden|0)$/i.test(String(f?.show ?? '').trim());

  /** 展平节点定义配置分组 → 可见字段列表（首页卡片展示用） */
  const pluginFields = (plg) => {
    const def = nodeDefOf(plg);
    if (!def) return [];
    const list = [];
    (def.config || []).forEach((g) => {
      (g.fields || []).forEach((f) => {
        if (f?.id && !isHidden(f)) list.push(f);
      });
    });
    return list;
  };

  const pluginInputs = (plg) => nodeDefOf(plg)?.inputs || [];
  const pluginOutputs = (plg) => nodeDefOf(plg)?.outputs || [];
  const loading = ref(false);
  const progress = ref({ visible: false, percent: 0, label: '', status: 'normal' });

  let unsubProgress = null;

  const refresh = async () => {
    loading.value = true;
    try {
      plugins.value = (await loadPluginNodes()) || [];
    } catch {
      Message.error('加载失败');
    } finally {
      loading.value = false;
    }
  };

  /** 安装 .frp：主进程弹文件选择器，进度经 plugin:progress 推送 */
  const handleInstall = async () => {
    const result = await window.electronAPI.plugin.installFrp();
    if (result?.canceled) return;
    if (result?.success) {
      Message.success(`插件 ${result.pluginId}@${result.version} 安装成功`);
      await refresh();
    } else if (result?.error) {
      Message.error(`安装失败: ${result.error}`);
    }
  };

  /** 导入开发版插件：主进程弹文件夹选择器，仅记录挂载路径 */
  const handleImportDev = async () => {
    const result = await window.electronAPI.plugin.importDev();
    if (result?.canceled) return;
    if (result?.success) {
      Message.success(`开发版插件 ${result.pluginId}@dev 已导入`);
      await refresh();
    } else if (result?.error) {
      Message.error(`导入失败: ${result.error}`);
    }
  };

  /** 打包为 .frp：主进程弹保存对话框，esbuild 编译 + zip 压缩 */
  const handlePack = async (plg) => {
    const result = await window.electronAPI.plugin.packFrp(plg.dir);
    if (result?.canceled) return;
    if (result?.success) {
      Message.success(`已打包: ${result.file}`);
    } else if (result?.error) {
      Message.error(`打包失败: ${result.error}`);
    }
  };

  /** 卸载：按 identifier（pluginId@version / pluginId@dev）删除该版本（dev 删挂载记录） */
  const handleUninstall = (plg) => {
    const identifier = plg.identifier || (plg.isDev ? `${plg.pluginId}@dev` : `${plg.pluginId}@${plg.version}`);
    Modal.confirm({
      title: '卸载插件',
      content: `确定卸载「${plg.name}」（${identifier}）吗？${plg.isDev ? '将移除开发版挂载记录，不影响正式版。' : '将删除该版本目录，不影响其他版本。'}`,
      okText: '卸载',
      okButtonProps: { status: 'danger' },
      cancelText: '取消',
      onOk: async () => {
        const result = await window.electronAPI.plugin.uninstall(identifier);
        if (result?.success) {
          Message.success(`已卸载 ${identifier}`);
          await refresh();
        } else if (result?.error) {
          Message.error(`卸载失败: ${result.error}`);
        }
      },
    });
  };

  onMounted(() => {
    unsubProgress = window.electronAPI.plugin.onProgress(({ percent, label }) => {
      // Arco a-progress 的 percent 约定为 0-1（见 browserDownloadListener 的 receivedBytes/totalBytes 用法）
      progress.value = {
        visible: true,
        percent: percent / 100,
        label: label || '',
        status: percent >= 100 ? 'success' : 'normal',
      };
      if (percent >= 100) {
        setTimeout(() => {
          progress.value.visible = false;
        }, 1200);
      }
    });
    refresh();
  });

  onUnmounted(() => {
    if (unsubProgress) unsubProgress();
  });
</script>

<style lang="less" scoped>
  .plugin-manager {
    .info-icon {
      cursor: pointer;
      color: var(--color-text-3);
      font-size: 16px;
      margin-right: 8px;
    }
    .install-progress {
      margin-bottom: 16px;
      .progress-label {
        font-size: 12px;
        color: var(--color-text-3);
        margin-left: 8px;
      }
    }
    .empty-hint {
      color: var(--color-text-3);
      font-size: 12px;
      padding: 16px 0;
      text-align: center;
    }
    .plugin-card {
      margin-bottom: 12px;
      .plugin-header {
        display: flex;
        align-items: center;
        gap: 8px;
        .plugin-name {
          font-weight: 600;
        }
      }
      // 标题栏右侧操作按钮（删除/打包）
      :deep(.arco-card-header-extra) {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .plugin-ops {
        display: flex;
        gap: 8px;
      }
      .plugin-body {
        display: flex;
        flex-direction: column;
        gap: 8px;
        .plugin-desc {
          color: var(--color-text-1);
          font-size: 12px;
        }
        .plugin-config-preview,
        .plugin-io-preview {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          font-size: 12px;
        }
        .label {
          width: 52px;
          color: var(--color-text-3);
          font-size: 12px;
          display: inline-block;
        }
      }
    }
  }
</style>
