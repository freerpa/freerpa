/**
 * @file: 权限常量（主进程与渲染端共用，消除双份漂移）
 * - INFRA_ENV：基础设施环境变量白名单（node 兼容层模块加载期必需；UI 展示为禁删项）
 * - PERMISSIONS_DEFAULTS：权限数据模型默认值（渲染端 DEFAULTS() 与主进程 DEFAULTS 共用）
 */

/** 基础设施环境变量白名单（node 兼容层模块加载期必需） */
export const INFRA_ENV = [
  'GRACEFUL_FS_PLATFORM', 'TEST_GRACEFUL_FS_GLOBAL_PATCH', 'READABLE_STREAM',
  'BLUEBIRD_DEBUG', 'BLUEBIRD_LONG_STACK_TRACES', 'BLUEBIRD_WARNINGS', 'BLUEBIRD_W_FORGOTTEN_RETURN',
  'WS_NO_BUFFER_UTIL', 'WS_NO_UTF_8_VALIDATE',
  'NODE_ENV', 'NODE_DEBUG', 'HOME', 'USERPROFILE', 'TMPDIR', 'TEMP', 'TMP', 'PATH', 'LANG'
]

/** 权限数据模型默认值（结构化副本：调用方按需展开，避免共享同一可变对象） */
export const PERMISSIONS_DEFAULTS = () => ({
  io: { roots: [] },
  network: { mode: 'allow-all', rules: [] },
  process: { enabled: false, commands: [] },
  env: { allow: [...INFRA_ENV] },
  sys: { allow: ['umask'] },
  ffi: { enabled: false, paths: [] },
  import: { enabled: true, hosts: [] }
})

/** 无基础设施默认项的保守默认值（主进程 normalize 用；import 默认关闭） */
export const PERMISSIONS_DEFAULTS_STRICT = () => ({
  io: { roots: [] },
  network: { mode: 'allow-all', rules: [] },
  process: { enabled: false, commands: [] },
  env: { allow: [] },
  sys: { allow: [] },
  ffi: { enabled: false, paths: [] },
  import: { enabled: false, hosts: [] }
})
