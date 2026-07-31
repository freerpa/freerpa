/**
 * @file: 节点版本工具
 * @description: 扫描节点目录下的版本子目录（V1、V2...），获取最新版本
 * @author: dabao
 * @date: 2025-07-29
 */

import fs from 'fs'
import path from 'path'

/**
 * 扫描节点目录下的所有版本子目录
 * @param {string} nodeDirAbsPath - 节点目录的绝对路径（如 /path/to/nodes/browserOpen）
 * @returns {string[]} 版本号数组，按整数升序排列（如 ['V1', 'V2', 'V3']）
 */
export function scanVersions(nodeDirAbsPath) {
  if (!fs.existsSync(nodeDirAbsPath)) {
    return []
  }
  const entries = fs.readdirSync(nodeDirAbsPath, { withFileTypes: true })
  const versions = entries
    .filter((dirent) => dirent.isDirectory() && /^V\d+$/.test(dirent.name))
    .map((dirent) => dirent.name)
    .sort((a, b) => {
      const numA = parseInt(a.slice(1), 10)
      const numB = parseInt(b.slice(1), 10)
      return numA - numB
    })
  return versions
}

/**
 * 获取节点目录下的最新版本号
 * @param {string} nodeDirAbsPath - 节点目录的绝对路径
 * @returns {string|null} 最新版本号（如 'V2'），没有版本目录时返回 null
 */
export function getLatestVersion(nodeDirAbsPath) {
  const versions = scanVersions(nodeDirAbsPath)
  if (versions.length === 0) {
    return null
  }
  return versions[versions.length - 1]
}

/**
 * 构建带版本号的节点相对路径片段
 * @param {string} nodeType - 节点类型（如 'browserOpen'）
 * @param {string} [version] - 版本号（如 'V1'），缺省时自动取最新版本
 * @param {string} nodesBasePath - nodes 目录的绝对路径
 * @returns {{ relativePath: string, version: string }} 相对路径片段和实际版本号
 *
 * @example
 * buildVersionedPath('browserOpen', 'V2', '/path/to/nodes')
 * // => { relativePath: 'browserOpen/V2', version: 'V2' }
 *
 * buildVersionedPath('browserOpen', undefined, '/path/to/nodes')
 * // => { relativePath: 'browserOpen/V2', version: 'V2' }  假设 V2 是最新
 */
export function buildVersionedPath(nodeType, version, nodesBasePath) {
  const nodeDir = path.join(nodesBasePath, nodeType)
  const resolvedVersion = version || getLatestVersion(nodeDir) || 'V1'
  return {
    relativePath: `${nodeType}/${resolvedVersion}`,
    version: resolvedVersion
  }
}

/**
 * 获取节点定义时需要附加的版本元数据
 * @param {string} nodeType - 节点类型
 * @param {string} nodesBasePath - nodes 目录的绝对路径
 * @returns {{ _version: string, _versions: string[] }}
 */
export function getNodeVersionMeta(nodeType, nodesBasePath) {
  const nodeDir = path.join(nodesBasePath, nodeType)
  const versions = scanVersions(nodeDir)
  return {
    _version: versions.length > 0 ? versions[versions.length - 1] : 'V1',
    _versions: versions
  }
}
