/**
 * @file: 快捷键匹配工具
 * @description: 将 Electron accelerator 字符串匹配到键盘事件
 */

/** 检测是否为 macOS */
const isMacOS = () => navigator.platform.toUpperCase().includes('MAC')

/**
 * 将 accelerator 字符串匹配到键盘事件
 * @param {KeyboardEvent} e 键盘事件
 * @param {string} accelerator - 如 "CommandOrControl+S" / "Delete" / "Escape"
 * @returns {boolean}
 */
export const matchAccelerator = (e, accelerator) => {
  if (!accelerator) return false
  const parts = accelerator.split('+').map((p) => p.trim())

  let expectedCtrl = false
  let expectedShift = false
  let expectedAlt = false
  let expectedMeta = false
  let expectedKey = ''

  for (const part of parts) {
    switch (part) {
      case 'CommandOrControl':
        expectedCtrl = true
        expectedMeta = true
        break
      case 'Command':
        expectedMeta = true
        break
      case 'Control':
      case 'Ctrl':
        expectedCtrl = true
        break
      case 'Shift':
        expectedShift = true
        break
      case 'Alt':
        expectedAlt = true
        break
      default:
        expectedKey = part.toUpperCase()
    }
  }

  // 检查修饰键
  const hasCtrl = isMacOS()
    ? e.ctrlKey && (expectedCtrl || expectedMeta)
    : (e.ctrlKey || e.metaKey) && expectedCtrl
  const hasMeta = isMacOS()
    ? e.metaKey && (expectedCtrl || expectedMeta)
    : false

  const ctrlOk = expectedCtrl || expectedMeta ? (hasCtrl || hasMeta) : (!e.ctrlKey && !e.metaKey)
  const shiftOk = expectedShift === e.shiftKey
  const altOk = expectedAlt === e.altKey

  if (!ctrlOk || !shiftOk || !altOk) return false

  // 检查按键名
  const key = e.key.toUpperCase()
  if (expectedKey === 'DELETE' && (key === 'DELETE' || key === 'BACKSPACE')) return true
  if (expectedKey === 'BACKSPACE' && (key === 'BACKSPACE' || key === 'DELETE')) return true
  if (expectedKey === 'ESCAPE' && key === 'ESCAPE') return true

  // 功能键
  if (['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'].includes(expectedKey)) {
    return key === expectedKey
  }

  // 普通键（不区分大小写）
  if (expectedKey === '=' && key === '=') return true
  if (expectedKey === '-' && key === '-') return true

  return key === expectedKey
}

/**
 * 在快捷键列表中查找匹配项
 * @param {KeyboardEvent} e
 * @param {Array} shortcuts - [{ id, keys, ... }]
 * @returns {string|null} 匹配的 shortcutId
 */
export const findMatch = (e, shortcuts) => {
  for (const s of shortcuts) {
    if (matchAccelerator(e, s.keys)) {
      return s.id
    }
  }
  return null
}
