// 事件爆发间隔阈值（毫秒）
const BURST_GAP_MS = 80;

// 上一次事件时间
let lastWheelTime = -Infinity;

// 当前爆发是否为鼠标滚轮
let burstIsWheel = false;

/**
 * 单个事件的分类逻辑
 * @param {WheelEvent} event
 * @returns {boolean}
 */
function classifySingleEvent(event) {
  // Firefox: deltaMode判断最可靠
  if (event.deltaMode !== WheelEvent.DOM_DELTA_PIXEL) {
    return true;
  }

  // Chrome/Safari: wheelDelta判断
  if (typeof event.wheelDeltaY === 'number' && event.wheelDeltaY !== 0) {
    return event.wheelDeltaY % 120 === 0;
  }
  if (typeof event.wheelDeltaX === 'number' && event.wheelDeltaX !== 0) {
    return event.wheelDeltaX % 120 === 0;
  }

  // 回退方案
  const { deltaX, deltaY } = event;
  if (deltaX !== 0 && deltaY !== 0) {
    return false;
  }
  return Number.isInteger(deltaX) && Number.isInteger(deltaY);
}

/**
 * 对外暴露的判断方法
 * @param {WheelEvent} event
 * @returns {boolean} true=触摸板，false=鼠标滚轮
 */
export function isTouchpadEvent(event) {
  const now = performance.now();

  // 如果是新的事件爆发，重新分类
  if (now - lastWheelTime > BURST_GAP_MS) {
    burstIsWheel = classifySingleEvent(event);
  }

  lastWheelTime = now;
  return !burstIsWheel;
}
