import { IO_KEY } from './io-conventions.js'

/**
 * 解析动态 IO 定义（输入/输出共用）
 * 纯函数、无渲染端依赖：useNodeIO 与 worker 端（build-worker 复制后）均可复用
 * @param {Array} defIOList 节点定义中 type==='dynamic' 的 IO 声明列表
 * @param {Object} config 节点配置（dataPath 取值源）
 * @param {'inputs'|'outputs'} side 输入/输出（输出带 isConfig 标记）
 * @returns 解析后的 IO 数组（已过滤无 id；开发期对缺失映射字段 console.warn）
 */
const readDataPath = (io, config) => {
  // __nodeIO 统一约定：优先读 config.__nodeIO[side]，存量工作流（legacyDataPath）回退旧字段
  if (io.dataPath.startsWith('__nodeIO')) {
    const side = io.dataPath.split('.')[1]
    if (config.__nodeIO?.[side]) return config.__nodeIO[side]
    if (io.legacyDataPath) {
      return io.legacyDataPath.split('.').reduce((obj, key) => obj?.[key], config)
    }
    return []
  }
  // 业务配置数组（params/rules/dataModel 等）直接按 dataPath 取值
  return io.dataPath.split('.').reduce((obj, key) => obj?.[key], config)
}

export const resolveDynamicIO = (defIOList, config, side = 'outputs') => {
  const result = []
  defIOList?.forEach((io) => {
    const data = readDataPath(io, config) || []
    if (!Array.isArray(data)) return
    const fieldMap = io.fieldMap || {}
    data.forEach((item) => {
      const id = item[fieldMap.id]
      // 开发期校验：映射字段缺失时提示（避免 dataExtract 式缺字段静默漂移）
      if (import.meta.env?.DEV) {
        for (const [stdKey, dataKey] of Object.entries(fieldMap)) {
          if (dataKey && typeof dataKey === 'string' && item[dataKey] === undefined && ![IO_KEY.REQUIRED, IO_KEY.IS_CONFIG].includes(stdKey)) {
            console.warn(`[resolveDynamicIO] 动态${side}字段 ${id ?? io.dataPath} 缺少映射字段 "${dataKey}"（fieldMap.${stdKey}）`)
          }
        }
      }
      result.push({
        id,
        name: item[fieldMap.name],
        type: item[fieldMap.type] || 'any',
        description: item[fieldMap.description] || '',
        required: item[fieldMap.required] || false,
        // 输出带 isConfig（fieldMap.isConfig 是布尔标记而非字段名）
        ...(side === 'outputs' ? { isConfig: fieldMap.isConfig || false } : {})
      })
    })
  })
  return result.filter((io) => io.id)
}
