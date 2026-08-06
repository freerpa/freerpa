/**
 * @file: 逻辑循环节点执行器
 * @author: dabao
 * @date: 2024-03-29
 */

// 循环处理器
const loopHandlers = {
  data: async (data, iterator, indexType) => {
    // 如果输入为空,抛出错误
    if (data === undefined || data === null) {
      throw new Error('输入数据为空')
    }

    if (typeof data === 'object') {
      data = Object.values(data)
    } if (typeof data === 'number') {
      data = Array.from({ length: data }, (_, i) => i)
    }

    let result = {}

    for (let i = 0; i < data.length; i++) {
      result = {
        item: data[i],
        index: indexType === 'zero' ? i : i + 1,
        totalTimes: data.length
      }
      // 循环体异常不再吞掉：上抛使 workflowThrowException/workflowEnd 可中断循环
      // （此前被 console.error 吞掉 → 错误静默且可能死循环）
      await iterator(result)
    }
    return result
  },
  times: async (times, iterator, indexType) => {
    times = Number(times) || 0
    let result = {}
    for (let i = 0; i < times; i++) {
      result = {
        item: i + 1,
        index: indexType === 'zero' ? i : i + 1,
        totalTimes: times
      }
      // 同上：循环体异常上抛，可中断循环
      await iterator(result)
    }
    return result
  }
}

import { processParams } from '@/common'
const execute = async (node, context) => {
  const { inputs, config } = node

  const { complete, executeSubFlow, runCode } = context
  const { type, times, indexType } = config
  const { params = [], config: configParams = [] } = config
  //输入处理（没有输入参数，直接使用默认值）
  const inputsOutputs = processParams(params, inputs, runCode)
  //配置参数处理（取对应类型值）
  const configOutputs = configParams.reduce((acc, param) => {
    acc[param.name] = param[param.type + 'Value']
    return acc
  }, {})
  const iterator = async (result) => {
    await executeSubFlow({
      ...inputsOutputs,
      ...configOutputs,
      ...result
    })
  }
  let data = inputs.data
  if (type === 'times') {
    data = Number(times) || 0
  }
  // 执行循环
  const handler = loopHandlers[type]
  if (handler) {
    await handler(data, iterator, indexType)
    complete()
  } else {
    throw new Error('不支持的数据类型')
  }
}

export default execute
