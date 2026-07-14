/**
 * 拦截输入字段中的键盘事件，防止画布快捷键意外触发
 * 规则：所有 Ctrl/Meta 组合键 + Delete/Backspace/+/-/功能键 在输入字段中阻止传播
 */
export const unDoReDoInterceptor = (e) => {
  const key = e.key.toLowerCase()
  const isModifierKey = e.ctrlKey || e.metaKey || e.altKey

  // Ctrl/Meta + 任意键 = 可能是快捷键，拦截
  if (isModifierKey) {
    e.stopPropagation()
    return
  }

  // 特殊键
  const blockedKeys = new Set(['delete', 'backspace', '=', '-', 'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10', 'f11', 'f12', 'escape'])
  if (blockedKeys.has(key)) {
    e.stopPropagation()
  }
}
