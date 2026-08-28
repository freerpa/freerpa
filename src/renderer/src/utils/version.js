/**
 * @file: 版本管理工具类 (离线版本)
 * @author: FreeRPA
 * @date: 2024-03-16
 */

import pkg from '../../../../package.json'

// 获取当前版本
export const getAppVersion = () => {
  return pkg.version
}

// 版本比较（唯一实现位于 src/shared/semver.js，两端共用）
export { compareSemver as compareVersion } from '../../../shared/semver.js'
