/**
 * @file: 工作流节点定义
 * @update: 2025-07-29 — 重构为版本化自动发现机制
 *
 * 节点版本化规则：
 * - 节点目录结构：nodes/{nodeType}/V{num}/index.js
 * - import.meta.glob eager 模式自动加载所有版本
 * - 每个 nodeType 自动选取最大版本号作为节点定义
 * - 旧版本目录保留，工作流保存时记录版本号实现兼容
 *
 * 本地插件节点（plu_<插件id>）：
 * - 运行期由 loadPluginNodes() 从本地插件目录扫描注册，无独立源码目录
 * - 统一图标、config 展开插件配置并注入隐藏 pluginId 字段（default = 插件 id）
 * - 执行时经 worker nodeLoader 的 plu_ 前缀映射复用 pluginCall 执行器
 */

import { reactive, markRaw } from 'vue'
import { RiPlugLine } from '@remixicon/vue'

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
      'workflowSubWorkflow'
    )
  },
  globalVariable: {
    name: '全局变量',
    nodes: resolveNodes('variableSet', 'variableGet')
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
    name: '数据存储',
    nodes: resolveNodes('dataSave', 'dataRead', 'dataDelete', 'dataUpdate', 'dataTemp', 'dataTempClear', 'dbConnect', 'dbExecute')
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
// 3. 扁平化节点映射 —— 响应式容器
//    运行期可动态注册本地插件节点（plu_<插件id>），
//    消费方（NodeList/useNodeConfig/getInitNodeData/AI 工具等）保持原有访问方式不变
// ═══════════════════════════════════════════════════
const getNodes = () => {
  const nodes = {}
  Object.values(categories).forEach((category) => {
    category.nodes.forEach((node) => {
      nodes[node.type] = markRaw(node)
    })
  })
  // workflowStart 和 workFlow 确保始终存在
  nodes['workflowStart'] = markRaw(nodeDefMap['workflowStart'])
  nodes['workFlow'] = markRaw(nodeDefMap['workFlow'])
  return nodes
}

const nodes = reactive(getNodes())

export default nodes

// ═══════════════════════════════════════════════════
// 4. 本地插件节点动态注册
// ═══════════════════════════════════════════════════
/** 本地插件节点类型前缀（与 worker 端 nodeLoader.js 的 PLUGIN_NODE_PREFIX 约定一致） */
export const PLUGIN_NODE_PREFIX = 'plu_'
const registeredPluginTypes = new Set()

/** 插件声明类型 → 渲染端字段类型映射 */
const PLUGIN_FIELD_TYPE_MAP = {
  string: 'text',
  number: 'number',
  boolean: 'switch',
  select: 'select',
  text: 'text'
}

/** 根据插件条目生成 plu_<identifier> 节点定义（每版本独立节点；config 数组 → 渲染端基础分组字段） */
const buildPluginNodeDef = (plugin) => {
  const identifier = plugin.identifier || (plugin.isDev ? `${plugin.pluginId}@dev` : `${plugin.pluginId}@${plugin.version}`)
  // 插件 config 数组（[{id,name,type,description,show,required}]）→ 渲染端字段对象
  const fields = {}
  const rawConfig = Array.isArray(plugin.config) ? plugin.config : []
  rawConfig.forEach((item) => {
    if (!item || !item.id) return
    fields[item.id] = {
      id: item.id,
      name: item.name || item.id,
      type: PLUGIN_FIELD_TYPE_MAP[item.type] || item.type || 'text',
      description: item.description || '',
      ...(item.show !== undefined ? { show: String(item.show) } : {}),
      ...(item.required ? { required: true } : {}),
      ...(Array.isArray(item.options) ? { options: item.options } : {}),
      ...(item.default !== undefined ? { default: item.default } : {})
    }
  })
  // 隐藏字段：pluginId（插件 id）+ _pluginIdentifier（pluginId@version，执行器精确到该版本目录）
  fields.pluginId = {
    id: 'pluginId',
    name: '插件标识',
    type: 'text',
    default: plugin.pluginId,
    show: 'false',
    paramRef: false,
    description: '本地插件唯一标识（自动绑定，不可修改）'
  }
  fields._pluginIdentifier = {
    id: '_pluginIdentifier',
    name: '插件版本标识',
    type: 'text',
    default: identifier,
    show: 'false',
    paramRef: false,
    description: '插件版本唯一标识（pluginId@version，自动绑定）'
  }
  fields._pluginName = {
    id: '_pluginName',
    name: '插件名称',
    type: 'text',
    default: plugin.name || '',
    show: 'false',
    paramRef: false
  }
  fields._pluginVersion = {
    id: '_pluginVersion',
    name: '插件版本',
    type: 'text',
    default: plugin.version || '',
    show: 'false',
    paramRef: false
  }

  const config = {
    basic: { name: '基础配置', fields }
  }

  return markRaw({
    type: `${PLUGIN_NODE_PREFIX}${identifier}`,
    name: plugin.isDev ? `${plugin.name || plugin.pluginId}（开发版）` : plugin.name || plugin.pluginId,
    icon: RiPlugLine,
    description: plugin.description || '本地插件节点，执行本地安装的插件',
    view: false,
    config,
    inputs: plugin.inputs || [],
    outputs: plugin.outputs || [],
    _version: 'V1', // 执行器目录版本（对应 pluginCall/V1/execute.js，与插件自身版本无关）
    _pluginId: plugin.pluginId,
    _identifier: identifier
  })
}

/** 注册/更新单个本地插件节点（每版本独立节点；加载失败的插件不注册） */
export const registerPluginNode = (plugin) => {
  if (!plugin?.pluginId || plugin.error) return
  const identifier = plugin.identifier || (plugin.isDev ? `${plugin.pluginId}@dev` : `${plugin.pluginId}@${plugin.version}`)
  const type = `${PLUGIN_NODE_PREFIX}${identifier}`
  nodes[type] = buildPluginNodeDef(plugin)
  registeredPluginTypes.add(type)
  // 旧节点（plu_插件ID）移除：避免与独立版本节点并存造成歧义
  const legacy = `${PLUGIN_NODE_PREFIX}${plugin.pluginId}`
  if (legacy !== type && nodes[legacy]) {
    delete nodes[legacy]
    registeredPluginTypes.delete(legacy)
  }
}

/**
 * 扫描并注册全部本地插件节点；已移除插件的节点定义同步清理。
 * 返回插件列表（含解析失败的 error 项），供列表 UI 复用，避免各消费方重复调用 plugin.list。
 */
export const loadPluginNodes = async () => {
  try {
    const plugins = (await window.electronAPI.plugin.list()) || []
    // 已注册的版本节点按 identifier（pluginId@version）清理；pluginId 用于清理残留的旧 plu_<id> 节点
    const identifiers = new Set(plugins.map((p) => p.identifier || (p.isDev ? `${p.pluginId}@dev` : `${p.pluginId}@${p.version}`)))
    const pluginIds = new Set(plugins.map((p) => p.pluginId))
    for (const type of [...registeredPluginTypes]) {
      const suffix = type.slice(PLUGIN_NODE_PREFIX.length)
      if (!identifiers.has(suffix) && !pluginIds.has(suffix)) {
        delete nodes[type]
        registeredPluginTypes.delete(type)
      }
    }
    plugins.forEach(registerPluginNode)
    return plugins
  } catch {
    // 插件 API 不可用时静默失败，仅保留已注册节点
    return []
  }
}
