import fse from 'fs-extra'
import path from 'path'
import { get } from '../../../store'

class FreeRpaFs {
  constructor() {
    this.allowedRoot = () => path.resolve(get('allowedRoot'))
    return this._createProxy()
  }

  _createProxy() {
    return new Proxy(fse, {
      get: (target, prop) => {
        if ('allowedRoot' === prop) {
          return path.resolve(get('allowedRoot'))
        }
        // 检查属性是否为方法
        if (typeof target[prop] !== 'function') {
          return target[prop]
        }
        // 包装方法，保持同步/异步特性
        return (...args) => {
          const hasDestPath = ['copy', 'copySync', 'move', 'moveSync', 'copyFile', 'copyFileSync', 'createSymlink', 'createSymlinkSync', 'ensureLink', 'ensureLinkSync','ensureSymlink','ensureSymlinkSync'].includes(prop)
          if (typeof args[0] === 'string') {
            args[0] = this._getSafePath(args[0])
          }
          if (typeof args[1] === 'string' && hasDestPath) {
            args[1] = this._getSafePath(args[1])
          }
          return target[prop](...args)
        }
      }
    })
  }
  // 获取安全路径
  _getSafePath(src) {
    // 去除盘符
    const normalizedPath = src.replace(/^[a-zA-Z]:/, '')
    const absolutePath = path.resolve(path.join(this.allowedRoot(), normalizedPath))
    return absolutePath
  }
}

export default FreeRpaFs
