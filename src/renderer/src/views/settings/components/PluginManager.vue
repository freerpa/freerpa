<template>
  <div class="plugin-manager">
    <a-card title="本地插件管理" :bordered="false">
      <template #extra>
        <a-space>
          <a-button type="text" size="small" @click="showTutorial = true">查看开发教程</a-button>
          <a-popover content="通过添加插件目录来安装本地插件。每个插件是一个独立文件夹，文件夹名作为插件唯一 ID，包含 plugin.json（描述文件）和 execute.js（执行文件）。">
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
                  <a-tag size="small" color="arcoblue">v{{ plg.version }}</a-tag>
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

    <!-- 开发教程 Modal -->
    <a-modal v-model:visible="showTutorial" title="本地插件开发教程" width="800px" :footer="false">
      <div class="tutorial-content">
        <h3>一、插件目录结构</h3>
        <pre><code>my-plugin/           ← 文件夹名 = 插件全局唯一 ID
├── plugin.json      ← 描述文件（必选）
├── execute.js        ← 执行文件（必选）
└── package.json      ← npm 依赖声明（可选）</code></pre>

        <h3>二、plugin.json 描述文件</h3>
        <pre><code>{
  "name": "我的插件",
  "version": "1.0.0",
  "description": "插件功能描述",
  "icon": "可选图标",
  "config": {
    "basic": {
      "name": "基础配置",
      "fields": {
        "param1": {
          "id": "param1",
          "name": "参数一",
          "type": "text",
          "default": "",
          "description": "参数说明"
        }
      }
    }
  },
  "inputs": [
    { "id": "input1", "name": "输入数据", "type": "any", "required": false }
  ],
  "outputs": [
    { "id": "result", "name": "执行结果", "type": "any" }
  ]
}</code></pre>

        <p><strong>config</strong> 格式与现有节点开发规范完全一致，支持所有字段类型（text/number/select/switch/radio/code/browser…）。<br />
        <strong>inputs</strong> 定义上游节点传入的数据端口。<br />
        <strong>outputs</strong> 定义插件输出的数据端口。</p>

        <h3>三、execute.js 执行文件</h3>
        <pre><code>/**
 * 插件执行入口
 * @param {Object} node   - 节点数据（id/name/type/config/inputs/outputs/store）
 * @param {Object} context - 上下文工具（complete/next/wait/fs/...）
 */
async function execute(node, context) {
  const { param1 } = node.config
  const { input1 } = node.inputs
  const { complete, next, wait, fs, sendNodeEvent } = context

  // 你的业务逻辑
  const result = `处理结果: ${param1}`

  // 输出到下一个节点
  complete({ result })
}

export default execute  // 或 module.exports = execute</code></pre>

        <h3>四、可用的 context API</h3>
        <ul>
          <li><code>context.complete(outputs, isNext?)</code> — 完成节点并输出数据</li>
          <li><code>context.next(outputs?)</code> — 执行下一个节点</li>
          <li><code>context.wait(ms)</code> — 异步延迟</li>
          <li><code>context.fs</code> — 文件系统实例（readdir/stat/readFile/writeFile…）</li>
          <li><code>context.getOutputs()</code> / <code>context.setOutputs(data)</code> — 读写输出</li>
          <li><code>context.executeSubFlow(input?)</code> — 执行子工作流</li>
          <li><code>context.sendNodeEvent(event)</code> — 发送节点事件</li>
          <li><code>context.onNodeEvent(callback)</code> — 监听节点事件</li>
          <li><code>context.onBeforeDestroy(callback)</code> — 销毁前回调</li>
          <li><code>context.stopWorkflow(output?)</code> — 停止工作流</li>
          <li><code>context.runCode(code, ctx?)</code> — 运行代码</li>
          <li><code>context.apis</code> — API 接口（如 getBrowserDetail）</li>
          <li><code>context.nodeId</code> — 当前节点 ID</li>
        </ul>

        <h3>五、Node.js 环境</h3>
        <p>插件在完整 Node.js 环境中运行，<strong>无沙箱限制</strong>。可以直接使用 <code>require()</code> 引入任意模块，包括文件系统、子进程、网络请求等。</p>

        <h3>六、创建与打包</h3>
        <ol>
          <li>创建一个文件夹，文件夹名作为插件唯一 ID</li>
          <li>编写 <code>plugin.json</code> 定义配置项和输入输出</li>
          <li>编写 <code>execute.js</code> 实现业务逻辑（必须 export default async function）</li>
          <li>如需 npm 依赖，在 <code>package.json</code> 中声明并在插件目录运行 <code>npm install</code></li>
          <li>将插件文件夹放入插件搜索目录，应用自动发现</li>
          <li>打包分发：直接打包整个插件文件夹为 zip</li>
        </ol>

        <h3>七、使用方法</h3>
        <p>在工作流编辑器中，从节点面板的「流程控制」分类拖入<strong>「调用插件」</strong>节点，选择对应的本地插件即可使用。</p>
      </div>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { Message } from '@arco-design/web-vue'
import { IconPlus, IconDelete, IconRefresh, IconInfoCircle } from '@arco-design/web-vue/es/icon'

const dirs = ref([])
const plugins = ref([])
const loading = ref(false)
const showTutorial = ref(false)

const refresh = async () => {
  loading.value = true
  try {
    dirs.value = await window.electronAPI.plugin.getDirs()
    plugins.value = await window.electronAPI.plugin.list()
  } catch (e) {
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
