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

/**
 * 计算节点输入（纯函数、渲染无关）：与 useNodeIO.nodeInputs 的静态/动态部分一致。
 * 用于隐藏节点（收起子流程未渲染）inputs 缺失时的兜底。
 * @param {Object} node 节点对象（含 data.type / data.config）
 * @param {Object} nodeDefinitions 节点定义表（nodes[type]）
 */
export const getNodeInputs = (node, nodeDefinitions) => {
  const def = nodeDefinitions?.[node.data?.type]
  const inputs = [...(def?.inputs?.filter((input) => input.type !== 'dynamic') || [])]
  inputs.push(
    ...resolveDynamicIO(
      def?.inputs?.filter((input) => input.type === 'dynamic'),
      node.data?.config,
      'inputs'
    )
  )
  return inputs
}

/**
 * 计算节点输出（纯函数、渲染无关）：与 useNodeIO.nodeOutputs 逻辑一致。
 * 隐藏节点（收起子流程未渲染）导致 data.outputs 缺失时，供参数引用解析兜底补齐，
 * 避免「找不到引用」误报。优先使用渲染端已写入的 data.outputs，仅缺失时调用本函数。
 * @param {Object} node 节点对象（含 data.type / data.config / parentNode）
 * @param {Array} flowNodes 画布全部节点（查找父级子流程节点与子流程结束节点）
 * @param {Object} nodeDefinitions 节点定义表（nodes[type]）
 */
export const getNodeOutputs = (node, flowNodes, nodeDefinitions) => {
  const def = nodeDefinitions?.[node.data?.type]
  const outputs = [...(def?.outputs?.filter((output) => output.type !== 'dynamic') || [])]
  // 子流程起始节点：透传父级 startOutputs
  if (node.data?.type === 'workflowStart' && node.parentNode) {
    const parentNode = flowNodes?.find((n) => n.id === node.parentNode.replace('-subFlow', ''))
    const parentDef = parentNode && nodeDefinitions?.[parentNode.data?.type]
    parentDef?.subFlow?.startOutputs?.forEach((item) => {
      outputs.push({ ...item, isConfig: true })
    })
  }
  // 动态输出
  outputs.push(
    ...resolveDynamicIO(
      def?.outputs?.filter((output) => output.type === 'dynamic'),
      node.data?.config,
      'outputs'
    )
  )
  // 子流程节点：透传子流程结束节点输入（结束节点 inputs 缺失时按定义+配置兜底）
  if (def?.subFlow && def.subFlow.endOutputs !== false) {
    const endNode = flowNodes?.find(
      (n) => n.data?.type === 'workflowEnd' && n.parentNode === node.id + '-subFlow'
    )
    if (endNode) {
      outputs.push(
        ...(endNode.data?.inputs?.length
          ? endNode.data.inputs
          : getNodeInputs(endNode, nodeDefinitions))
      )
    }
  }
  return outputs
}
