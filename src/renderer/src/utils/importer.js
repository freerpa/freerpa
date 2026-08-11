/**
 * @file: 通用导入/导出工具
 * @description: 封装工作流/浏览器/数据表/元素集的导入导出，统一处理压缩、魔数头、文件 I/O、版本检查、重名处理、进度展示
 */

import { getAppVersion, compareVersion } from '@/utils/version'
import { Message, Modal } from '@arco-design/web-vue'

// ─── 模块配置 ──────────────────────────────────────────
// 魔数头: FR = FreeRPA, 第三字节为模块首字母
export const MODULE_CONFIG = {
  workflow: {
    header: [0x46, 0x52, 0x57, 0x00], // FRW\0
    ext: '.frw',
    moduleKey: 'workflow',
    label: '工作流'
  },
  browser: {
    header: [0x46, 0x52, 0x42, 0x00], // FRB\0
    ext: '.frb',
    moduleKey: 'browser',
    label: '浏览器'
  },
  model: {
    header: [0x46, 0x52, 0x4d, 0x00], // FRM\0
    ext: '.frm',
    moduleKey: 'model',
    label: '数据表'
  },
  elementSet: {
    header: [0x46, 0x52, 0x45, 0x00], // FRE\0
    ext: '.fre',
    moduleKey: 'elementSet',
    label: '元素集'
  }
}

// 所有模块值数组（按优先级排列）
const ALL_CONFIGS = Object.values(MODULE_CONFIG)

// ─── 内部工具 ──────────────────────────────────────────

/** 比较魔数头是否匹配 */
const matchHeader = (fileData, header) => {
  return header.every((byte, i) => fileData[i] === byte)
}

/** 根据文件魔数头查找匹配的模块配置 */
const findConfigByHeader = (fileData) => {
  return ALL_CONFIGS.find((c) => matchHeader(fileData, c.header)) || null
}

/** 读取 File 对象为 Uint8Array */
const readFileAsUint8Array = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (ev) => resolve(new Uint8Array(ev.target.result))
    reader.onerror = () => reject(new Error(`读取文件失败: ${file.name}`))
    reader.readAsArrayBuffer(file)
  })
}

/** 从数据中提取用于导出的文件名 */
const getDisplayName = (data) => {
  return data.name || data.title || 'export'
}

// ─── 模块导入器（内置，通过 window.electronAPI 调用） ────

const MODULE_IMPORTERS = {
  workflow: async (data) => {
    const api = window.electronAPI.workflow
    const existing = await api.getWorkflows({ page: 1, pageSize: 999999, keyword: data.name })
    if (existing.data.some((w) => w.name === data.name)) {
      data.name = `【导入】${data.name}`
    }
    await api.createWorkflow({
      name: data.name,
      description: data.description,
      graph: typeof data.graph === 'string' ? JSON.parse(data.graph) : data.graph
    })
  },
  browser: async (data) => {
    const api = window.electronAPI.browserLocal
    const existing = await api.getBrowsers({ page: 1, pageSize: 999999, keyword: data.name })
    if (existing.data.some((b) => b.name === data.name)) {
      data.name = `【导入】${data.name}`
    }
    await api.createBrowser(data)
  },
  model: async (data) => {
    const api = window.electronAPI.data
    const existing = await api.getModels({ page: 1, pageSize: 999999, keyword: data.name })
    if (existing.data.some((m) => m.name === data.name)) {
      data.name = `【导入】${data.name}`
    }
    await api.createModel({
      name: data.name,
      description: data.description,
      fields: data.fields
    })
  },
  elementSet: async (data) => {
    const api = window.electronAPI.elementSet
    const existing = await api.getElementSets({ page: 1, pageSize: 999999, keyword: data.title })
    if (existing.data.some((e) => e.title === data.title)) {
      data.title = `【导入】${data.title}`
    }
    await api.createElementSet({
      title: data.title,
      description: data.description,
      category_id: data.category_id,
      elements: data.elements || []
    })
  }
}

// ─── 导出结果弹窗 ──────────────────────────────────────

const showImportSummary = (summary) => {
  const lines = []
  for (const [label, { success, failed }] of Object.entries(summary)) {
    if (success.length > 0) {
      lines.push(`【${label}】成功 ${success.length} 条：${success.join('、')}`)
    }
    if (failed.length > 0) {
      lines.push(`【${label}】失败 ${failed.length} 条：${failed.join('、')}`)
    }
  }
  const content = lines.length > 0 ? lines.join('\n') : '没有可导入的文件'
  Modal.info({
    title: '导入结果',
    content,
    simple: false
  })
}

// ─── 公开 API ─────────────────────────────────────────

/**
 * 导出数据为文件
 * @param {Function} getDataFn - 异步函数，返回要导出的数据对象（不含 app_version/exportTime）
 * @param {Object} config - 模块配置 { header, ext, moduleKey, label }
 * @param {Object} [extraFields] - 额外的顶层字段（如 data: []）
 */
export async function exportToFile(getDataFn, config, extraFields = {}) {
  let loadingMsg = null
  try {
    loadingMsg = Message.loading({ content: '正在导出...', duration: 0 })
    const data = await getDataFn()
    const exportData = {
      app_version: getAppVersion(),
      exportTime: new Date().toISOString(),
      [config.moduleKey]: data,
      ...extraFields
    }
    const { deflate } = await import('pako')
    const compressed = deflate(new TextEncoder().encode(JSON.stringify(exportData)))
    const header = new Uint8Array(config.header)
    const fileData = new Uint8Array(header.length + compressed.length)
    fileData.set(header)
    fileData.set(compressed, header.length)
    const blob = new Blob([fileData])
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${getDisplayName(data)} - ${config.label}${config.ext}`
    a.click()
    URL.revokeObjectURL(url)
    loadingMsg.close()
    Message.success('导出成功')
  } catch (e) {
    if (loadingMsg) loadingMsg.close()
    Message.error('导出失败: ' + e.message)
    throw e
  }
}

/**
 * 批量导入文件（支持多选、自动匹配模块类型）
 * @param {Function} [onComplete] - 导入完成后的回调（所有文件处理完毕后调用）
 * @returns {Promise<Object>} 导入结果汇总
 */
export function importFromFile(onComplete) {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.accept = ALL_CONFIGS.map((c) => c.ext).join(',')

    input.onchange = async (e) => {
      const files = Array.from(e.target.files || [])
      if (files.length === 0) {
        resolve(null)
        return
      }

      const summary = {}
      let finished = 0
      const total = files.length

      let loadingMsg = Message.loading({ content: `导入中... 0 / ${total}`, duration: 0 })

      for (const file of files) {
        try {
          // 1. 读取文件
          const fileData = await readFileAsUint8Array(file)

          // 2. 根据魔数头匹配模块配置
          const config = findConfigByHeader(fileData)
          if (!config) {
            throw new Error('无法识别的文件格式')
          }

          // 3. 解压
          const { inflate } = await import('pako')
          const text = new TextDecoder().decode(inflate(fileData.slice(4)))
          if (!text || text.trim().length === 0) {
            throw new Error('文件内容为空')
          }

          const importData = JSON.parse(text)

          // 4. 校验结构
          if (!importData.app_version || !importData[config.moduleKey]) {
            throw new Error('文件内容不完整，缺少必要字段')
          }

          // 5. 版本检查
          if (compareVersion(getAppVersion(), importData.app_version) < 0) {
            throw new Error('文件由更高版本软件创建，请升级后重试')
          }

          // 6. 调用模块导入器
          const data = importData[config.moduleKey]
          if (MODULE_IMPORTERS[config.moduleKey]) {
            await MODULE_IMPORTERS[config.moduleKey](data)
          }

          // 7. 记录成功
          if (!summary[config.label]) {
            summary[config.label] = { success: [], failed: [] }
          }
          summary[config.label].success.push(getDisplayName(data))
        } catch (err) {
          // 尝试根据扩展名匹配标签
          const ext = '.' + file.name.split('.').pop()?.toLowerCase()
          const configByExt = ALL_CONFIGS.find((c) => c.ext === ext)
          const label = configByExt?.label || '未知类型'
          if (!summary[label]) {
            summary[label] = { success: [], failed: [] }
          }
          summary[label].failed.push(`${file.name}: ${err.message}`)
        }

        finished++
        // 更新进度
        loadingMsg.close()
        loadingMsg = Message.loading({ content: `导入中... ${finished} / ${total}`, duration: 0 })
      }

      loadingMsg.close()

      // 显示汇总弹窗
      showImportSummary(summary)

      // 回调
      if (onComplete) {
        onComplete(summary)
      }
      resolve(summary)
    }

    input.click()
  })
}
