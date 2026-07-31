/**
 * @file: 工作流节点定义
 * @author: dabao
 * @date: 2024-03-15
 * @update: 2025-07-29 — 重构为版本化自动发现机制
 *
 * 节点版本化规则：
 * - 节点目录结构：nodes/{nodeType}/V{num}/index.js
 * - import.meta.glob eager 模式自动加载所有版本
 * - 每个 nodeType 自动选取最大版本号作为节点定义
 * - 旧版本目录保留，工作流保存时记录版本号实现兼容
 */

// ═══════════════════════════════════════════════════
// 1. Eager 加载所有版本节点定义
// ═══════════════════════════════════════════════════
const allNodeModules = import.meta.glob('./*/V*/index.js', { eager: true })

/**
 * 从所有版本中为每个 nodeType 选取最新版本
 * nodeDefMap[type] = { ...nodeDef, _version: 'V2' }
 */
const nodeDefMap = {}
Object.entries(allNodeModules).forEach(([modulePath, mod]) => {
  const match = modulePath.match(/^\.\/([^/]+)\/V(\d+)\/index\.js$/)
  if (!match) return
  const [, nodeType, verNum] = match
  const ver = parseInt(verNum, 10)
  const current = nodeDefMap[nodeType]
  if (!current || ver > current._verNum) {
    const def = mod.default || mod
    nodeDefMap[nodeType] = {
      ...def,
      _version: `V${verNum}`,
      _verNum: ver
    }
  }
})

/** 便捷方法：从 type 名数组解析为节点定义数组 */
const resolveNodes = (...types) => types.map((t) => nodeDefMap[t]).filter(Boolean)

// ═══════════════════════════════════════════════════
// 2. 节点分类（保持原有顺序和分组）
// ═══════════════════════════════════════════════════
export const categories = {
  workflow: {
    name: '流程控制',
    nodes: resolveNodes(
      'workflowIf', 'workflowLoop', 'workflowEnd', 'workflowRestart',
      'workflowThrowException', 'workflowNotice', 'workflowCustomNode',
      'workflowSubWorkflow', 'workflowCallPlugin'
    )
  },
  time: {
    name: '时间计数',
    nodes: resolveNodes(
      'timeGetter', 'timeHandle', 'timeSchedule', 'timeDelay',
      'timeBaseTimer', 'timeBaseTimerHandle', 'timeCounter', 'timeCounterHandle'
    )
  },
  browser: {
    name: '网页控制',
    nodes: resolveNodes(
      'browserOpen', 'browserUrlVisit', 'browserKeyboardInput', 'browserMouseAction',
      'browserPageScroll', 'browserContentGetter', 'browserElementState', 'browserElementEdit',
      'browserInjectScript', 'browserFileSelect', 'browserScreenshot', 'browserMonitor',
      'browserOnNewPage', 'browserDownloadListener', 'browserDomListener',
      'browserNetworkListener', 'browserWebsocketListener', 'browserSavePdf'
    )
  },
  data: {
    name: '本地数据',
    nodes: resolveNodes('dataSave', 'dataRead', 'dataDelete', 'dataUpdate', 'dataTemp', 'dataTempClear')
  },
  network: {
    name: '网络操作',
    nodes: resolveNodes('networkHttpRequest', 'networkHttpServer', 'networkWebsocketConnect', 'networkWebsocketSend')
  },
  file: {
    name: '文件操作',
    nodes: resolveNodes(
      'fileDirCreate', 'fileOpenDir', 'fileDirectoryTraverse', 'fileReader', 'fileSave',
      'fileWriter', 'fileMove', 'fileCopy', 'fileDelete', 'fileStatus'
    )
  },
  dataProcess: {
    name: '数据处理',
    nodes: resolveNodes(
      'dataCreate', 'dataHandlerString', 'dataHandlerNumber', 'dataHandlerObject',
      'dataHandlerArray', 'dataParser', 'dataExtract', 'dataFilter', 'dataClipboard'
    )
  },
  workbook: {
    name: 'Excel',
    nodes: resolveNodes(
      'workbookCreate', 'workbookSave', 'workbookCellMerge', 'workbookCellMergeUn',
      'workbookCellRead', 'workbookCellWrite', 'workbookRowInsert', 'workbookRowDelete',
      'workbookColumnInsert', 'workbookColumnDelete'
    )
  },
  preview: {
    name: '文件预览',
    nodes: resolveNodes('previewImage', 'previewVideo', 'previewAudio')
  }
}

// ═══════════════════════════════════════════════════
// 3. 扁平化节点映射
// ═══════════════════════════════════════════════════
const getNodes = () => {
  const nodes = {}
  Object.values(categories).forEach((category) => {
    category.nodes.forEach((node) => {
      nodes[node.type] = node
    })
  })
  // workflowStart 和 workFlow 确保始终存在
  nodes['workflowStart'] = nodeDefMap['workflowStart']
  nodes['workFlow'] = nodeDefMap['workFlow']
  return nodes
}

export default getNodes()

const availableNodesForAIBot = getNodes()
export { availableNodesForAIBot }
