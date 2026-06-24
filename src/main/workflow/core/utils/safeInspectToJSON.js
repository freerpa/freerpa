/**
 * 安全地将对象序列化为 JSON，支持循环引用、函数、Symbol、RegExp 等
 * @param {*} obj - 需要序列化的对象
 * @param {number} [space] - JSON 缩进空格数
 * @returns {string} - 合法的 JSON 字符串
 */
export function safeInspectToJSON(obj, space = 2) {
  const seen = new WeakSet();

  return JSON.stringify(obj, (key, value) => {
    // 处理循环引用
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular]';
      }
      seen.add(value);
    }

    // 处理特殊类型
    if (typeof value === 'function') {
      return 'function';
    }
    if (typeof value === 'symbol') {
      return 'symbol';
    }
    if (value instanceof Date) {
      return { type: 'Date', value: value.toISOString() };
    }
    if (value instanceof RegExp) {
      return { type: 'RegExp', source: value.source, flags: value.flags };
    }
    if (value instanceof Map) {
      return { type: 'Map', entries: Array.from(value.entries()) };
    }
    if (value instanceof Set) {
      return { type: 'Set', values: Array.from(value.values()) };
    }
    if (value instanceof Error) {
      return {
        type: 'Error',
        name: value.name,
        message: value.message,
        stack: value.stack
      };
    }

    return value;
  }, space);
}