/**
 * @file: 权限数据共享工具（渲染端）— 默认值与规范化，与主进程 workflow/permissions.js 保持一致
 */
export const DEFAULTS = () => ({
  io: { roots: [] },
  network: { mode: 'allow-all', rules: [] },
  process: { enabled: false, commands: [] },
  env: { allow: [] },
  sys: { allow: [] },
  ffi: { enabled: false, paths: [] },
  import: { enabled: false, hosts: [] }
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

/** 读取全局权限（含旧安全目录 allowedRoot 迁移，与主进程 getPermissions 一致） */
export const loadGlobalPermissions = async () => {
  const saved = await window.electronAPI.store.get('permissions')
  if (!saved) {
    const oldRoot = await window.electronAPI.store.get('allowedRoot')
    if (oldRoot) {
      const migrated = DEFAULTS()
      migrated.io.roots = [oldRoot]
      return migrated
    }
  }
  return normalizePermissions(saved)
}
