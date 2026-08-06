import { ref, watch } from 'vue'

/**
 * 字段远程选项加载（Select/Radio/Checkbox 共用）
 * 统一 loading 状态、异常处理与静态 options 同步
 * @param {Object} field 字段定义（field.remote / field.remoteMethod / field.options）
 * @param {Function} [getCallArg] remoteMethod 调用参数构造（(keyword)=>arg；Select 传 keyword，Radio/Checkbox 传当前值）
 * @param {*} [extra] remoteMethod 第二参数（Select 透传 formData）
 */
export function useRemoteOptions(field, getCallArg, extra) {
  const loading = ref(false)
  const options = ref(field.options || [])

  const loadOptions = async (keyword = '') => {
    if (!field.remote || typeof field.remoteMethod !== 'function') {
      return
    }
    loading.value = true
    try {
      const result = await field.remoteMethod(getCallArg ? getCallArg(keyword) : keyword, extra)
      options.value = result || []
    } catch (err) {
      console.error('加载选项失败:', err)
      options.value = []
    } finally {
      loading.value = false
    }
  }

  // 静态 options 变化时同步（仅数组；函数 options 由调用方 resolveOptions 处理）
  watch(
    () => field.options,
    (newVal) => {
      if (Array.isArray(newVal)) {
        options.value = newVal
      }
    }
  )

  return { loading, options, loadOptions }
}
