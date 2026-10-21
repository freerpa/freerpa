<template>
  <div class="mcp-manager">
    <a-card title="MCP 服务" :bordered="false">
      <a-space direction="vertical" fill size="medium">
        <a-alert v-if="!status" type="info" content="正在读取服务状态…" />

        <div class="row">
          <span class="label">启用 MCP 服务</span>
          <a-switch :model-value="status?.enabled" :loading="saving" @change="toggleEnabled" />
          <a-tag v-if="status?.enabled" :color="status?.running ? 'green' : 'orange'" size="small">
            {{ status?.running ? '运行中' : '未启动（可能被系统策略拦截）' }}
          </a-tag>
          <a-tag v-else color="gray" size="small">已关闭</a-tag>
        </div>

        <div class="row">
          <span class="label">只读模式</span>
          <a-switch
            :model-value="status?.readOnly"
            :disabled="!status?.enabled"
            :loading="saving"
            @change="toggleReadOnly"
          />
          <span class="hint">开启后仅允许查询类工具，所有写操作会被拒绝</span>
        </div>

        <div class="row">
          <span class="label">服务端口</span>
          <a-input-number
            v-model="portInput"
            :min="0"
            :max="65535"
            :precision="0"
            :disabled="!status?.enabled"
            style="width: 140px"
          />
          <a-button
            size="small"
            :disabled="!status?.enabled || saving || portInput === status?.requestedPort"
            @click="savePort"
          >
            应用
          </a-button>
          <span class="hint">0 为自动分配空闲端口（推荐）；固定端口被占用时自动回退</span>
        </div>

        <a-divider style="margin: 4px 0" />

        <a-descriptions :column="2" size="small" bordered>
          <a-descriptions-item label="服务地址">
            {{ status?.running ? `http://${status?.host}:${status?.port}` : '—' }}
          </a-descriptions-item>
          <a-descriptions-item label="工具数量">{{ status?.toolCount ?? 0 }}</a-descriptions-item>
          <a-descriptions-item label="客户端版本">{{ status?.appVersion || '—' }}</a-descriptions-item>
          <a-descriptions-item label="连接信息文件">
            <a-typography-text copyable style="font-size: 12px">{{ status?.bridgeFile || '—' }}</a-typography-text>
          </a-descriptions-item>
        </a-descriptions>

        <a-alert v-if="status?.portFallback" type="warning">
          <template #title>端口 {{ status.portFallback.requested }} 不可用</template>
          <div class="hint">
            原因：{{ status.portFallback.reason }}。已自动改用随机端口
            {{ status.port }}，外部程序会读取连接信息文件，无需改配置。
          </div>
        </a-alert>

        <div class="actions">
          <a-button @click="refresh">刷新状态</a-button>
          <a-button type="primary" :disabled="!status?.enabled" @click="copyConfig">
            <template #icon><icon-copy /></template>
            复制客户端配置
          </a-button>
          <a-button :disabled="!status?.enabled" @click="regenerateToken">
            <template #icon><icon-refresh /></template>
            重置 Token
          </a-button>
        </div>

        <a-alert type="info">
          <template #title>如何接入外部程序</template>
          <div class="steps">
            <div>
              1. 点击「复制客户端配置」，粘贴到 MCP 客户端配置文件的
              <b>mcpServers</b>
              中：
            </div>
            <div class="path">
              Claude Desktop（macOS）：~/Library/Application Support/Claude/claude_desktop_config.json
            </div>
            <div class="path">Claude Desktop（Windows）：%APPDATA%\Claude\claude_desktop_config.json</div>
            <div class="path">Cursor：~/.cursor/mcp.json</div>
            <div>2. 重启 MCP 客户端。配置中的命令使用 FreeRPA 自带的 Node 运行环境，无需额外安装 Node。</div>
            <div>3. 连接信息文件随客户端启动生成、退出时删除；Token 仅本机可读（0600）。</div>
          </div>
        </a-alert>
      </a-space>
    </a-card>

    <a-card title="工具清单" :bordered="false" style="margin-top: 12px">
      <a-collapse :default-active-key="['workflow']">
        <a-collapse-item
          v-for="group in toolGroups"
          :key="group.key"
          :header="`${group.label}（${group.tools.length}）`"
        >
          <div v-for="tool in group.tools" :key="tool.name" class="tool-item">
            <span class="tool-name">{{ tool.name }}</span>
            <span class="tool-title">{{ tool.title || '' }}</span>
            <div class="tool-desc">{{ tool.description }}</div>
          </div>
        </a-collapse-item>
      </a-collapse>
    </a-card>

    <a-card title="最近调用" :bordered="false" style="margin-top: 12px">
      <a-space style="margin-bottom: 8px">
        <a-button size="small" @click="refreshAudit">刷新</a-button>
        <span class="hint">审计日志按天写入用户数据目录，最多展示最近 30 条。</span>
      </a-space>
      <a-table
        :data="audit"
        :pagination="false"
        size="small"
        row-key="_key"
        :scroll="{ y: 240 }"
        :empty="'暂无调用记录'"
      >
        <template #columns>
          <a-table-column title="时间" data-index="ts" :width="180" />
          <a-table-column title="工具" data-index="tool" :width="200" />
          <a-table-column title="结果" :width="90">
            <template #cell="{ record }">
              <a-tag :color="record.ok ? 'green' : 'red'" size="small">{{ record.ok ? '成功' : '失败' }}</a-tag>
            </template>
          </a-table-column>
          <a-table-column title="耗时" data-index="ms" :width="90">
            <template #cell="{ record }">{{ record.ms != null ? `${record.ms} ms` : '—' }}</template>
          </a-table-column>
          <a-table-column title="调用方" data-index="client" :width="160" :ellipsis="true" />
          <a-table-column title="错误" data-index="error" :ellipsis="true" />
        </template>
      </a-table>
    </a-card>
  </div>
</template>

<script setup>
  import { ref, computed, onMounted } from 'vue';
  import { Message, Modal } from '@arco-design/web-vue';
  import { IconCopy, IconRefresh } from '@arco-design/web-vue/es/icon';

  const mcpAPI = window.electronAPI.mcp;
  const status = ref(null);
  const clientConfig = ref(null);
  const tools = ref([]);
  const audit = ref([]);
  const saving = ref(false);
  const portInput = ref(0);

  /** 工具按名称前缀分组，便于在长清单中定位 */
  const GROUPS = [
    { key: 'workflow', label: '工作流', test: (n) => n.startsWith('workflow_') },
    { key: 'run', label: '运行控制', test: (n) => n.startsWith('workflow_run') },
    { key: 'browser', label: '浏览器', test: (n) => n.startsWith('browser_') },
    { key: 'data', label: '数据模型 / 记录', test: (n) => n.startsWith('data_') },
    { key: 'element', label: '元素集', test: (n) => n.startsWith('element_set') },
    { key: 'category', label: '分类', test: (n) => n.startsWith('category_') },
    {
      key: 'system',
      label: '系统 / 设置',
      test: (n) => n.startsWith('system_') || n.startsWith('plugin_') || n.startsWith('setting_'),
    },
    { key: 'agent', label: 'Agent 工具', test: (n) => n.startsWith('agent_') },
    { key: 'node', label: '节点类型', test: (n) => n.startsWith('node_') },
  ];

  const toolGroups = computed(() => {
    const used = new Set();
    const groups = GROUPS.map((g) => {
      const matched = tools.value.filter((t) => g.test(t.name));
      matched.forEach((t) => used.add(t.name));
      return { key: g.key, label: g.label, tools: matched };
    }).filter((g) => g.tools.length > 0);
    const rest = tools.value.filter((t) => !used.has(t.name));
    if (rest.length) groups.push({ key: 'other', label: '其他', tools: rest });
    return groups;
  });

  const refresh = async () => {
    try {
      const [s, c, t] = await Promise.all([mcpAPI.getStatus(), mcpAPI.getConfig(), mcpAPI.listTools()]);
      status.value = s;
      portInput.value = s?.requestedPort ?? 0;
      clientConfig.value = c;
      tools.value = t || [];
      await refreshAudit();
    } catch (e) {
      Message.error(`读取 MCP 状态失败：${e?.message || e}`);
    }
  };

  const refreshAudit = async () => {
    try {
      const list = await mcpAPI.getAudit(30);
      audit.value = (list || []).map((item, index) => ({ ...item, _key: `${item.ts}-${index}` }));
    } catch {
      audit.value = [];
    }
  };

  const applySettings = async (patch) => {
    saving.value = true;
    try {
      status.value = await mcpAPI.setSettings(patch);
      Message.success('设置已保存');
    } catch (e) {
      Message.error(`保存失败：${e?.message || e}`);
    } finally {
      saving.value = false;
    }
  };

  const toggleEnabled = (value) => applySettings({ enabled: value });
  const toggleReadOnly = (value) => applySettings({ readOnly: value });
  const savePort = () => applySettings({ port: Number(portInput.value) || 0 });

  const copyConfig = async () => {
    const text = JSON.stringify(clientConfig.value?.config || {}, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      Message.success('客户端配置已复制到剪贴板');
    } catch {
      Modal.info({ title: '客户端配置', content: text, width: 640 });
    }
  };

  const regenerateToken = () => {
    Modal.warning({
      title: '重置访问 Token',
      content: '重置后已连接的外部程序会立即断开，需要重启对应 MCP 客户端。确定继续？',
      hideCancel: false,
      onOk: async () => {
        try {
          await mcpAPI.regenerateToken();
          await refresh();
          Message.success('Token 已重置，请重启外部 MCP 客户端');
        } catch (e) {
          Message.error(`重置失败：${e?.message || e}`);
        }
      },
    });
  };

  onMounted(refresh);
</script>

<style lang="less" scoped>
  .mcp-manager {
    .row {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .label {
      width: 96px;
      color: var(--color-text-2);
    }

    .hint {
      font-size: 12px;
      color: var(--color-text-3);
    }

    .actions {
      display: flex;
      gap: 8px;
    }

    .steps {
      font-size: 12px;
      line-height: 22px;

      .path {
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        color: var(--color-text-3);
        word-break: break-all;
      }
    }

    .tool-item {
      padding: 6px 0;
      border-bottom: 1px dashed var(--color-border-2);

      &:last-child {
        border-bottom: none;
      }

      .tool-name {
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 12px;
        color: rgb(var(--arcoblue-6));
      }

      .tool-title {
        margin-left: 8px;
        font-size: 12px;
        color: var(--color-text-2);
      }

      .tool-desc {
        margin-top: 2px;
        font-size: 12px;
        color: var(--color-text-3);
      }
    }
  }
</style>
