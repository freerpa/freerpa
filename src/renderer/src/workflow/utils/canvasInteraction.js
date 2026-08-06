import { isTouchpadEvent } from './isTouchpadEvent.js'

/**
 * 画布滚轮/DOM 交互工具——从 FlowCanvas 提取（纯函数，无状态）
 */

// 触摸板处理：平移画布
export const handleTouchpadWheel = (e, vueFlowRef) => {
  const { x, y, zoom } = vueFlowRef.value.viewport
  vueFlowRef.value.setViewport({
    x: x - e.deltaX,
    y: y - e.deltaY,
    zoom
  })
}

// 判断鼠标下元素是否需要 no-wheel（含 no-wheel 类的元素自身或祖先）
export const isNoWheelElement = (e) => {
  // 获取鼠标当前位置的元素
  const targetElement = document.elementFromPoint(e.clientX, e.clientY)
  if (!targetElement) return false

  // 检查元素本身或其父元素是否包含 no-wheel 类
  let currentElement = targetElement
  while (currentElement) {
    if (currentElement.classList.contains('no-wheel')) {
      return true // 找到 no-wheel 元素，返回需要禁用
    }
    currentElement = currentElement.parentElement // 向上遍历父元素
  }
  return false // 未找到，允许滚轮
}

// 鼠标滚轮处理：缩放画布
export const handleMouseWheel = (e, vueFlowRef) => {
  const zoom = vueFlowRef.value.viewport.zoom
  let zoomStep = 0
  if (e.deltaY > 0) {
    zoomStep = Math.min(e.deltaY, 30)
  } else {
    zoomStep = Math.max(e.deltaY, -30)
  }
  vueFlowRef.value.zoomTo(zoom - zoomStep * 0.002)
}

// 判断元素是否为“可滚动元素”（需要自身响应滚轮）
export const isScrollableElement = (element) => {
  if (!element) return false

  // 1. 输入框类元素：本身可滚动（如多行文本框）或不需要画布响应
  const inputTypes = ['INPUT', 'TEXTAREA', 'SELECT']
  if (inputTypes.includes(element.tagName) || element.isContentEditable) {
    return true
  }

  // 2. 可滚动容器：overflow 为 auto/scroll 且内容超出容器
  const styles = window.getComputedStyle(element)
  const isScrollable =
    (styles.overflow === 'auto' ||
      styles.overflow === 'scroll' ||
      styles.overflowX === 'auto' ||
      styles.overflowX === 'scroll' ||
      styles.overflowY === 'auto' ||
      styles.overflowY === 'scroll') &&
    // 内容高度 > 容器高度（垂直可滚动），或内容宽度 > 容器宽度（水平可滚动）
    (element.scrollHeight > element.clientHeight || element.scrollWidth > element.clientWidth)

  return isScrollable
}

// 检查事件目标或其祖先是否为可滚动元素
export const isInScrollableElement = (e) => {
  let currentElement = e.target
  // 向上遍历至 body，检查是否有可滚动元素
  while (currentElement && currentElement !== document.body) {
    if (isScrollableElement(currentElement)) {
      return true
    }
    currentElement = currentElement.parentElement
  }
  return false
}

// 点击处理：向文档发送 mousedown 事件，触发 select 的 popup
export const dispatchMouseDown = () => {
  document.documentElement.dispatchEvent(new Event('mousedown'))
}

// 处理滚轮事件（触摸板平移 / 鼠标缩放 / no-wheel 与可滚动元素豁免）
export const handleWheel = (e, vueFlowRef) => {
  if (isTouchpadEvent(e) && !isInScrollableElement(e)) {
    handleTouchpadWheel(e, vueFlowRef)
  } else if (!isNoWheelElement(e) && !isInScrollableElement(e)) {
    handleMouseWheel(e, vueFlowRef)
  }
}
