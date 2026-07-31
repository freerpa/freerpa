<!--
 * @file: 数据删除节点视图
 * @author: dabao
 * @date: 2024-03-29
 -->
<template>
  <div class="data-delete-view">
    <!-- 基本信息 -->
    <div class="basic-info">
      <a-descriptions
        :data="basicInfo"
        size="mini"
        :column="1"
        layout="inline-horizontal"
      />
    </div>

    <!-- 删除条件 -->
    <div class="delete-condition">
      <div class="condition-header">删除条件</div>
      <div class="condition-content">
        <pre>{{ formattedCondition }}</pre>
      </div>
    </div>

    <!-- 删除历史 -->
    <div v-if="deleteHistory.length > 0" class="delete-history">
      <div class="history-header">
        <span>删除历史</span>
        <a-button type="text" size="mini" @click="clearHistory">清除</a-button>
      </div>
      <div class="history-list">
        <div
          v-for="(item, index) in deleteHistory"
          :key="index"
          class="history-item"
        >
          <div class="history-time">{{ item.time }}</div>
          <div class="history-status">
            <a-tag :color="item.success ? 'green' : 'red'">
              {{ item.success ? '成功' : '失败' }}
            </a-tag>
          </div>
          <div class="history-info">
            <template v-if="item.success">
              已删除 {{ item.count }} 条数据
            </template>
            <template v-else>
              {{ item.error || '删除失败' }}
            </template>
          </div>
        </div>
      </div>
    </div>

    <!-- 备份信息 -->
    <div v-if="backupInfo.length > 0" class="backup-info">
      <div class="backup-header">备份记录</div>
      <div class="backup-list">
        <div
          v-for="(item, index) in backupInfo"
          :key="index"
          class="backup-item"
        >
          <div class="backup-time">{{ item.time }}</div>
          <div class="backup-path">{{ item.path }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  node: {
    type: Object,
    required: true
  }
})

// 删除历史
const deleteHistory = ref([])
const maxHistoryLength = 10

// 备份信息
const backupInfo = ref([])
const maxBackupLength = 5

// 计算基本信息
const basicInfo = computed(() => {
  const { database, table, backup, dryRun, cascade } = props.node.config || {}

  return [
    { label: '数据库类型', value: database || '未配置' },
    { label: '表名/集合', value: table || '未配置' },
    { label: '数据备份', value: backup ? '已启用' : '未启用' },
    { label: '空运行', value: dryRun ? '已启用' : '未启用' },
    { label: '级联删除', value: cascade ? '已启用' : '未启用' }
  ]
})

// 格式化删除条件
const formattedCondition = computed(() => {
  const condition = props.node.config?.condition
  if (!condition) return '未配置'
  try {
    return JSON.stringify(condition, null, 2)
  } catch {
    return condition
  }
})

// 清除历史
const clearHistory = () => {
  deleteHistory.value = []
  backupInfo.value = []
}

// 添加删除历史
const addDeleteHistory = (success, count = 0, error = null) => {
  deleteHistory.value.unshift({
    time: new Date().toLocaleString(),
    success,
    count,
    error
  })

  if (deleteHistory.value.length > maxHistoryLength) {
    deleteHistory.value = deleteHistory.value.slice(0, maxHistoryLength)
  }
}

// 添加备份记录
const addBackupInfo = (path) => {
  backupInfo.value.unshift({
    time: new Date().toLocaleString(),
    path
  })

  if (backupInfo.value.length > maxBackupLength) {
    backupInfo.value = backupInfo.value.slice(0, maxBackupLength)
  }
}

// 处理节点事件
const onNodeEvent = ({ type, data }) => {
  if (type === 'complete') {
    addDeleteHistory(data.success, data.count, data.error)
  } else if (type === 'backup') {
    addBackupInfo(data.path)
  }
}

defineExpose({
  onNodeEvent
})
</script>

<style lang="less" scoped>
.data-delete-view {
  .basic-info {
    padding: 8px;
    background: var(--color-fill-2);
    border-radius: 4px;
    margin-bottom: 8px;
  }

  .delete-condition {
    margin-bottom: 8px;

    .condition-header {
      padding: 4px 8px;
      background: var(--color-fill-2);
      border-radius: 4px 4px 0 0;
    }

    .condition-content {
      padding: 8px;
      background: var(--color-fill-1);
      border-radius: 0 0 4px 4px;

      pre {
        margin: 0;
        white-space: pre-wrap;
        word-break: break-all;
      }
    }
  }

  .delete-history {
    margin-bottom: 8px;

    .history-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 4px 8px;
      background: var(--color-fill-2);
      border-radius: 4px 4px 0 0;
    }

    .history-list {
      padding: 8px;
      background: var(--color-fill-1);
      border-radius: 0 0 4px 4px;
      max-height: 200px;
      overflow: auto;

      .history-item {
        display: flex;
        align-items: center;
        padding: 4px 0;
        border-bottom: 1px solid var(--color-neutral-3);

        &:last-child {
          border-bottom: none;
        }

        .history-time {
          width: 150px;
          color: var(--color-text-3);
          font-size: 12px;
        }

        .history-status {
          width: 60px;
          text-align: center;
        }

        .history-info {
          flex: 1;
          padding: 0 8px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      }
    }
  }

  .backup-info {
    .backup-header {
      padding: 4px 8px;
      background: var(--color-fill-2);
      border-radius: 4px 4px 0 0;
    }

    .backup-list {
      padding: 8px;
      background: var(--color-fill-1);
      border-radius: 0 0 4px 4px;

      .backup-item {
        display: flex;
        align-items: center;
        padding: 4px 0;
        border-bottom: 1px solid var(--color-neutral-3);

        &:last-child {
          border-bottom: none;
        }

        .backup-time {
          width: 150px;
          color: var(--color-text-3);
          font-size: 12px;
        }

        .backup-path {
          flex: 1;
          padding: 0 8px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      }
    }
  }
}
</style> 