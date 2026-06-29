<template>
  <a-modal v-model:visible="visible" title="回收站" width="800px" :footer="false" @open="loadTrash">
    <div v-if="selectedKeys.length > 0" style="margin-bottom:12px">
      <a-space>
        <span>已选 {{ selectedKeys.length }} 项</span>
        <a-button type="primary" size="small" @click="handleBatchRestore">批量恢复</a-button>
        <a-popconfirm content="确定永久删除选中项？不可恢复！" @ok="handleBatchDelete">
          <a-button status="danger" size="small">批量删除</a-button>
        </a-popconfirm>
      </a-space>
    </div>
    <a-table :data="items" :loading="loading" :pagination="false"
      :row-selection="{ type: 'checkbox', showCheckedAll: true }"
      v-model:selected-keys="selectedKeys"
      row-key="id"
    >
      <template #columns>
        <a-table-column title="名称" data-index="name" :ellipsis="true" :width="200" />
        <a-table-column title="描述" data-index="description" :ellipsis="true" />
        <a-table-column title="删除时间" data-index="deleted_at" :width="180" />
      </template>
    </a-table>
  </a-modal>
</template>

<script setup>
import { ref } from 'vue'
import { Message } from '@arco-design/web-vue'

const visible = defineModel('visible')

const props = defineProps({
  api: { type: Object, required: true },
  onRestored: { type: Function, default: () => {} }
})

const items = ref([])
const loading = ref(false)
const selectedKeys = ref([])

const loadTrash = async () => {
  selectedKeys.value = []
  loading.value = true
  try { items.value = await props.api.getTrash() || [] } catch (e) { items.value = [] } finally { loading.value = false }
}

const handleBatchRestore = async () => {
  for (const id of selectedKeys.value) {
    await props.api.restore(id)
  }
  Message.success(`已恢复 ${selectedKeys.value.length} 项`)
  props.onRestored?.()
  loadTrash()
}

const handleBatchDelete = async () => {
  for (const id of selectedKeys.value) {
    await props.api.permanentDelete(id)
  }
  Message.success(`已永久删除 ${selectedKeys.value.length} 项`)
  props.onRestored?.()
  loadTrash()
}
</script>
