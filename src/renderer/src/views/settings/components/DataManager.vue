<template>
  <div class="data-manager">
    <a-card title="数据管理" :bordered="false">
      <template #extra>
        <a-popover content="更换存储位置或恢复备份后，需要重启应用才能生效。">
          <icon-info-circle class="info-icon" />
        </a-popover>
      </template>

      <!-- 数据库信息 -->
      <div class="info-row">
        <span class="label">数据库大小：</span>
        <a-tag :color="dbInfo.exists ? 'arcoblue' : 'gray'" size="large">{{ dbInfo.label || '加载中...' }}</a-tag>
      </div>

      <div class="info-row">
        <span class="label">存储位置：</span>
        <span class="path-text">{{ dbInfo.path || '加载中...' }}</span>
        <a-button type="text" size="small" @click="openFolder">
          <template #icon><icon-folder /></template> 
        </a-button>
      </div>

      <a-divider />

      <!-- 操作按钮 -->
      <a-space direction="vertical" size="medium" fill>
        <div class="action-row">
          <span class="label">更换存储位置：</span>
          <a-button @click="handleChangeLocation">
            <template #icon><icon-swap /></template>
            选择新目录
          </a-button>
        </div>

        <div class="action-row">
          <span class="label">备份数据库：</span>
          <a-button type="primary" @click="handleBackup" :loading="backingUp">
            <template #icon><icon-export /></template>
            立即备份
          </a-button>
        </div>

        <div class="action-row">
          <span class="label">恢复数据库：</span>
          <a-popconfirm content="恢复备份将覆盖当前所有数据，应用将自动重启。确认继续？" @ok="handleRestore">
            <a-button status="danger" :loading="restoring">
              <template #icon><icon-import /></template>
              恢复备份
            </a-button>
          </a-popconfirm>
        </div>
      </a-space>
    </a-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { Message } from '@arco-design/web-vue'
import { IconFolder, IconSwap, IconExport, IconImport, IconInfoCircle } from '@arco-design/web-vue/es/icon'

const dbInfo = reactive({
  path: '',
  exists: false,
  size: 0,
  label: ''
})

const backingUp = ref(false)
const restoring = ref(false)

const fetchInfo = async () => {
  try {
    const result = await window.electronAPI.dbInfo.getInfo()
    Object.assign(dbInfo, result)
  } catch (e) {
    Message.error('获取数据库信息失败')
  }
}

const openFolder = () => {
  window.electronAPI.dbInfo.openFolder()
}

const handleChangeLocation = async () => {
  const result = await window.electronAPI.dbInfo.changeLocation()
  if (result.canceled) return
  if (result.same) {
    Message.info('新目录与当前目录相同，无需更改')
    return
  }
  if (result.error) {
    Message.error(result.error)
    return
  }
  if (result.success) {
    Message.success('数据库位置已更改，正在重启应用...')
    setTimeout(() => window.electronAPI.window.close(), 1500)
  }
}

const handleBackup = async () => {
  backingUp.value = true
  try {
    const result = await window.electronAPI.dbInfo.backup()
    if (result.canceled) return
    if (result.error) {
      Message.error(result.error)
      return
    }
    Message.success(`备份成功！保存至: ${result.backupPath}`)
  } catch (e) {
    Message.error('备份失败: ' + e.message)
  } finally {
    backingUp.value = false
  }
}

const handleRestore = async () => {
  restoring.value = true
  try {
    const result = await window.electronAPI.dbInfo.restore()
    if (result.canceled) return
    if (result.error) {
      Message.error(result.error)
      return
    }
    if (result.success) {
      Message.success('数据库已恢复，正在重启应用...')
      setTimeout(() => window.electronAPI.window.close(), 1500)
    }
  } catch (e) {
    Message.error('恢复失败: ' + e.message)
  } finally {
    restoring.value = false
  }
}

onMounted(fetchInfo)
</script>

<style lang="less" scoped>
.data-manager {
  .info-row {
    display: flex;
    align-items: center;
    margin-bottom: 12px;
    gap: 8px;
    .label {
      font-weight: 500;
      white-space: nowrap;
    }
    .path-text {
      font-size: 13px;
      color: var(--color-text-3);
      word-break: break-all;
    }
  }
  .action-row {
    display: flex;
    align-items: center;
    gap: 12px;
    .label {
      font-weight: 500;
      white-space: nowrap;
      min-width: 100px;
    }
  }
}
.info-icon {
  cursor: pointer;
  color: var(--color-text-3);
  font-size: 16px;
}
</style>
