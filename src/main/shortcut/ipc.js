/**
 * @file: 快捷键管理 IPC
 * @description: 从 DEFAULTS 直接读取，用户修改时仅存 override 映射
 */
import { ipcMain } from 'electron'
import { get, set } from '../store/index.js'

const STORE_OVERRIDES_KEY = 'shortcutOverrides'

// 默认快捷键 — 仅画布相关
const DEFAULTS = [
  // ─── 画布 — 执行控制 ───
  { id: 'workflow.save', name: '保存工作流', category: '画布 — 执行控制', keys: 'CommandOrControl+S', type: 'inapp' },
  { id: 'workflow.run', name: '运行工作流', category: '画布 — 执行控制', keys: 'CommandOrControl+R', type: 'inapp' },
  { id: 'workflow.stop', name: '停止工作流', category: '画布 — 执行控制', keys: 'Escape', type: 'inapp' },

  // ─── 画布 — 视图 ───
  { id: 'canvas.zoomIn', name: '放大画布', category: '画布 — 视图', keys: '=', type: 'inapp' },
  { id: 'canvas.zoomOut', name: '缩小画布', category: '画布 — 视图', keys: '-', type: 'inapp' },
  { id: 'canvas.fitView', name: '适合视图', category: '画布 — 视图', keys: 'CommandOrControl+D', type: 'inapp' },
  { id: 'canvas.autoLayout', name: '自动布局', category: '画布 — 视图', keys: 'CommandOrControl+K', type: 'inapp' },

  // ─── 画布 — 节点 ───
  { id: 'canvas.copy', name: '复制节点', category: '画布 — 节点', keys: 'CommandOrControl+C', type: 'inapp' },
  { id: 'canvas.cut', name: '剪切节点', category: '画布 — 节点', keys: 'CommandOrControl+X', type: 'inapp' },
  { id: 'canvas.paste', name: '粘贴节点', category: '画布 — 节点', keys: 'CommandOrControl+V', type: 'inapp' },
  { id: 'canvas.delete', name: '删除节点', category: '画布 — 节点', keys: 'Delete', type: 'inapp' },
  { id: 'canvas.selectAll', name: '全选节点', category: '画布 — 节点', keys: 'CommandOrControl+A', type: 'inapp' },

  // ─── 画布 — 编辑 ───
  { id: 'canvas.undo', name: '撤销', category: '画布 — 编辑', keys: 'CommandOrControl+Z', type: 'inapp' },
  { id: 'canvas.redo', name: '重做', category: '画布 — 编辑', keys: 'CommandOrControl+Shift+Z', type: 'inapp' }
]

/** 读取 override 映射 { shortcutId: 'keys' } */
const getOverrides = () => get(STORE_OVERRIDES_KEY) || {}

/** 合并 DEFAULTS + override */
const mergeAll = () => {
  const overrides = getOverrides()
  return DEFAULTS.map((s) => ({
    ...s,
    keys: overrides[s.id] || s.keys
  }))
}

export const register = () => {
  ipcMain.handle('shortcut:list', async () => mergeAll())

  ipcMain.handle('shortcut:update', async (_, { id, keys }) => {
    const overrides = getOverrides()
    overrides[id] = keys
    set(STORE_OVERRIDES_KEY, overrides)
    return { success: true }
  })

  ipcMain.handle('shortcut:reset', async () => {
    set(STORE_OVERRIDES_KEY, {})
    return { success: true, list: DEFAULTS }
  })

  ipcMain.handle('shortcut:getDefaults', async () => DEFAULTS)
}
