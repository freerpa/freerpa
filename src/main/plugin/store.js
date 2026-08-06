/**
 * @file: 插件目录存储（user-preferences.pluginDirs）
 * 仅负责目录列表的读写，描述解析见 manifest.js
 */
import { get, set } from '../store/index.js'

const STORE_KEY = 'pluginDirs'

/** 已配置的插件根目录列表 */
export const getPluginDirs = () => get(STORE_KEY) || []

/** 添加插件根目录（去重） */
export const addPluginDir = (dir) => {
  const dirs = getPluginDirs()
  if (!dirs.includes(dir)) {
    dirs.push(dir)
    set(STORE_KEY, dirs)
  }
  return dirs
}

/** 移除插件根目录 */
export const removePluginDir = (dir) => {
  const dirs = getPluginDirs().filter((d) => d !== dir)
  set(STORE_KEY, dirs)
  return dirs
}
