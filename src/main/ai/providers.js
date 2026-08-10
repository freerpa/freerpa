/**
 * @file: AI 供应商管理（预设模板 + CRUD，store 持久化）
 * 供应商数据模型：{ id, name, protocol, baseURL, apiKey, models: [{id, name}], createdAt }
 * 协议：openai-compatible（OpenAI 兼容）/ anthropic / google
 */
import { get, set } from '../store/index.js'
import { v4 as uuidv4 } from 'uuid'

const STORE_KEY = 'aiProviders'

/** 预设供应商模板：添加时一键填充（协议 + API 地址）；模型列表由用户自行添加（各厂商模型更新频繁，预设不准） */
export const PRESET_PROVIDERS = [
  {
    name: 'OpenAI',
    protocol: 'openai-compatible',
    baseURL: 'https://api.openai.com/v1'
  },
  {
    name: 'DeepSeek',
    protocol: 'openai-compatible',
    baseURL: 'https://api.deepseek.com/v1'
  },
  {
    name: 'Moonshot Kimi',
    protocol: 'openai-compatible',
    baseURL: 'https://api.moonshot.cn/v1'
  },
  {
    name: '通义千问',
    protocol: 'openai-compatible',
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
  },
  {
    name: '智谱AI',
    protocol: 'openai-compatible',
    baseURL: 'https://open.bigmodel.cn/api/paas/v4'
  },
  {
    name: 'Ollama',
    protocol: 'openai-compatible',
    baseURL: 'http://localhost:11434/v1'
  },
  {
    name: 'Anthropic',
    protocol: 'anthropic',
    baseURL: ''
  },
  {
    name: 'Google Gemini',
    protocol: 'google',
    baseURL: ''
  }
]

/** APIKEY 脱敏：sk-abc…xyz → sk-a****yz（前后各留 4 位） */
export const maskApiKey = (key = '') => {
  if (!key) return ''
  if (key.length <= 8) return '***'
  return `${key.slice(0, 4)}****${key.slice(-4)}`
}

const readAll = () => get(STORE_KEY) || []

const writeAll = (providers) => set(STORE_KEY, providers)

const normalizeModels = (models) =>
  Array.isArray(models)
    ? models
        .map((m) => ({ id: (m.id || '').trim(), name: (m.name || m.id || '').trim() }))
        .filter((m) => m.id)
    : []

const toPublic = (provider) => ({
  id: provider.id,
  name: provider.name,
  protocol: provider.protocol,
  baseURL: provider.baseURL,
  models: provider.models || [],
  createdAt: provider.createdAt,
  apiKey: maskApiKey(provider.apiKey),
  hasKey: !!provider.apiKey
})

/** 供主进程内部使用（含明文 apiKey，不经过 IPC） */
export const getProviderById = (id) => readAll().find((p) => p.id === id)

/** 对外列表：apiKey 一律脱敏 */
export const listProviders = () => readAll().map(toPublic)

export const createProvider = (data = {}) => {
  const name = (data.name || '').trim()
  if (!name) throw new Error('供应商名称不能为空')
  if (!data.protocol) throw new Error('请选择协议')
  const provider = {
    id: uuidv4(),
    name,
    protocol: data.protocol,
    baseURL: (data.baseURL || '').trim(),
    apiKey: (data.apiKey || '').trim(),
    models: normalizeModels(data.models),
    createdAt: Date.now()
  }
  const providers = readAll()
  providers.push(provider)
  writeAll(providers)
  return toPublic(provider)
}

export const updateProvider = (id, data = {}) => {
  const providers = readAll()
  const index = providers.findIndex((p) => p.id === id)
  if (index === -1) throw new Error('供应商不存在')
  const current = providers[index]
  const next = {
    ...current,
    name: (data.name || '').trim() || current.name,
    protocol: data.protocol || current.protocol,
    // 传了 baseURL 才更新（空字符串 = 清空）
    baseURL: data.baseURL !== undefined ? (data.baseURL || '').trim() : current.baseURL,
    // apiKey 留空 = 保留原值（编辑表单不改密钥的场景）
    apiKey: data.apiKey ? data.apiKey.trim() : current.apiKey,
    models: Array.isArray(data.models) ? normalizeModels(data.models) : current.models
  }
  providers[index] = next
  writeAll(providers)
  return toPublic(next)
}

export const deleteProvider = (id) => {
  writeAll(readAll().filter((p) => p.id !== id))
}

/** 汇总所有供应商的模型列表（Sender 模型下拉 / 会话选择使用） */
export const getAllModels = () =>
  listProviders().flatMap((provider) =>
    (provider.models || []).map((model) => ({
      providerId: provider.id,
      providerName: provider.name,
      modelId: model.id,
      modelName: model.name || model.id
    }))
  )
