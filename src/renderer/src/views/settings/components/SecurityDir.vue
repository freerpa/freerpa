<template>
  <div class="security-dir">
    <a-card title="安全目录设置" :bordered="false">
      <template #extra>
        <a-popover content="安全目录用于限制文件操作节点（如读写文件、遍历目录等）的访问范围，超出此目录的文件操作将被阻止。">
          <icon-info-circle class="info-icon" />
        </a-popover>
      </template>

      <div class="current-path">
        <span class="label">当前安全目录：</span>
        <a-tag color="arcoblue" size="large" style="max-width: 100%; overflow: hidden; text-overflow: ellipsis">
          {{ currentPath || '未设置' }}
        </a-tag>
        <a-button type="primary" size="small" style="margin-left: 12px" @click="handleChange">
          <template #icon><icon-edit /></template>
          更改
        </a-button>
      </div>

    </a-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { Message } from '@arco-design/web-vue'
import { IconEdit, IconInfoCircle } from '@arco-design/web-vue/es/icon'

const currentPath = ref('')

const fetchPath = async () => {
  currentPath.value = await window.electronAPI.store.get('allowedRoot') || ''
}

const savePath = async (path) => {
  await window.electronAPI.store.set('allowedRoot', path)
  await fetchPath()
  Message.success('安全目录已更新')
}

const handleChange = async () => {
  const result = await window.electronAPI.dialog.openPath({
    title: '选择安全目录',
    properties: ['openDirectory']
  })
  if (result.canceled || !result.filePaths?.length) return
  await savePath(result.filePaths[0])
}

onMounted(fetchPath)
</script>

<style lang="less" scoped>
.security-dir {
  .current-path {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    .label {
      font-weight: 500;
      white-space: nowrap;
    }
  }
}
.info-icon {
  cursor: pointer;
  color: var(--color-text-3);
  font-size: 16px;
}
</style>
