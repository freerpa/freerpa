<template>
  <div class="network-server-manager">
    <a-card title="本地网络服务" :bordered="false">
      <div class="port-section">
        <div class="port-row">
          <span class="label">默认端口</span>
          <a-input-number
            v-model="portInput"
            :min="1"
            :max="65535"
            :precision="0"
            style="width: 160px"
            placeholder="9264"
          />
          <a-button type="primary" @click="savePort">确认</a-button>
        </div>
        <div class="hint">工作流「HTTP服务」节点默认监听的本地端口，保存后重启应用生效。</div>
      </div>
    </a-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { Message } from '@arco-design/web-vue'

const STORE_KEY = 'networkServer'
const DEFAULT_PORT = 9264

const portInput = ref(DEFAULT_PORT)

onMounted(async () => {
  const cfg = (await window.electronAPI.store.get(STORE_KEY)) || {}
  portInput.value = Number.isInteger(cfg.port) && cfg.port > 0 ? cfg.port : DEFAULT_PORT
})

const savePort = async () => {
  const port = portInput.value
  if (port == null || !Number.isInteger(port) || port < 1 || port > 65535) {
    Message.error('请输入 1-65535 之间的端口号')
    return
  }
  await window.electronAPI.store.set(STORE_KEY, { port })
  Message.success('端口已保存，重启应用后生效')
}
</script>

<style lang="less" scoped>
.network-server-manager {
  .port-section {
    .port-row {
      display: flex;
      align-items: center;
      gap: 12px;
      .label {
      }
    }
    .hint {
      margin-top: 8px;
      font-size: 12px;
      color: var(--color-text-3);
    }
  }
}
</style>
