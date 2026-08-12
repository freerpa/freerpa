<template>
  <div class="config-manager">
    <a-card title="配置中心" :bordered="false">
      <template #extra>
        <a-space>
          <a-popover content="通用键值配置（系统内部配置如权限/模型/网络服务等不在此展示）。值支持 JSON 格式：输入 JSON 将按类型保存，否则存为字符串。">
            <icon-info-circle class="info-icon" />
          </a-popover>
          <a-button type="primary" size="small" @click="openCreate">
            <template #icon><icon-plus /></template>
            添加配置
          </a-button>
        </a-space>
      </template>
      <a-table :data="configList" :pagination="false" :loading="loading" size="small" row-key="key">
        <template #columns>
          <a-table-column title="配置名" data-index="key" :width="200">
            <template #cell="{ record }">
              <span class="mono">{{ record.key }}</span>
            </template>
          </a-table-column>
          <a-table-column title="配置值" data-index="value">
            <template #cell="{ record }">
              <span class="value-text">{{ formatValue(record.value) }}</span>
            </template>
          </a-table-column>
          <a-table-column title="操作" :width="140" align="right">
            <template #cell="{ record }">
              <a-space>
                <a-button type="text" size="mini" @click="openEdit(record)">编辑</a-button>
                <a-popconfirm content="确认删除该配置？" @ok="handleDelete(record.key)">
                  <a-button type="text" size="mini" status="danger">删除</a-button>
                </a-popconfirm>
              </a-space>
            </template>
          </a-table-column>
        </template>
      </a-table>
    </a-card>

    <!-- 添加/编辑弹窗 -->
    <a-modal v-model:visible="modalVisible" :title="editingKey ? '编辑配置' : '添加配置'" :on-before-ok="handleSave" @cancel="resetForm">
      <a-form :model="form" layout="vertical" size="small">
        <a-form-item label="配置名" required>
          <a-input v-model="form.key" :disabled="!!editingKey" placeholder="如 mySetting" />
        </a-form-item>
        <a-form-item label="配置值" required>
          <a-textarea
            v-model="form.rawValue"
            :auto-size="{ minRows: 3, maxRows: 10 }"
            placeholder='支持 JSON（如 {"a":1} / [1,2] / 123 / true），否则存为字符串'
          />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { Message } from '@arco-design/web-vue'
import { IconPlus, IconInfoCircle } from '@arco-design/web-vue/es/icon'

const loading = ref(false)
const configList = ref([])
const modalVisible = ref(false)
const editingKey = ref('')
const form = ref({ key: '', rawValue: '' })

const load = async () => {
  loading.value = true
  try {
    const entries = await window.electronAPI.store.list() || {}
    configList.value = Object.keys(entries)
      .sort()
      .map((key) => ({ key, value: entries[key] }))
  } catch (e) {
    Message.error('获取配置失败: ' + (e?.message || e))
  } finally {
    loading.value = false
  }
}

// 展示：对象/数组 JSON 化，字符串原样
const formatValue = (value) => {
  if (value === null) return 'null'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

const resetForm = () => {
  editingKey.value = ''
  form.value = { key: '', rawValue: '' }
}

const openCreate = () => {
  resetForm()
  modalVisible.value = true
}
const openEdit = (record) => {
  editingKey.value = record.key
  form.value = {
    key: record.key,
    rawValue: typeof record.value === 'string' ? record.value : JSON.stringify(record.value)
  }
  modalVisible.value = true
}

// 解析值：合法 JSON 按类型保存，否则字符串（与 settings 表 JSON 序列化一致）
const parseValue = (raw) => {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  try {
    return JSON.parse(trimmed)
  } catch {
    return trimmed
  }
}

const handleSave = async () => {
  const key = form.value.key.trim()
  if (!key) {
    Message.warning('配置名不能为空')
    return false
  }
  try {
    await window.electronAPI.store.set(key, parseValue(form.value.rawValue))
    Message.success('已保存')
    modalVisible.value = false
    resetForm()
    load()
    return true
  } catch (e) {
    Message.error('保存失败: ' + (e?.message || e))
    return false
  }
}

const handleDelete = async (key) => {
  try {
    const res = await window.electronAPI.store.remove(key)
    if (res?.success) {
      Message.success('已删除')
      load()
    } else {
      Message.error(res?.error || '删除失败')
    }
  } catch (e) {
    Message.error('删除失败: ' + (e?.message || e))
  }
}

onMounted(load)
</script>

<style lang="less" scoped>
.config-manager {
  .mono {
    font-family: monospace;
  }
  .value-text {
    word-break: break-all;
    color: var(--color-text-2);
  }
  .info-icon {
    cursor: pointer;
    color: var(--color-text-3);
    font-size: 16px;
  }
}
</style>
