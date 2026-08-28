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
import { app } from 'electron'
import fs from 'fs'
import { get as storeGet, set as storeSet } from '../store'
import { INFRA_ENV, PERMISSIONS_DEFAULTS_STRICT } from '../../shared/permissions-constants.js'

export { INFRA_ENV }
export const PERMISSIONS_KEY = 'permissions'

/** 首次启动写入最安全默认权限（含预置 FREERPA-DATA 目录）；幂等，返回是否本次写入 */
export const ensureDefaultPermissions = () => {
  if (!storeGet(PERMISSIONS_KEY)) {
    storeSet(PERMISSIONS_KEY, getDefaultPermissions())
    return true
  }
  return false
}

/** 默认放宽容许根：文档、下载等无风险用户公开目录（IO 读+写），保证文件类节点开箱即用；不含系统/隐藏目录 */
const DEFAULT_IO_NODES = ['documents', 'downloads']

/** deno 2.x sys 权限合法 kind 集合（buildDenoPermissions 预校验用；umask 为 node 兼容层写文件硬约束） */
const SYS_KINDS = new Set([
  'hostname', 'osRelease', 'osUptime', 'loadavg', 'networkInterfaces', 'systemMemoryInfo',
  'uid', 'gid', 'username', 'cpus', 'homedir', 'umask'
])

/** 生成最安全（非最小化）默认权限：预置 FREERPA-DATA 目录、基础设施 env/sys 默认开放（可取消）、远程导入默认打开、网络保持 allow-all、进程/FFI 默认禁 */
export const getDefaultPermissions = () => {
  const defaults = {
    ...PERMISSIONS_DEFAULTS_STRICT(),
    env: { allow: [...INFRA_ENV] },
    sys: { allow: ['umask'] },
    import: { enabled: true, hosts: [] }
  }
  // 默认放宽容许根：文档、下载等无风险公开目录
  const ioRoots = [
    ...DEFAULT_IO_NODES
      .map((node) => {
        try {
          const p = app.getPath(node)
          fs.mkdirSync(p, { recursive: true })
          return p
        } catch {
          return null
        }
      })
      .filter(Boolean)
  ]
  return {
    ...defaults,
    io: { roots: ioRoots }
  }
}

const DEFAULTS = PERMISSIONS_DEFAULTS_STRICT

const normalize = (p) => {
  const out = structuredClone(DEFAULTS())
  if (!p || typeof p !== 'object') return out
  out.io = { roots: Array.isArray(p.io?.roots) ? p.io.roots : [] }
  const mode = p.network?.mode
  out.network = {
    mode: ['allow-all', 'allow-list', 'disabled'].includes(mode) ? mode : DEFAULTS().network.mode,
    rules: Array.isArray(p.network?.rules) ? p.network.rules : []
  }
  out.process = { enabled: !!p.process?.enabled, commands: Array.isArray(p.process?.commands) ? p.process.commands : [] }
  out.env = { allow: Array.isArray(p.env?.allow) ? p.env.allow : [] }
  out.sys = { allow: Array.isArray(p.sys?.allow) ? p.sys.allow : [] }
  out.ffi = { enabled: !!p.ffi?.enabled, paths: Array.isArray(p.ffi?.paths) ? p.ffi.paths : [] }
  out.import = { enabled: !!p.import?.enabled, hosts: Array.isArray(p.import?.hosts) ? p.import.hosts : [] }
  return out
}

/** 读取全局权限；从未配置过时返回最安全默认（含预置 FREERPA-DATA 目录），并兼容旧安全目录 allowedRoot 迁移 */
export const getPermissions = () => {
  const stored = storeGet(PERMISSIONS_KEY)
  if (!stored) {
    const oldRoot = storeGet('allowedRoot')
    if (oldRoot) {
      const p = getDefaultPermissions()
      p.io.roots = [oldRoot]
      return p
    }
    return getDefaultPermissions()
  }
  return normalize(stored)
}

// node 兼容层（process.env）模块加载期必需的非敏感环境变量（用户配置 env 白名单时自动附加）
// 覆盖 exceljs→graceful-fs/readable-stream/bluebird 等依赖链加载期读取的变量（deno 对未授权 env 读取抛错而非返回 undefined）
// INFRA_ENV 定义见 src/shared/permissions-constants.js（两端共用）

/**
 * 生成 deno Worker 权限描述符（最小权限原则）
 * env/sys 完全由用户配置决定（默认值已含基础设施项，用户可自主取消；不再强制附加）
 * IO/网络/子进程默认最小。
 * @param {object} effective  getPermissions 的结果
 * @param {string[]} infraReadPaths 基础设施读路径（引擎/节点/node_modules，自动授予）
 */
export const buildDenoPermissions = (effective, infraReadPaths) => {
  const net = effective.network
  const run = effective.process
  const ffi = effective.ffi
  const imp = effective.import
  return {
    read: [...new Set([...infraReadPaths, ...effective.io.roots])],
    write: [...effective.io.roots],
    net: net.mode === 'allow-all' ? true : net.mode === 'disabled' ? [] : net.rules.filter(Boolean),
    run: run.enabled ? (run.commands.length ? run.commands : true) : [],
    ffi: ffi.enabled ? (ffi.paths.length ? ffi.paths : true) : [],
    import: imp.enabled ? (imp.hosts.length ? imp.hosts : true) : [],
    env: [...new Set([...(effective.env.allow || [])])],
    sys: [...new Set([...(effective.sys.allow || []).filter((k) => SYS_KINDS.has(k))])]
  }
}
