/**
 * @file: 权限管理（worker 版）— 存储、迁移、deno 权限描述符生成
 *
 * 数据模型（user-preferences.permissions 全局默认）：
 *   io:      { roots: string[] }            文件系统可访问目录（read+write）
 *   network: { mode: 'allow-all'|'allow-list'|'disabled', rules: string[] }  域名/IP 规则（支持 *.domain 通配）
 *   process: { enabled: boolean, commands: string[] }  子进程白名单（空=允许任意命令）
 *   env:     { allow: string[] }            环境变量白名单（空=全部禁止）
 *   sys:     { allow: string[] }            系统信息权限（空=全部禁止）
 */
import { get as storeGet } from '../store'

export const PERMISSIONS_KEY = 'permissions'

const DEFAULTS = {
  io: { roots: [] },
  network: { mode: 'allow-all', rules: [] },
  process: { enabled: false, commands: [] },
  env: { allow: [] },
  sys: { allow: [] },
  ffi: { enabled: false, paths: [] },
  import: { enabled: false, hosts: [] }
}

const normalize = (p) => {
  const out = structuredClone(DEFAULTS)
  if (!p || typeof p !== 'object') return out
  out.io = { roots: Array.isArray(p.io?.roots) ? p.io.roots : [] }
  const mode = p.network?.mode
  out.network = {
    mode: ['allow-all', 'allow-list', 'disabled'].includes(mode) ? mode : DEFAULTS.network.mode,
    rules: Array.isArray(p.network?.rules) ? p.network.rules : []
  }
  out.process = { enabled: !!p.process?.enabled, commands: Array.isArray(p.process?.commands) ? p.process.commands : [] }
  out.env = { allow: Array.isArray(p.env?.allow) ? p.env.allow : [] }
  out.sys = { allow: Array.isArray(p.sys?.allow) ? p.sys.allow : [] }
  out.ffi = { enabled: !!p.ffi?.enabled, paths: Array.isArray(p.ffi?.paths) ? p.ffi.paths : [] }
  out.import = { enabled: !!p.import?.enabled, hosts: Array.isArray(p.import?.hosts) ? p.import.hosts : [] }
  return out
}

/** 读取全局权限（迁移旧安全目录 allowedRoot） */
export const getPermissions = () => {
  const stored = storeGet(PERMISSIONS_KEY)
  const p = normalize(stored)
  // 迁移：旧安全目录 → io.roots（仅当从未配置过权限时）
  if (!stored && storeGet('allowedRoot')) {
    p.io.roots = [storeGet('allowedRoot')]
  }
  return p
}

// node 兼容层（process.env）模块加载期必需的非敏感环境变量（用户配置 env 白名单时自动附加）
const INFRA_ENV = [
  'GRACEFUL_FS_PLATFORM', 'WS_NO_BUFFER_UTIL', 'WS_NO_UTF_8_VALIDATE',
  'NODE_ENV', 'NODE_DEBUG', 'HOME', 'USERPROFILE', 'TMPDIR', 'TEMP', 'TMP', 'PATH', 'LANG'
]

/**
 * 生成 deno Worker 权限描述符（最小权限原则）
 * env 默认全允许（node 生态兼容硬约束，ws/graceful-fs 等模块加载期读取环境变量）；
 * 用户配置 env 白名单后收紧。IO/网络/子进程默认最小。
 * @param {object} effective  getPermissions 的结果
 * @param {string[]} infraReadPaths 基础设施读路径（引擎/节点/node_modules，自动授予）
 */
export const buildDenoPermissions = (effective, infraReadPaths) => {
  const net = effective.network
  const run = effective.process
  const allowEnv = effective.env.allow
  const ffi = effective.ffi
  const imp = effective.import
  return {
    read: [...new Set([...infraReadPaths, ...effective.io.roots])],
    write: [...effective.io.roots],
    net: net.mode === 'allow-all' ? true : net.mode === 'disabled' ? [] : net.rules.filter(Boolean),
    run: run.enabled ? (run.commands.length ? run.commands : true) : [],
    ffi: ffi.enabled ? (ffi.paths.length ? ffi.paths : true) : [],
    import: imp.enabled ? (imp.hosts.length ? imp.hosts : true) : [],
    env: allowEnv && allowEnv.length ? [...new Set([...INFRA_ENV, ...allowEnv])] : true,
    sys: [...effective.sys.allow]
  }
}
