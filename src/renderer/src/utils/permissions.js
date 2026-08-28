/**
 * @file: 权限数据共享工具（渲染端）— 默认值与规范化，与主进程共享常量（src/shared/permissions-constants.js）
 */
import { INFRA_ENV, PERMISSIONS_DEFAULTS } from '../../../shared/permissions-constants.js'

export const DEFAULTS = PERMISSIONS_DEFAULTS
export { INFRA_ENV }

/** 将任意存储值规范化为完整权限结构（缺失/损坏字段补默认） */
export const normalizePermissions = (saved) => {
  const d = DEFAULTS()
  if (!saved || typeof saved !== 'object') return d
  return {
    io: { roots: Array.isArray(saved.io?.roots) ? saved.io.roots : [] },
    network: {
      mode: ['allow-all', 'allow-list', 'disabled'].includes(saved.network?.mode) ? saved.network.mode : d.network.mode,
      rules: Array.isArray(saved.network?.rules) ? saved.network.rules : []
    },
    process: { enabled: !!saved.process?.enabled, commands: Array.isArray(saved.process?.commands) ? saved.process.commands : [] },
    env: { allow: Array.isArray(saved.env?.allow) ? saved.env.allow : [] },
    sys: { allow: Array.isArray(saved.sys?.allow) ? saved.sys.allow : [] },
    ffi: { enabled: !!saved.ffi?.enabled, paths: Array.isArray(saved.ffi?.paths) ? saved.ffi.paths : [] },
    import: { enabled: !!saved.import?.enabled, hosts: Array.isArray(saved.import?.hosts) ? saved.import.hosts : [] }
  }
}

/** 深拷贝（IPC 传参：Vue 响应式 Proxy 不可被 structuredClone 克隆；通用实现见 utils/deepCopy.js） */
export { toPlain } from './deepCopy.js'

/** 读取全局权限（未配置时取主进程单点生成的最安全默认；IPC 失败回退静态 DEFAULTS） */
export const loadGlobalPermissions = async () => {
  let saved
  try {
    saved = await window.electronAPI.store.get('permissions')
  } catch {
    saved = undefined // IPC 不可用：走静态兜底
  }
  if (!saved) {
    try {
      const defaults = await window.electronAPI.permissions.getDefaults()
      if (defaults) return defaults
    } catch {
      // IPC 不可用：走下方静态兜底
    }
    const oldRoot = await window.electronAPI.store.get('allowedRoot')
    if (oldRoot) {
      const migrated = DEFAULTS()
      migrated.io.roots = [oldRoot]
      return migrated
    }
    return DEFAULTS()
  }
  return normalizePermissions(saved)
}
