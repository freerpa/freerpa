/**
 * @file: 快捷键管理（纯渲染进程，不依赖任何 IPC 和 main process）
 */
const STORAGE_KEY = 'shortcutOverrides'

// 默认快捷键 — 仅画布相关
const DEFAULTS = [
  // ─── 画布 — 执行控制 ───
  { id: 'workflow.save', name: '保存工作流', category: '画布 — 执行控制', keys: 'CommandOrControl+S' },
  { id: 'workflow.run',  name: '运行工作流', category: '画布 — 执行控制', keys: 'CommandOrControl+R' },
  { id: 'workflow.stop', name: '停止工作流', category: '画布 — 执行控制', keys: 'Escape' },

  // ─── 画布 — 视图 ───
  { id: 'canvas.zoomIn',    name: '放大画布', category: '画布 — 视图', keys: '=' },
  { id: 'canvas.zoomOut',   name: '缩小画布', category: '画布 — 视图', keys: '-' },
  { id: 'canvas.fitView',   name: '适合视图', category: '画布 — 视图', keys: 'CommandOrControl+D' },
  { id: 'canvas.autoLayout',name: '自动布局', category: '画布 — 视图', keys: 'CommandOrControl+K' },

  // ─── 画布 — 节点 ───
  { id: 'canvas.copy',      name: '复制节点', category: '画布 — 节点', keys: 'CommandOrControl+C' },
  { id: 'canvas.cut',       name: '剪切节点', category: '画布 — 节点', keys: 'CommandOrControl+X' },
  { id: 'canvas.paste',     name: '粘贴节点', category: '画布 — 节点', keys: 'CommandOrControl+V' },
  { id: 'canvas.delete',    name: '删除节点', category: '画布 — 节点', keys: 'Delete' },
  { id: 'canvas.selectAll', name: '全选节点', category: '画布 — 节点', keys: 'CommandOrControl+A' },

  // ─── 画布 — 编辑 ───
  { id: 'canvas.undo', name: '撤销', category: '画布 — 编辑', keys: 'CommandOrControl+Z' },
  { id: 'canvas.redo', name: '重做', category: '画布 — 编辑', keys: 'CommandOrControl+Shift+Z' }
]

// ─── Override 存储 ─────────────────────────────────

const getOverrides = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') } catch { return {} }
}
const saveOverrides = (map) => localStorage.setItem(STORAGE_KEY, JSON.stringify(map))

/** 获取合并后的快捷键列表 */
export const getShortcuts = () => {
  const overrides = getOverrides()
  return DEFAULTS.map((s) => ({ ...s, keys: overrides[s.id] || s.keys }))
}

/** 获取默认值（用于恢复） */
export const getDefaults = () => DEFAULTS

/** 更新单个快捷键 */
export const updateShortcut = (id, keys) => {
  const overrides = getOverrides()
  overrides[id] = keys
  saveOverrides(overrides)
  notify()
}

/** 重置全部 */
export const resetShortcuts = () => {
  localStorage.removeItem(STORAGE_KEY)
  notify()
}

// ─── 变更通知（发布/订阅）──────────────────────────

const listeners = new Set()

export const onChanged = (fn) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

const notify = () => {
  listeners.forEach((fn) => fn())
}

// ─── 按键匹配 ──────────────────────────────────────

const isMac = () => navigator.platform.toUpperCase().includes('MAC')

/** 将 accelerator 字符串匹配到键盘事件 */
export const matchAccelerator = (e, accelerator) => {
  if (!accelerator) return false
  const parts = accelerator.split('+').map((p) => p.trim())

  let wantCtrl = false; let wantShift = false; let wantAlt = false; let wantMeta = false
  let wantKey = ''

  for (const p of parts) {
    switch (p) {
      case 'CommandOrControl': wantCtrl = true; wantMeta = true; break
      case 'Command': wantMeta = true; break
      case 'Control': case 'Ctrl': wantCtrl = true; break
      case 'Shift': wantShift = true; break
      case 'Alt': wantAlt = true; break
      default: wantKey = p.toUpperCase()
    }
  }

  const needMod = wantCtrl || wantMeta
  const mac = isMac()
  const ctrlOk = needMod ? (mac ? e.ctrlKey || e.metaKey : e.ctrlKey || e.metaKey) : (!e.ctrlKey && !e.metaKey)
  if (!ctrlOk || wantShift !== e.shiftKey || wantAlt !== e.altKey) return false

  const key = e.key.toUpperCase()
  if (wantKey === 'DELETE' && (key === 'DELETE' || key === 'BACKSPACE')) return true
  if (wantKey === 'ESCAPE' && key === 'ESCAPE') return true
  if (['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'].includes(wantKey)) return key === wantKey
  return key === wantKey
}

/** 在快捷键列表中查找匹配项，返回 shortcutId 或 null */
export const findMatch = (e, shortcuts) => {
  for (const s of shortcuts) {
    if (matchAccelerator(e, s.keys)) return s.id
  }
  return null
}

// ─── 格式化显示 ────────────────────────────────────

export const formatKeys = (keys) => {
  if (!keys) return '未设置'
  return keys
    .replace('CommandOrControl', isMac() ? '⌘' : 'Ctrl')
    .replace('Shift', '⇧')
    .replace('Alt', '⌥')
    .replace(/\+/g, ' + ')
}

/** 从键盘事件提取 accelerator 字符串（用于录制） */
export const eventToAccelerator = (e) => {
  const parts = []
  if (e.metaKey || e.ctrlKey) parts.push('CommandOrControl')
  if (e.shiftKey) parts.push('Shift')
  if (e.altKey) parts.push('Alt')
  if (!['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) parts.push(e.key.toUpperCase())
  return parts.join('+')
}
