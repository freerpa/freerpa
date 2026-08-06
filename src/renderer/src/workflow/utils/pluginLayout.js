/**
 * @file: 插件目录布局纯函数（V{n} 整数版本选择）— 主进程 manifest 与 worker 执行器共用唯一实现
 *
 * 目录约定（与内置节点 nodes/{type}/V{num}/ 完全一致）：
 *   {pluginRoot}/{pluginId}/V{n}/index.js + execute.js
 *
 * 共享方式（paramRefer 同款模式）：
 *  - 主进程：src/main/plugin/manifest.js 相对 import 本文件（electron-vite main bundle 内联）
 *  - worker：经 import-map 键 @renderer/workflow/utils/pluginLayout.js（dev 映射渲染端源码；
 *    prod 由 scripts/build-worker.mjs 复制为 resources/worker/plugin-layout.js 并改写映射）
 *
 * 严格 V{n} 布局：不兼容老平铺布局（{pluginId}/index.js）与纯整数目录（{pluginId}/2/）。
 */
import fs from 'node:fs'
import path from 'node:path'

const VERSION_DIR_RE = /^V(\d+)$/

/** 列出插件目录下的全部版本子目录，按版本号升序返回 [{ versionDir, verNum, dir }] */
export function listVersionDirs(pluginDir) {
  if (!fs.existsSync(pluginDir)) return []
  const versions = []
  for (const entry of fs.readdirSync(pluginDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const m = VERSION_DIR_RE.exec(entry.name)
    if (!m) continue
    versions.push({
      versionDir: entry.name,
      verNum: parseInt(m[1], 10),
      dir: path.join(pluginDir, entry.name)
    })
  }
  return versions.sort((a, b) => a.verNum - b.verNum)
}

/** 取最高版本子目录；无版本子目录返回 null */
export function getLatestVersionDir(pluginDir) {
  const versions = listVersionDirs(pluginDir)
  return versions.length ? versions[versions.length - 1] : null
}

/**
 * 在单个插件根目录下定位插件 execute.js（严格 V{n} 布局）：
 *  - version 指定（如 'V2' 或 2）：精确匹配该版本目录（目标版本缺失回退最高版本）
 *  - version 未指定：直接取最高版本
 * 未找到返回 null。
 */
export function resolvePluginExecute(pluginRoot, pluginId, version) {
  const pluginDir = path.join(pluginRoot, pluginId)
  const versions = listVersionDirs(pluginDir)
  if (versions.length === 0) return null
  const hasExecute = (v) => fs.existsSync(path.join(v.dir, 'execute.js'))
  let target = null
  if (version != null && version !== '') {
    const m = /^V?(\d+)$/i.exec(String(version))
    if (m) {
      const verNum = parseInt(m[1], 10)
      target = versions.find((v) => v.verNum === verNum) || null
    }
  }
  if (target && hasExecute(target)) return path.join(target.dir, 'execute.js')
  for (let i = versions.length - 1; i >= 0; i--) {
    if (hasExecute(versions[i])) return path.join(versions[i].dir, 'execute.js')
  }
  return null
}
