/**
 * @file: FreeRpaFs — 文件系统访问层（worker 版）
 * 节点传参均为绝对路径，仅做路径归一化；
 * 越权读写由 deno 权限模型兜底拦截（权限仅含配置 roots）。
 * 基于 node:fs（不引入 fs-extra/graceful-fs），补充节点用到的扩展方法。
 */
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'

// fs-extra 兼容扩展（节点仅使用 copy/move/remove）
const extensions = {
  copy: (src, dest) => fsp.cp(src, dest, { recursive: true }),
  copySync: (src, dest) => fs.cpSync(src, dest, { recursive: true }),
  move: (src, dest) =>
    fsp.rename(src, dest).catch(async () => {
      await fsp.cp(src, dest, { recursive: true })
      await fsp.rm(src, { recursive: true, force: true })
    }),
  moveSync: (src, dest) => {
    try {
      fs.renameSync(src, dest)
    } catch {
      fs.cpSync(src, dest, { recursive: true })
      fs.rmSync(src, { recursive: true, force: true })
    }
  },
  remove: (p) => fsp.rm(p, { recursive: true, force: true }),
  removeSync: (p) => fs.rmSync(p, { recursive: true, force: true })
}

const fse = Object.assign({}, fs, extensions)

class FreeRpaFs {
  constructor() {
    return this._createProxy()
  }

  _createProxy() {
    return new Proxy(fse, {
      get: (target, prop) => {
        if (typeof target[prop] !== 'function') {
          return target[prop]
        }
        // 包装方法：路径参数统一归一化（拷贝/移动类方法处理第二个参数）
        return (...args) => {
          const hasDestPath = [
            'copy', 'copySync', 'move', 'moveSync', 'copyFile', 'copyFileSync',
            'createSymlink', 'createSymlinkSync', 'ensureLink', 'ensureLinkSync',
            'ensureSymlink', 'ensureSymlinkSync'
          ].includes(prop)
          if (typeof args[0] === 'string') {
            args[0] = path.normalize(args[0])
          }
          if (typeof args[1] === 'string' && hasDestPath) {
            args[1] = path.normalize(args[1])
          }
          return target[prop](...args)
        }
      }
    })
  }
}

export default FreeRpaFs
