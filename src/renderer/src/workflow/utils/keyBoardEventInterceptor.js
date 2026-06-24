//拦截默认撤销重做键盘事件
export const unDoReDoInterceptor = (e) => {
  const key = e.key.toLowerCase()
  // 检测撤销操作 (Ctrl+Z 或 Cmd+Z)
  const isUndo = (e.ctrlKey || e.metaKey) && key === 'z'

  // 检测重做操作 (Ctrl+Y 或 Cmd+Y 或 Ctrl+Shift+Z)
  const isRedo = (e.ctrlKey || e.metaKey) && (key === 'y' || (key === 'z' && e.shiftKey))

  if (isUndo || isRedo) {
    e.preventDefault()
  }

  const isAllSelect = (e.ctrlKey || e.metaKey) && key === 'a'
  const isCopy = (e.ctrlKey || e.metaKey) && key === 'c'
  const isPaste = (e.ctrlKey || e.metaKey) && key === 'v'
  const isCut = (e.ctrlKey || e.metaKey) && key === 'x'
  const isDelete = key === 'delete' || key === 'backspace'
  const isZoom = key === '=' || key === '-'
  // 如果是删除键则拦截
  if (isDelete || isAllSelect || isCopy || isPaste || isZoom || isCut) {
    e.stopPropagation()
  }
}
