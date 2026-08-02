/**
 * @file: FreeRpaFs — 文件系统访问层（worker 版）
 * 相对路径重定向到权限主目录（roots[0]），绝对路径保持原样；
 * 越权写由 deno 权限模型兜底拦截（write 权限仅含配置 roots）。
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
  constructor(roots = []) {
    const root = path.resolve(roots[0] || '')
    this.root = root
    return this._createProxy(root)
  }

  _createProxy(root) {
    return new Proxy(fse, {
      get: (target, prop) => {
        if (prop === 'allowedRoot') {
          return root
        }
        if (typeof target[prop] !== 'function') {
          return target[prop]
        }
        // 包装方法：首个路径参数重定向（拷贝/移动类方法处理第二个参数）
        return (...args) => {
          const hasDestPath = [
            'copy', 'copySync', 'move', 'moveSync', 'copyFile', 'copyFileSync',
            'createSymlink', 'createSymlinkSync', 'ensureLink', 'ensureLinkSync',
            'ensureSymlink', 'ensureSymlinkSync'
          ].includes(prop)
          if (typeof args[0] === 'string') {
            args[0] = this._getSafePath(root, args[0])
          }
          if (typeof args[1] === 'string' && hasDestPath) {
            args[1] = this._getSafePath(root, args[1])
          }
          return target[prop](...args)
        }
      }
    })
  }

  // 相对路径 → 主目录内绝对路径；绝对路径原样返回
  _getSafePath(root, src) {
    const normalizedPath = src.replace(/^[a-zA-Z]:/, '')
    return path.isAbsolute(normalizedPath) ? path.normalize(normalizedPath) : path.resolve(root, normalizedPath)
  }
}

export default FreeRpaFs
