/**
 * @file: 通用深拷贝（渲染端共用）
 * Vue 响应式 Proxy 不可被 structuredClone 克隆（IPC 传参会报 "An object could not be cloned"），
 * 统一用 JSON 序列化往返的 toPlain 语义（仅纯数据对象，函数/循环引用不适用）。
 */
export const toPlain = (obj) => JSON.parse(JSON.stringify(obj))
