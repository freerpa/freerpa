/**
 * @file: 浏览器相关 AI 工具（浏览器内核运行时 env 模块）
 * 执行器直接调用 preload 已暴露的 window.electronAPI.env.*（即主进程 env:* IPC）
 */
const env = () => window.electronAPI.env

// 工具结果注入 LLM 上下文的大小上限（head/tail 截断，见 guard.js）
import { limitText, assertArgs } from './guard.js'

// 工具结果转文本：兼容两种返回形态——
// 1) env:* 统一 {code:200,data} / {code:400,message} 包装；
// 2) browserLocal:createBrowser 返回裸 id 字符串、getMajorVersionList 返回裸 JSON（handleCrud 不包装，原逻辑会把成功结果误判为 error）
const toText = (res) => {
  if (res && typeof res === 'object' && 'code' in res) {
    return limitText(res.code === 200 ? (res.data ?? res.message ?? res) : `error: ${res.message || JSON.stringify(res)}`)
  }
  if (typeof res === 'string') {
    return limitText(res)
  }
  return limitText(res == null ? '' : JSON.stringify(res))
}

export const createBrowserTools = () => [
  {
    type: 'function',
    function: {
      name: 'createBrowser',
      description:
        '创建浏览器环境（浏览器管理中的实例，搭建工作流需要浏览器时先创建再 openBrowser）。浏览器内核已随客户端内置分发，无需指定内核版本。',
      strict: true,
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: '浏览器环境名称' },
          description: { type: 'string', description: '描述', default: '' },
          category_id: { type: 'string', description: '所属分类ID（可选，默认不分类）', default: '' },
          proxy_url: { type: 'string', description: '代理地址，可选' }
        },
        required: ['name'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'openBrowser',
      description: '打开一个浏览器环境（复用已存在环境或创建新会话）。',
      strict: true,
      parameters: {
        type: 'object',
        properties: {
          envId: { type: 'string', description: '浏览器环境ID（复用已有环境会话目录）' },
          proxy: { type: 'string', description: '代理地址，可选' },
          fingerprint: {
            type: 'object',
            description: '浏览器指纹配置',
            properties: { seed: { type: 'string' } }
          }
        },
        required: ['envId'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'closeBrowser',
      description: '关闭一个浏览器环境（引用计数归零后释放进程）。',
      strict: true,
      parameters: {
        type: 'object',
        properties: { envId: { type: 'string', description: '浏览器环境ID' } },
        required: ['envId'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getAllBrowserStatus',
      description: '查询所有浏览器环境的运行状态（哪些已打开）。',
      strict: true,
      parameters: { type: 'object', properties: {}, additionalProperties: false }
    }
  }
]

export const createBrowserExecutors = () => ({
  createBrowser: async (args) => {
    const { name, description = '', category_id = '', proxy_url = '' } = args || {}
    assertArgs(args, ['name'])
    const browserLocal = window.electronAPI.browserLocal
    return toText(await browserLocal.createBrowser({ name, description, category_id, proxy_url }))
  },
  openBrowser: async (args) => toText(await env().openBrowser(args || {})),
  closeBrowser: async (args) => {
    assertArgs(args, ['envId'])
    return toText(await env().closeBrowser({ envId: args.envId }))
  },
  getAllBrowserStatus: async () => toText(await env().getAllBrowserStatus())
})
