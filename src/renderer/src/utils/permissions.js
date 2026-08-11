/**
 * @file: 权限数据共享工具（渲染端）— 默认值与规范化，与主进程 workflow/permissions.js 保持一致
 */

// 基础设施环境变量白名单（node 兼容层模块加载期必需；主进程 buildDenoPermissions 强制附加，UI 展示为禁删项）
export const INFRA_ENV = [
  'GRACEFUL_FS_PLATFORM', 'TEST_GRACEFUL_FS_GLOBAL_PATCH', 'READABLE_STREAM',
  'BLUEBIRD_DEBUG', 'BLUEBIRD_LONG_STACK_TRACES', 'BLUEBIRD_WARNINGS', 'BLUEBIRD_W_FORGOTTEN_RETURN',
  'WS_NO_BUFFER_UTIL', 'WS_NO_UTF_8_VALIDATE',
  'NODE_ENV', 'NODE_DEBUG', 'HOME', 'USERPROFILE', 'TMPDIR', 'TEMP', 'TMP', 'PATH', 'LANG'
]

export const DEFAULTS = () => ({
  io: { roots: [] },
  network: { mode: 'allow-all', rules: [] },
  process: { enabled: false, commands: [] },
  env: { allow: [...INFRA_ENV] },
  sys: { allow: ['umask'] },
  ffi: { enabled: false, paths: [] },
  import: { enabled: true, hosts: [] }
})

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

/** 深拷贝（IPC 传参：Vue 响应式 Proxy 不可被 structuredClone 克隆） */
export const toPlain = (obj) => JSON.parse(JSON.stringify(obj))

/** 读取全局权限（未配置时取主进程单点生成的最安全默认，含预置 FREERPA-DATA 目录；IPC 失败回退静态 DEFAULTS） */
export const loadGlobalPermissions = async () => {
  const saved = await window.electronAPI.store.get('permissions')
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
