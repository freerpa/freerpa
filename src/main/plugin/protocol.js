/**
 * @file: plugin:// 自定义协议（渲染端加载插件入口模块图）
 *
 * 背景：插件描述已并入入口文件（config/inputs/outputs/execute），入口可能拆分多文件（相对导入）。
 * 渲染进程无法直接读本地文件；把入口源码当 data-URL 求值时，相对导入无法解析（模块图断裂）。
 * 通过 plugin:// 协议把插件目录内文件以正确 MIME 提供给渲染进程，入口模块图可被原生 import()
 * 解析，含 onChange/remoteMethod 等函数钩子原样保留。
 *
 * URL 格式: plugin://local/<encodeURIComponent(identifier)>/<相对路径>
 *   - identifier: 插件标识（pluginId@dev / pluginId@version）
 *   - 相对路径缺省 → 入口 main 文件；目录 → 该目录下 index.js
 *
 * 安全：仅允许读取 identifier 对应插件目录内的文件（相对路径穿越防护）。
 * 信任边界：插件为用户显式安装，其代码本就以渲染进程权限运行（见 index.js 注册注释）。
 */
import { protocol, session } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import mime from 'mime-types'
import { findPluginByIdentifier, findPlugin } from './manifest.js'

export const PLUGIN_SCHEME = 'plugin'

/** 自定义协议需在 app ready 前注册特权（standard+secure 才支持模块相对导入） */
export const registerPluginScheme = () => {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: PLUGIN_SCHEME,
      privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true }
    }
  ])
}

/** 解析 identifier → 插件目录（开发版/正式版统一经 manifest 定位） */
const resolvePluginDir = async (identifier) => {
  if (!identifier) return null
  try {
    const found = (await findPluginByIdentifier(identifier)) || (await findPlugin(identifier))
    return found?.dir || null
  } catch {
    return null
  }
}

/** 目标文件是否位于 base 目录内（防路径穿越） */
const isInside = (base, target) => {
  const rel = path.relative(base, target)
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel)
}

const JS_EXT = /\.(js|mjs|jsx)$/

/**
 * 为 ESM 相对导入/导出追加目标文件 mtime 查询串（如 './config.js' → './config.js?t=1728...'）。
 * 渲染进程单一 realm 的模块表按 URL 缓存模块：不改子文件 URL，改动子文件后刷新会命中旧模块。
 * 目标文件 mtime 变化 ⇒ 引用它的 URL 变化 ⇒ 模块表重新拉取（与 Vite 的 ?t= 缓存破坏同思路）。
 */
const rewriteRelativeSpecifiers = (code, dir) => {
  return code.replace(
    /((?:import|export)\s+(?:[^'"\n]*?\s+from\s*)?|import\s*\()\s*['"](\.{1,2}\/[^'"\n]+)['"]/g,
    (match, pre, spec) => {
      let mtime = ''
      try {
        mtime = String(fs.statSync(path.resolve(dir, spec)).mtimeMs)
      } catch {
        return match // 目标不存在：原样保留，由模块加载报错提示
      }
      return `${pre}'${spec}?t=${mtime}'`
    }
  )
}

const serve = async (request) => {
  try {
    const url = new URL(request.url)
    const segs = url.pathname.split('/').filter(Boolean)
    const [encId, ...rest] = segs
    const identifier = decodeURIComponent(encId || '')
    const dir = await resolvePluginDir(identifier)
    if (!dir || !fs.existsSync(dir)) {
      return new Response(`plugin not found: ${identifier}`, { status: 404 })
    }
    // 相对路径缺省时返回入口 main 文件
    let rel = rest.join('/')
    let file
    if (rel) {
      file = path.resolve(dir, rel)
      if (!isInside(dir, file)) return new Response('forbidden', { status: 403 })
      if (!fs.existsSync(file)) return new Response('not found', { status: 404 })
      if (fs.statSync(file).isDirectory()) {
        file = path.join(file, 'index.js')
        if (!fs.existsSync(file)) return new Response('not found', { status: 404 })
      }
    } else {
      // 空路径：读取入口 main（找不到 main 时回退 index.js）
      const pkgPath = path.join(dir, 'package.json')
      let main = './src/index.js'
      if (fs.existsSync(pkgPath)) {
        try {
          main = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')).main || main
        } catch { /* 解析失败用默认入口 */ }
      }
      file = path.resolve(dir, main)
      if (!isInside(dir, file) || !fs.existsSync(file)) {
        return new Response('not found', { status: 404 })
      }
    }
    let body = fs.readFileSync(file)
    // JS 模块：重写相对导入追加 mtime 查询串（开发期改子文件刷新即时生效）
    if (JS_EXT.test(file)) {
      body = Buffer.from(rewriteRelativeSpecifiers(body.toString('utf-8'), dir), 'utf-8')
    }
    const contentType = mime.lookup(file) || 'text/javascript'
    return new Response(body, {
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store'
      }
    })
  } catch (e) {
    return new Response(`plugin protocol error: ${e.message}`, { status: 500 })
  }
}

/** 在 app ready 后注册协议处理（默认会话 + 开发用 persist:dev 会话） */
export const registerPluginProtocol = () => {
  protocol.handle(PLUGIN_SCHEME, serve)
  try {
    session.fromPartition('persist:dev').protocol.handle(PLUGIN_SCHEME, serve)
  } catch {
    // 分区会话不可用时忽略
  }
}
