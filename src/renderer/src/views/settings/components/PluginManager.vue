<template>
  <div class="plugin-manager">
    <a-card title="本地插件管理" :bordered="false">
      <template #extra>
        <a-space>
          <a-popover content="通过添加插件目录来安装本地插件。目录结构：{插件根目录}/{插件名}/V{版本}/index.js（描述文件）+ execute.js（执行文件），多个版本目录并存时自动使用最高版本。">
            <icon-info-circle class="info-icon" />
          </a-popover>
        </a-space>
      </template>

      <!-- 插件目录管理 -->
      <div class="dir-section">
        <div class="section-title">
          <span>插件搜索目录</span>
          <a-button type="primary" size="small" @click="handleAddDir">
            <template #icon><icon-plus /></template>
            添加目录
          </a-button>
        </div>
        <div v-if="dirs.length === 0" class="empty-hint">暂无插件目录，请点击"添加目录"</div>
        <div v-for="dir in dirs" :key="dir" class="dir-item">
          <span class="dir-path">{{ dir }}</span>
          <a-button type="text" size="mini" status="danger" @click="handleRemoveDir(dir)">
            <template #icon><icon-delete /></template>
            移除
          </a-button>
        </div>
      </div>

      <a-divider />

      <!-- 已安装插件 -->
      <div class="plugin-section">
        <div class="section-title">
          <span>已发现插件 ({{ plugins.length }})</span>
          <a-button size="small" @click="refresh" :loading="loading">
            <template #icon><icon-refresh /></template>
            刷新
          </a-button>
        </div>

        <a-spin :loading="loading">
          <div v-if="plugins.length === 0" class="empty-hint">未发现任何插件</div>
          <div v-for="plg in plugins" :key="plg.id" class="plugin-card">
            <a-card size="small" :bordered="true">
              <template #title>
                <div class="plugin-header">
                  <span class="plugin-name">{{ plg.name }}</span>
                  <a-tag size="small" color="arcoblue">{{ plg.version }}</a-tag>
                </div>
              </template>
              <div class="plugin-body">
                <p class="plugin-desc">{{ plg.description || '无描述' }}</p>
                <div class="plugin-meta">
                  <span>ID: {{ plg.id }}</span>
                  <span>目录: {{ plg.dir }}</span>
                  <a-tag v-if="plg.hasExecute" size="small" color="green">✓ execute.js</a-tag>
                  <a-tag v-else size="small" color="red">✗ execute.js</a-tag>
                  <a-tag v-if="plg.hasDeps" size="small" color="orange">含依赖</a-tag>
                  <a-tag v-if="plg.duplicate" size="small" color="red">ID 重复</a-tag>
                  <a-tag v-if="plg.error" size="small" color="red">{{ plg.error }}</a-tag>
                </div>
                <div v-if="plg.config && Object.keys(plg.config).length" class="plugin-config-preview">
                  <span class="label">配置项:</span>
                  <span v-for="(group, gk) in plg.config" :key="gk">
                    {{ group.name }} ({{ Object.keys(group.fields || {}).length }}个)
                  </span>
                </div>
                <div v-if="plg.inputs && plg.inputs.length" class="plugin-io-preview">
                  <span class="label">输入:</span>
                  <a-tag v-for="inp in plg.inputs" :key="inp.id" size="small">{{ inp.name }}</a-tag>
                </div>
                <div v-if="plg.outputs && plg.outputs.length" class="plugin-io-preview">
                  <span class="label">输出:</span>
                  <a-tag v-for="out in plg.outputs" :key="out.id" size="small">{{ out.name }}</a-tag>
                </div>
              </div>
            </a-card>
          </div>
        </a-spin>
      </div>
    </a-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { Message } from '@arco-design/web-vue'
import { IconPlus, IconDelete, IconRefresh, IconInfoCircle } from '@arco-design/web-vue/es/icon'
import { loadPluginNodes } from '@/workflow/nodes'

const dirs = ref([])
const plugins = ref([])
const loading = ref(false)

const refresh = async () => {
  loading.value = true
  try {
    dirs.value = await window.electronAPI.plugin.getDirs()
    // 复用 loadPluginNodes 单次扫描：同步 plu_ 节点注册并返回插件列表
    plugins.value = await loadPluginNodes()
  } catch {
    Message.error('加载失败')
  } finally {
    loading.value = false
  }
}

const handleAddDir = async () => {
  const result = await window.electronAPI.plugin.addDir()
  if (result.canceled) return
  Message.success('插件目录已添加')
  await refresh()
}

const handleRemoveDir = async (dir) => {
  await window.electronAPI.plugin.removeDir(dir)
  Message.success('已移除')
  await refresh()
}

onMounted(refresh)
</script>

<style lang="less" scoped>
.plugin-manager {
  .section-title {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    font-weight: 500;
  }
  .empty-hint {
    color: var(--color-text-3);
    font-size: 13px;
    padding: 12px 0;
  }
  .dir-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 0;
    .dir-path {
      font-size: 12px;
      color: var(--color-text-3);
      word-break: break-all;
      flex: 1;
    }
  }
  .plugin-card {
    margin-bottom: 12px;
    .plugin-header {
      display: flex;
      align-items: center;
      gap: 8px;
      .plugin-name { font-weight: 600; }
    }
    .plugin-body {
      .plugin-desc { color: var(--color-text-3); font-size: 13px; margin: 4px 0 8px; }
      .plugin-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        font-size: 12px;
        color: var(--color-text-3);
      }
      .plugin-config-preview, .plugin-io-preview {
        margin-top: 6px;
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
        font-size: 12px;
        .label { font-weight: 500; }
      }
    }
  }
.info-icon {
  cursor: pointer;
  color: var(--color-text-3);
  font-size: 16px;
}
  .tutorial-content {
    h3 { margin-top: 20px; margin-bottom: 8px; font-size: 15px; }
    h3:first-child { margin-top: 0; }
    pre {
      background: var(--color-fill-2);
      padding: 12px;
      border-radius: 4px;
      font-size: 12px;
      overflow-x: auto;
      code { font-family: 'Menlo', 'Fira Code', monospace; }
    }
    ul, ol { padding-left: 20px; li { margin: 4px 0; font-size: 13px; } }
    p { font-size: 13px; margin: 6px 0; }
    code { background: var(--color-fill-2); padding: 1px 4px; border-radius: 2px; font-size: 12px; }
  }
}
</style>
