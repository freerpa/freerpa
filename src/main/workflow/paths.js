/**
 * @file: 工作流引擎资源路径解析（单点定义）
 *
 * 主进程侧 dev/prod 资源路径的唯一来源：
 *  - dev：指向源码目录（electron-vite 开发运行）
 *  - prod：指向打包产物 resources/worker（与 scripts/build-worker.mjs 的产出布局一致）
 *
 * 布局约定（与 scripts/build-worker.mjs 保持同步）：
 *  - workerRoot        → worker 源码（host.js / engine.js / core/）
 *  - nodesRoot         → 节点执行器目录（{type}/{version}/execute.js，含节点自包含相对依赖）
 *  - nodeModulesRoot   → 节点裸依赖的 node_modules（deno --node-modules-dir）
 */
import path from 'node:path'
import fs from 'node:fs'
import { app } from 'electron'

/** 解析 dev/prod 工作流引擎资源路径 */
export function resolveWorkflowPaths() {
  const platform = `${process.platform}-${process.arch}`
  const binName = process.platform === 'win32' ? 'deno.exe' : 'deno'
  const appPath = app.getAppPath()

  if (!app.isPackaged) {
    return {
      denoBin: fs.existsSync(path.join(appPath, 'resources', 'deno', platform, binName))
        ? path.join(appPath, 'resources', 'deno', platform, binName)
        : 'deno', // dev 回退系统 deno
      workerRoot: path.join(appPath, 'src', 'main', 'workflow', 'worker'),
      nodesRoot: path.join(appPath, 'src', 'renderer', 'src', 'workflow', 'nodes'),
      nodeModulesRoot: path.join(appPath, 'node_modules')
    }
  }
  const res = process.resourcesPath
  return {
    denoBin: path.join(res, 'deno', platform, binName),
    workerRoot: path.join(res, 'worker'),
    nodesRoot: path.join(res, 'worker', 'nodes'),
    nodeModulesRoot: path.join(res, 'worker', 'node_modules')
  }
}
