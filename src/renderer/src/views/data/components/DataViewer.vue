<template>
  <a-spin
    :loading="exporting || importing"
    :tip="`${exporting ? '导出中...' : '导入中...'}, 已处理 ${progress?.finished}${progress.total ? `/${progress.total}` : ''},请不要关闭窗口`"
    class="dataViewer"
  >
    <!-- 顶部操作栏 -->
    <div class="operation-bar">
      <div class="operation-left">
        <a-space>
          <a-tag size="large" v-if="selectedKeys.length > 0">
            选中 {{ selectedKeys.length }} 条 &nbsp;
            <a-link @click="selectedKeys = []"> 取消</a-link>
            <a-popconfirm
              :content="`确定要删除选中的 ${selectedKeys.length} 条数据吗？`"
              type="warning"
              position="br"
              @ok="handleBatchDelete"
            >
              <a-link status="danger"> 删除 </a-link>
            </a-popconfirm>
          </a-tag>
          <a-button type="primary" @click="handleAdd">
            <template #icon><icon-plus /></template>
            新增数据
          </a-button>
          <a-button type="secondary" @click="fetchData">
            <template #icon><icon-refresh /></template>
            刷新
          </a-button>
          <a-button type="secondary" @click="handleFilter">
            <template #icon><icon-search /></template>
            条件查询
          </a-button>
          <a-button @click="handleImport">
              <template #icon><icon-import /></template>
              导入Excel
            </a-button>
          <a-button @click="handleExport">
              <template #icon><icon-export /></template>
              导出Excel
            </a-button>
        </a-space>
      </div>

      <div class="operation-right">
        <a-popconfirm
          content="清空所有数据，不可恢复，是否继续？"
          type="warning"
          position="br"
          :disabled="total === 0"
          @ok="handleClearAll"
        >
          <a-button status="danger">
            <template #icon><icon-delete /></template>
            清空数据
          </a-button>
        </a-popconfirm>
      </div>
    </div>
    <!-- 数据表格 -->
    <a-table
      :data="data"
      :loading="loading"
      size="mini"
      row-key="id"
      :bordered="false"
      :pagination="{
        total,
        pageSizeOptions: [10, 50, 100, 200, 500],
        showPageSize: true,
        current: currentPage,
        pageSize: pageSize,
        showTotal: true,
        showJumper: true
      }"
      @page-change="onPageChange"
      @page-size-change="
        (size) => {
          pageSize = size
          onPageChange(1)
        }
      "
      column-resizable
      :scroll="{
        y: 'calc(90vh - 20px)',
        x: 'calc(95vw - 330px)'
      }"
      @sorter-change="handleSortChange"
      sticky-header
      @selection-change="
        ($event) => {
          selectedKeys = $event
        }
      "
      :row-selection="{
        type: 'checkbox',
        selectedRowKeys: selectedKeys,
        showCheckedAll: true
      }"
      @row-dblclick="handleEdit"
    >
      <template #columns>
        <!-- id列 -->
        <a-table-column
          title="ID"
          data-index="id"
          :width="55"
          :min-width="55"
          fixed="left"
          :sortable="{
            sorter: true,
            sortDirections: ['ascend', 'descend']
          }"
        >
        </a-table-column>
        <!-- 颜色标记列 -->
        <a-table-column
          title="标记"
          data-index="color"
          :width="55"
          :min-width="55"
          fixed="left"
          :sortable="{
            sorter: true,
            sortDirections: ['ascend', 'descend']
          }"
        >
          <template #cell="{ record }">
            <a-popover trigger="hover" position="right" popup-container="body">
              <div
                class="color-marker"
                :style="{ backgroundColor: colorOptions[record.color] || '#e5e6eb' }"
              >
                {{ record.color }}
              </div>
              <template #content>
                <div class="color-picker">
                  <div
                    v-for="(color, label) in colorOptions"
                    :key="label"
                    class="color-option color-marker"
                    :style="{ backgroundColor: color }"
                    @click="handleColorChange(record, label)"
                  >
                    {{ label }}
                  </div>
                  <div class="color-option clear" @click="handleColorChange(record, null)">
                    <icon-close />
                  </div>
                </div>
              </template>
            </a-popover>
          </template>
        </a-table-column>
        <!-- 根据字段动态生成列 -->
        <template v-for="field in fields" :key="field.name">
          <a-table-column
            :title="field.description"
            :data-index="field.name"
            :sortable="{
              sorter: true,
              sortDirections: ['ascend', 'descend']
            }"
            :width="field.description.length * 14 + 30"
            :min-width="field.description.length * 14 + 30"
          >
            <template #title>
              <a-popover>
                <template #content>
                  <a-typography-paragraph
                    copyable
                    style="margin: 0"
                    :copy-tooltip-props="{ content: field.name }"
                    :copy-text="field.name"
                  >
                    <span>字段名：{{ field.name }}</span>
                  </a-typography-paragraph>
                </template>
                <span>{{ field.description }}</span>
              </a-popover>
            </template>
            <template #cell="{ record }">
              <div :class="{ 'cell-content': true }">
                <template v-if="field.type === 'boolean'">
                  <a-tag :color="record[field.name] ? 'green' : 'red'">
                    {{ record[field.name] ? '是' : '否' }}
                  </a-tag>
                </template>
                <template v-else-if="field.type === 'json'">
                  <a-button size="mini" @click="showJsonViewer(record[field.name])">
                    查看
                  </a-button>
                </template>
                <span v-else-if="field.type === 'string'">
                  <icon-link
                    v-if="record[field.name] && record[field.name].startsWith('http')"
                    @click.stop="openUrl(record[field.name])"
                  />
                  {{ record[field.name] }}
                </span>
                <span v-else>
                  {{ record[field.name] }}
                </span>
              </div>
            </template>
          </a-table-column>
        </template>
        <a-table-column
          title="创建时间"
          data-index="created_at"
          :width="135"
          :min-width="135"
          fixed="right"
          :sortable="{
            sorter: true,
            sortDirections: ['ascend', 'descend']
          }"
        >
          <template #cell="{ record }">
            {{ record.created_at }}
          </template>
        </a-table-column>
        <!-- 操作列 -->
        <a-table-column title="操作" align="center" :width="100" fixed="right">
          <template #cell="{ record }">
            <a-space>
              <a-button type="text" @click="handleEdit(record)">
                <template #icon><icon-edit /></template>
              </a-button>
              <a-popconfirm
                content="确定要删除这条数据吗？"
                type="warning"
                position="left"
                @ok="handleDelete(record)"
              >
                <a-button type="text" status="danger">
                  <template #icon><icon-delete /></template>
                </a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </a-table-column>
      </template>
    </a-table>

    <!-- 编辑/新增弹窗（子组件） -->
    <DataEditorModal
      v-model:visible="showEditor"
      :editing-record="editingRecord"
      :fields="fields"
      :model="props.model"
      @saved="onSaved"
    />

    <!-- 打开URL -->
    <a-modal
      v-model:visible="showUrlModal"
      title="链接预览"
      :unmount-on-close="true"
      :footer="false"
      :mask-closable="true"
      width="90vw"
      body-style="padding: 0px;"
    >
      <webview :src="url" style="width: 100%; height: 45vw" />
    </a-modal>

    <!-- JSON查看器 -->
    <a-modal v-model:visible="showJsonModal" title="JSON数据" :footer="false" :mask-closable="true">
      <pre class="json-viewer">{{ jsonData }}</pre>
    </a-modal>
    <!-- 条件查询弹窗（子组件） -->
    <DataFilterModal
      v-model:visible="filterModalVisible"
      :conditions="conditions"
      :fields="filterFields"
      @search="search"
    />
  </a-spin>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { Message } from '@arco-design/web-vue'
import {
  IconPlus,
  IconEdit,
  IconSearch,
  IconClose,
  IconRefresh,
  IconImport,
  IconExport,
  IconLink
} from '@arco-design/web-vue/es/icon'
import { deepClone } from '@/workflow/utils'
import DataEditorModal from './DataEditorModal.vue'
import DataFilterModal from './DataFilterModal.vue'

const props = defineProps({
  model: {
    type: Object,
    required: true
  }
})

// 数据状态
const data = ref([])
const total = ref(0)
const loading = ref(false)
const currentPage = ref(1)
const pageSize = ref(100)
const fields = computed(() => JSON.parse(props.model.fields))
const sortField = ref('')
const sortOrder = ref('')

// 编辑器状态
const showEditor = ref(false)
const editingRecord = ref(null)

// JSON查看器状态
const showJsonModal = ref(false)
const jsonData = ref(null)

// URL查看器状态
const showUrlModal = ref(false)
const url = ref(null)
const openUrl = (record) => {
  showUrlModal.value = true
  url.value = record
}

// API引用
const { data: dataAPI } = window.electronAPI

// 选中状态
const selectedKeys = ref([])

// 颜色选项
const colorOptions = {
  红: '#F53F3F',
  橙: '#F77234',
  黄: '#F7BA1E',
  绿: '#00B42A',
  青: '#14C9C9',
  蓝: '#165DFF',
  紫: '#722ED1'
}

// 筛选条件状态
const filterModalVisible = ref(false)
const filterFields = computed(() => {
  const filterableFields = [
    {
      name: 'id',
      type: 'number',
      description: 'ID'
    },
    {
      name: 'color',
      type: 'string',
      description: '标记'
    },
    ...fields.value,
    {
      name: 'created_at',
      type: 'date',
      description: '创建时间'
    }
  ]
  return filterableFields
})

const conditions = ref([])
const handleFilter = () => {
  filterModalVisible.value = true
}

// 获取数据列表
const fetchData = async () => {
  filterModalVisible.value = false
  loading.value = true
  try {
    const result = await dataAPI.getModelData({
      modelId: props.model.id,
      page: currentPage.value,
      pageSize: pageSize.value,
      conditions: deepClone(conditions.value),
      sort: sortField.value
        ? [
            {
              field: sortField.value,
              order: sortOrder.value === 'descend' ? 'desc' : 'asc'
            }
          ]
        : null
    })
    data.value = result.data
    total.value = result.total
  } catch (error) {
    Message.error('获取数据失败')
    console.error('获取数据失败', error)
  } finally {
    loading.value = false
  }
}

// 处理分页变化
const onPageChange = (page) => {
  currentPage.value = page
  fetchData()
}

// 处理新增
const handleAdd = () => {
  editingRecord.value = null
  showEditor.value = true
}

// 处理编辑
const handleEdit = (record) => {
  editingRecord.value = record
  showEditor.value = true
}

// 保存成功回调（子组件 DataEditorModal 提交后触发）
const onSaved = () => {
  showEditor.value = false
  fetchData()
}

// 处理删除
const handleDelete = async (record) => {
  try {
    await dataAPI.deleteModelData({
      modelId: props.model.id,
      ids: [record.id]
    })
    Message.success('删除成功')
    fetchData()
  } catch {
    Message.error('删除失败')
  }
}

// 显示JSON查看器
const showJsonViewer = (data) => {
  try {
    jsonData.value = typeof data === 'string' ? JSON.parse(data) : data
    showJsonModal.value = true
  } catch {
    Message.error('JSON数据格式错误')
  }
}
const resetFilters = () => {
  conditions.value = []
}
const resetSort = () => {
  sortField.value = ''
  sortOrder.value = ''
}

const search = () => {
  pageSize.value = 100
  currentPage.value = 1
  fetchData()
}

onMounted(() => {
  resetFilters()
  resetSort()
  search()
  // 导入/导出进度回调：统一注册一次（preload 内部 removeAllListeners 替换，避免每次导出/导入重复注册）
  dataAPI.onImportExcelProgress(({ total, finished }) => {
    progress.value.finished = finished
    progress.value.total = total
  })
})
// 处理批量删除
const handleBatchDelete = async () => {
  try {
    const ids = selectedKeys.value.map((id) => id)
    await dataAPI.deleteModelData({
      modelId: props.model.id,
      ids
    })
    Message.success('删除成功')
    selectedKeys.value = []
    fetchData()
  } catch {
    Message.error('删除失败')
  }
}

// 处理清空数据
const handleClearAll = async () => {
  try {
    await dataAPI.clearModelData({
      modelId: props.model.id
    })
    Message.success('清空成功')
    selectedKeys.value = []
    fetchData()
  } catch {
    Message.error('清空失败')
  }
}

// 处理排序变化
const handleSortChange = (dataIndex, direction) => {
  sortField.value = dataIndex
  sortOrder.value = direction
  fetchData()
}

// 处理颜色变更
const handleColorChange = async (record, color) => {
  try {
    await dataAPI.updateModelData({
      modelId: props.model.id,
      ids: [record.id],
      data: { color }
    })
    // 更新本地数据，避免重新请求
    const index = data.value.findIndex((item) => item.id === record.id)
    if (index !== -1) {
      data.value[index].color = color
    }
    Message.success('更新成功')
  } catch {
    Message.error('更新失败')
  }
}
const exporting = ref(false)
const progress = ref({
  finished: 0,
  total: 0
})
// 处理导出数据
const handleExport = async () => {
  try {
    const pathResult = await window.electronAPI.dialog.savePath({
      title: '选择保存目录',
      buttonLabel: '选择',
      nameFieldLabel: '导出文件名',
      defaultFilename: `${props.model.name}.xlsx`,
      showsTagField: false
    })
    if (pathResult.canceled) return
    exporting.value = true
    await dataAPI.exportExcel({
      filePath: pathResult.filePath,
      modelId: props.model.id,
      conditions: deepClone(conditions.value),
      sort: sortField.value
        ? [
            {
              field: sortField.value,
              order: sortOrder.value === 'descend' ? 'desc' : 'asc'
            }
          ]
        : null,
      readFields: fields.value.map((field) => field.name)
    })
    Message.success('导出成功')
  } catch (error) {
    console.error('导出失败:', error)
    Message.error('导出失败')
  } finally {
    exporting.value = false
    progress.value.finished = 0
    progress.value.total = 0
  }
}
const importing = ref(false)
// 处理导入数据
const handleImport = async () => {
  // 创建文件选择器
  const result = await window.electronAPI.dialog.openPath({
    title: '选择要导入的Excel文件',
    buttonLabel: '导入',
    filters: [{ name: 'Excel Files', extensions: ['xlsx', 'xls'] }],
    properties: ['openFile']
  })
  if (result.canceled) return
  const filePath = result.filePaths[0]
  try {
    importing.value = true
    await dataAPI.importExcel({
      filePath,
      modelId: props.model.id
    })
    Message.success('导入成功')
    // 刷新数据
    resetFilters()
    resetSort()
    search()
  } catch (error) {
    Message.error(error.message || '导入失败')
  } finally {
    importing.value = false
    progress.value.finished = 0
    progress.value.total = 0
  }
}
</script>

<style lang="less" scoped>
.operation-bar {
  margin-bottom: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.cell-content {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-flex: 1;
}

.json-viewer {
  padding: 16px;
  background-color: var(--color-fill-2);
  border-radius: 4px;
  overflow: auto;
  max-height: 400px;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.color-marker {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 12px;
  font-weight: bold;
  &:hover {
    transform: scale(1.1);
  }
}

.color-picker {
  display: grid;
  grid-template-columns: repeat(10, 1fr);
  gap: 8px;
  .active {
    transform: scale(1.1);
    box-shadow:
      0 0 0 2px #fff,
      0 0 0 4px var(--color-primary);
    border: 2px solid #000;
  }
  .color-option {
    &.clear {
      background-color: #f2f3f5;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--color-text-3);
    }
  }
}
.filter-group {
  display: flex;
  gap: 8px;
  flex-direction: column;
}

.filter-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 600px;
  .filter-input {
    display: flex;
    gap: 8px;
    flex: 1;
  }
}

.dataViewer {
  width: 100%;
  :deep(.arco-table-header th) {
    padding: 5px 0px;
    font-size: 14px !important;
  }
  :deep(.arco-table-sorter) {
    margin-left: 4px !important;
  }
  :deep(.arco-table-cell) {
    padding: 2px 4px;
  }
}

:deep(.arco-form-item) {
  margin-bottom: 8px;
}

.operation-left {
  .arco-btn {
    .icon {
      margin-right: 6px;
    }
  }
}

:deep(.arco-dropdown-option) {
  .icon {
    margin-right: 8px;
  }
}

.url {
  cursor: pointer;
  margin: 0px;
  &:hover {
    color: rgb(var(--link-6));
  }
}
:deep(.arco-spin-mask) {
  z-index: 10000;
}
</style>
