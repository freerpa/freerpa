/**
 * @file 资源列表页通用逻辑
 * @description 收敛 data / browser / elementSet / workflowManager 四个列表页的
 * 分页加载、搜索、多选批量删除、复制、导出、导入等重复逻辑
 */
import { ref, watch, onActivated } from 'vue'
import { Message, Modal } from '@arco-design/web-vue'
import { debounce } from 'lodash-es'
import { exportToFile, batchExportToFile, importFromFile } from '@/utils/importer'

/**
 * @param {Object} options
 * @param {{ list: Function, get: Function, remove: Function }} options.api - 列表/详情/删除接口
 * @param {Object} options.moduleConfig - MODULE_CONFIG 中对应模块配置
 * @param {string} options.listErrorMsg - 列表加载失败提示语
 */
export function useResourceList({ api, moduleConfig, listErrorMsg }) {
  const items = ref([])
  const searchKeyword = ref('')
  const selectedIds = ref([])
  const loading = ref(false)
  const currentPage = ref(1)
  const pageSize = 24
  const hasMore = ref(true)
  const categoryId = ref('')
  const showCopyModal = ref(false)
  const copyTarget = ref(null)

  /** 重新加载第一页（供增删改、回收站恢复等场景调用） */
  const refetch = () => fetchList(true)

  const onCategoryChange = (val) => { categoryId.value = val; fetchList(true) }
  const loadMore = () => { currentPage.value++; fetchList() }

  const fetchList = async (refresh = false) => {
    if (refresh) { currentPage.value = 1; hasMore.value = true }
    loading.value = true
    try {
      const result = await api.list({
        page: currentPage.value,
        pageSize,
        keyword: searchKeyword.value,
        category_id: categoryId.value
      })
      if (result.data.length < pageSize) hasMore.value = false
      items.value = currentPage.value === 1 ? result.data : [...items.value, ...result.data]
    } catch { Message.error(listErrorMsg) } finally { loading.value = false }
  }

  watch(searchKeyword, debounce(() => { currentPage.value = 1; fetchList(true) }, 300))
  onActivated(() => fetchList(true))

  // ─── 复制 ──────────────────────────────────────────
  const handleCopy = (item) => { copyTarget.value = item; showCopyModal.value = true }

  /**
   * 复制确认
   * @param {number} count 复制份数
   * @param {(item: Object, suffix: string) => Promise<void>} copyOne 单份复制实现
   */
  const handleCopyConfirm = async (count, copyOne) => {
    const item = copyTarget.value
    try {
      for (let i = 1; i <= count; i++) {
        const suffix = count > 1 ? ` - 副本${i}` : ' - 副本'
        await copyOne(item, suffix)
      }
      Message.success(`已复制 ${count} 份`)
      refetch()
    } catch { Message.error('复制失败') }
  }

  // ─── 单条删除 ──────────────────────────────────────
  const confirmDelete = (item, nameGetter, onOk) => {
    Modal.confirm({
      title: '删除确认',
      content: `确认删除"${nameGetter(item)}"吗？`,
      okText: '删除',
      okButtonProps: { status: 'danger', type: 'primary', style: { width: '160px' } },
      cancelButtonProps: { style: { width: '160px' } },
      onOk
    })
  }

  // ─── 批量删除 ──────────────────────────────────────
  /** 清空多选并刷新（批量操作完成后的统一收尾） */
  const clearSelectionAndRefetch = () => { selectedIds.value = []; refetch() }

  const handleBatchDelete = async (ids, removeOne) => {
    try {
      await Promise.all(ids.map((id) => removeOne(id)))
      Message.success(`已移入回收站 ${ids.length} 项`)
    } catch { Message.error('批量删除失败') }
    clearSelectionAndRefetch()
  }

  // ─── 导出 / 批量导出 / 导入 ────────────────────────
  const handleExport = async (item, buildPayload) => {
    const full = await api.get(item.id)
    await exportToFile(async () => buildPayload(full), moduleConfig)
  }

  const handleBatchExport = async (ids, buildPayload) => {
    const fulls = await Promise.all(ids.map((id) => api.get(id)))
    await batchExportToFile(async () => fulls.map(buildPayload), moduleConfig)
  }

  const handleImport = () => {
    importFromFile(() => refetch())
  }

  return {
    items, searchKeyword, selectedIds, loading, hasMore, categoryId, pageSize,
    showCopyModal, copyTarget,
    refetch, fetchList, onCategoryChange, loadMore,
    handleCopy, handleCopyConfirm,
    confirmDelete, handleBatchDelete, clearSelectionAndRefetch,
    handleExport, handleBatchExport, handleImport
  }
}
