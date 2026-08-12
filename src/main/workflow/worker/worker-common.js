/**
 * @file: 节点公共工具（worker 版）— 对应主进程 '@/common' 与 '@pageEval'
 * openBrowser：内核由主进程启动（RPC），puppeteer 连接与页面操作在 worker 本地。
 */
import path from 'node:path'
import puppeteer, { Page } from 'puppeteer-core'
import { bridge } from './bridge.js'
import { mountFinder } from './selector.js'

// 挂载 page.find 到 Page.prototype（Page 为 ESM 命名导出）
mountFinder(Page)

export { puppeteer }
export * from 'puppeteer-core'

// ═══════════ 参数处理 ═══════════
export const processParams = (params, data) => {
  const result = {}
  if (params?.length) {
    params.forEach((param) => {
      let type = param.type
      if (Array.isArray(param.type)) {
        type = param.type[0]
      }
      // ?? 而非 ||：上游传 0/false/'' 时不再被默认值覆盖（null/undefined 才取默认）
      let value = data[param.name] ?? param[type + 'Value']

      // 数组/对象/任意类型：字符串值解析为对应类型
      // deno worker 内直接执行（沙箱由 deno 权限模型保证），无需 runCode 包装
      if (
        ['array', 'object', 'any'].includes(type) &&
        !Object.prototype.hasOwnProperty.call(data, param.name) &&
        typeof value === 'string'
      ) {
        try {
          value = new Function(`return (${value})`)()
        } catch {
          throw new Error(`参数 ${param.name} 格式错误`)
        }
      }
      // 基础类型转换
      if (['string', 'number', 'boolean'].includes(type)) {
        switch (type) {
          case 'string':
            value = String(value)
            break
          case 'number':
            value = Number(value)
            break
          case 'boolean':
            value = Boolean(value)
            break
        }
      }
      result[param.name] = value
      if (param.required && (value === null || value === undefined || value === '')) {
        throw new Error(`参数 ${param.name} 不能为空`)
      }
    })
  }
  return result
}

// ═══════════ 文件安全写入 ═══════════
export const safeWriteFileSync = (fs, filePath, data) => {
  try {
    const dirPath = path.dirname(filePath)
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true })
      console.error(`目录已创建: ${dirPath}`) // stderr：避免污染 stdout JSON 行协议
    }
    fs.writeFileSync(filePath, data)
    console.error(`文件已成功写入: ${filePath}`)
  } catch (err) {
    console.error('写入文件时发生错误:', err.message)
  }
}

// 同步获取路径对应目录（文件返回父目录，目录返回自身）
export const getCorrectDirectorySync = (fs, targetPath) => {
  try {
    const stats = fs.statSync(targetPath)
    return stats.isDirectory() ? targetPath : path.dirname(targetPath)
  } catch {
    return targetPath
  }
}

// ═══════════ 数据处理 handler ═══════════
// executeDataHandler 与 getHandler 已随 dataHandler 单类型收敛内联进各节点 V1/execute.js（不再依赖全局 dataHandlers 目录）
export { getHttpServer } from './core/http-server.js'

/**
 * fileCopy / fileMove 公共执行器（operation: 'copy' | 'move'）
 * overwrite 语义统一：目标已存在且未开启覆盖时显式报错（此前 fileCopy 的 overwrite 因 afs copy 忽略参数而失效）
 */
const executeFileTransfer = async (node, context, operation) => {
  const { config } = node
  const { complete, fs } = context
  const typeKey = operation === 'copy' ? 'copyType' : 'moveType'
  const { [typeKey]: transferType, sourcePath, sourceDirPath, targetPath, overwrite } = config

  // 获取实际的源路径
  const realSourcePath = transferType === 'file' ? sourcePath : sourceDirPath
  // 检查源路径是否存在
  if (!fs.existsSync(realSourcePath)) {
    throw new Error(`源路径不存在: ${realSourcePath}`)
  }
  // 获取目标路径
  let realTargetPath = path.join(targetPath, path.basename(realSourcePath))
  // 创建目标目录（如果需要）
  const sourceStats = fs.statSync(realSourcePath)
  const isDirectory = sourceStats.isDirectory()
  const targetDir = isDirectory ? realTargetPath : path.dirname(realTargetPath)
  if (!fs.existsSync(targetDir)) {
    await fs.mkdir(targetDir, { recursive: true })
  }
  // 目标已存在且不允许覆盖 → 显式报错
  if (fs.existsSync(realTargetPath) && !overwrite) {
    throw new Error(`目标已存在且未开启覆盖: ${realTargetPath}`)
  }
  // 复制 / 移动
  if (operation === 'copy') {
    await fs.copy(realSourcePath, realTargetPath)
  } else {
    await fs.move(realSourcePath, realTargetPath)
  }
  // 返回结果
  complete({
    targetPath: realTargetPath
  })
}

export const executeFileCopy = (node, context) => executeFileTransfer(node, context, 'copy')
export const executeFileMove = (node, context) => executeFileTransfer(node, context, 'move')

// ═══════════ 页面代码执行 ═══════════
export const page_eval = async (page, code, ...args) => {
  return await page.evaluate(eval(code), ...args)
}

// ═══════════ 打开浏览器（worker 版） ═══════════
/**
 * 主进程启动/复用内核并返回 wsEndpoint，worker 内 puppeteer.connect + 独立 BrowserContext
 * 并发防重：同一工作流内同一时刻的重复调用共享同一内核与 page（防引擎重复调度竞态）；
 * 串行多次调用（如多个浏览器节点）仍各自打开新浏览器
 */
let pendingOpen = null

export const openBrowser = async (env = null, options = {}) => {
  if (pendingOpen) return await pendingOpen
  pendingOpen = doOpen(env, options).finally(() => { pendingOpen = null })
  return await pendingOpen
}

async function doOpen(env, options) {
  const { headless = false, proxy: optionProxy = '', extraArgs = [] } = options
  const instance = await bridge.rpc('browser.open', {
    env,
    options: { headless, proxy: optionProxy, extraArgs }
  })
  let browser = null
  try {
    browser = await puppeteer.connect({
      browserWSEndpoint: instance.wsEndpoint,
      defaultViewport: null
    })
    let page
    let closePage
    if (instance.reuse) {
      // 复用已打开的内核：新建独立 BrowserContext（不影响原浏览器页面）
      const context = await browser.createBrowserContext()
      page = await context.newPage()
      closePage = async () => { try { await context.close() } catch { /* 已关闭 */ } }
    } else {
      // 新启动的内核自带默认页面：复用首个页面并关闭多余页面（避免打开两个浏览器）
      const pages = await browser.pages()
      for (let i = 1; i < pages.length; i++) { try { await pages[i].close() } catch { /* 已关闭 */ } }
      page = pages[0] || await browser.newPage()
      closePage = async () => { try { await page.close() } catch { /* 已关闭 */ } }
    }
    return {
      page,
      close: async () => {
        await closePage()
        try { browser.disconnect() } catch { /* 已断开 */ }
        await bridge.rpc('browser.release', { envId: env?.id })
      }
    }
  } catch (e) {
    // 连接失败：回滚主进程内核引用（防内核残留导致重复启动）
    try { browser?.disconnect() } catch { /* 已断开 */ }
    await bridge.rpc('browser.release', { envId: env?.id }).catch(() => {})
    throw e
  }
}
