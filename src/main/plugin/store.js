/**
 * @file: 插件存储（安装布局 + 开发版挂载记录）
 *
 * 新安装式插件体系（推翻旧目录发现机制）：
 *   - 正式版：统一安装到 {userData}/plugin/{pluginId}@{version}/  （解压 .frp 得到 package.json + 编译产物）
 *   - 开发版：外部目录挂载（不复制进 plugin 根目录），仅持久化挂载记录，识别码 {pluginId}@dev
 *   - 唯一识别码：{pluginId}@{version} / {pluginId}@dev
 */
import path from 'path'
import { app } from 'electron'
import { get, set } from '../store/index.js'

/** 开发版挂载记录持久化 key（存 settings 表） */
const DEV_STORE_KEY = 'devPlugins'

/** 插件根目录（所有正式版插件统一安装于此） */
export const getPluginRoot = () => path.join(app.getPath('userData'), 'plugin')

/** 正式版插件目录名：{pluginId}@{version} */
export const pluginDirName = (pluginId, version) => `${pluginId}@${version}`

/** 开发版挂载记录列表 [{ pluginId, path, importedAt }] */
export const getDevPlugins = () => get(DEV_STORE_KEY) || []

/** 添加/覆盖开发版挂载记录（按 pluginId 幂等） */
export const addDevPlugin = (record) => {
  const list = getDevPlugins().filter((r) => r.pluginId !== record.pluginId)
  list.push(record)
  set(DEV_STORE_KEY, list)
  return list
}

/** 移除开发版挂载记录（卸载开发版插件 = 删除记录） */
export const removeDevPlugin = (pluginId) => {
  const list = getDevPlugins().filter((r) => r.pluginId !== pluginId)
  set(DEV_STORE_KEY, list)
  return list
}
