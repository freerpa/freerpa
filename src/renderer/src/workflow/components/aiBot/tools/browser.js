/**
 * @file: 浏览器相关 AI 工具（浏览器内核运行时 env 模块）
 * 执行器直接调用 preload 已暴露的 window.electronAPI.env.*（即主进程 env:* IPC）
 */
const env = () => window.electronAPI.env

// 工具结果注入 LLM 上下文的大小上限（head/tail 截断，见 guard.js）
import { limitText } from './guard.js'

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
        '创建浏览器环境（「浏览器管理」中的浏览器实例，搭建工作流需要浏览器时先创建再 openBrowser）。kernel_id 为浏览器内核大版本号（如 "130"，可选，用 getMajorVersionList 查询本机可用大版本；不填则默认）。',
      strict: true,
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: '浏览器环境名称' },
          description: { type: 'string', description: '描述', default: '' },
          category_id: { type: 'string', description: '所属分类ID（可选，默认不分类）', default: '' },
          kernel_id: { type: 'string', description: '内核大版本号（如 "130"，用 getMajorVersionList 查询），可选' },
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
      description:
        '打开一个浏览器环境（复用已存在环境或创建新会话）。kernel 为内核信息且必填：platform 为当前系统平台（windows/macos/linux，用 getKernelList 查询已安装内核的 platform/version 后原样传入），不传 kernel 会报「浏览器配置未设置内核版本」。',
      strict: true,
      parameters: {
        type: 'object',
        properties: {
          envId: { type: 'string', description: '浏览器环境ID（复用已有环境会话目录）' },
          kernel: {
            type: 'object',
            description: '浏览器内核信息（必填；platform 为 windows/macos/linux，version 为完整版本号，如 130.0.6723.118，先用 getKernelList 查询）',
            properties: {
              platform: { type: 'string', description: '系统平台：windows/macos/linux' },
              version: { type: 'string', description: '内核完整版本号' }
            }
          },
          proxy: { type: 'string', description: '代理地址，可选' },
          fingerprint: {
            type: 'object',
            description: '浏览器指纹配置',
            properties: { seed: { type: 'string' } }
          }
        },
        required: ['envId', 'kernel'],
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
  },
  {
    type: 'function',
    function: {
      name: 'getKernelList',
      description: '获取已安装的浏览器内核列表（platform 为 windows/macos/linux，version 为完整版本号）。',
      strict: true,
      parameters: { type: 'object', properties: {}, additionalProperties: false }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getMajorVersionList',
      description: '获取本机可用的浏览器内核大版本列表（如 ["130","131"]），创建浏览器环境填 kernel_id 时用。',
      strict: true,
      parameters: { type: 'object', properties: {}, additionalProperties: false }
    }
  },
  {
    type: 'function',
    function: {
      name: 'checkKernel',
      description: '检查指定浏览器内核是否已安装。',
      strict: true,
      parameters: {
        type: 'object',
        properties: {
          platform: { type: 'string', description: '系统平台：windows/macos/linux（与内核下载平台一致）' },
          version: { type: 'string', description: '内核大版本号，如 130' }
        },
        required: ['platform', 'version'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'downloadKernel',
      description: '下载指定浏览器内核（下载进度会通知到界面）。',
      strict: true,
      parameters: {
        type: 'object',
        properties: {
          platform: { type: 'string', description: '系统平台：windows/macos/linux（与内核下载平台一致）' },
          version: { type: 'string', description: '内核大版本号，如 130' }
        },
        required: ['platform', 'version'],
        additionalProperties: false
      }
    }
  }
]

export const createBrowserExecutors = () => ({
  createBrowser: async ({ name, description = '', kernel_id = '', category_id = '', proxy_url = '' } = {}) => {
    if (!name) throw new Error('name 必填')
    const browserLocal = window.electronAPI.browserLocal
    return toText(await browserLocal.createBrowser({ name, description, kernel_id, category_id, proxy_url }))
  },
  openBrowser: async (args) => toText(await env().openBrowser(args || {})),
  closeBrowser: async ({ envId } = {}) => {
    if (!envId) throw new Error('envId is required')
    return toText(await env().closeBrowser({ envId }))
  },
  getAllBrowserStatus: async () => toText(await env().getAllBrowserStatus()),
  getKernelList: async () => toText(await env().getKernelList()),
  getMajorVersionList: async () => toText(await env().getMajorVersionList()),
  checkKernel: async ({ platform, version } = {}) => {
    if (!platform || !version) throw new Error('platform 与 version 必填')
    return toText(await env().checkKernel({ platform, version }))
  },
  downloadKernel: async ({ platform, version } = {}) => {
    if (!platform || !version) throw new Error('platform 与 version 必填')
    return toText(await env().downloadKernel({ platform, version }))
  }
})
