/**
 * @file: 逻辑循环节点执行器
 * @author: dabao
 * @date: 2024-03-29
 */
// 循环处理器
const loopHandlers = {
  // 数组循环
  array: async (data, iterator) => {
    if (!Array.isArray(data)) {
      throw new Error('输入数据不是数组')
    }

    let result = {}

    for (let i = 0; i < data.length; i++) {
      result = {
        item: data[i],
        index: i,
        times: i + 1
      }
      await iterator(result)
    }
    return result
  },

  // 对象循环
  object: async (data, iterator) => {
    if (typeof data !== 'object' || data === null) {
      throw new Error('输入数据不是对象')
    }

    let result = {}

    const entries = Object.entries(data)
    for (let i = 0; i < entries.length; i++) {
      const [key, value] = entries[i]
      result = {
        item: value,
        index: i,
        times: i + 1
      }
      await iterator(result)
      console.log('对象循环', i)
    }
    return result
  },

  // 字符串循环
  string: async (data, iterator) => {
    if (typeof data !== 'string') {
      throw new Error('输入数据不是字符串')
    }

    let result = {}

    for (let i = 0; i < data.length; i++) {
      result = {
        item: data[i],
        index: i,
        times: i + 1
      }
      await iterator(result)
    }
    return result
  },

  // 数字循环
  number: async (data, iterator) => {
    if (typeof data !== 'number') {
      throw new Error('输入数据不是数字')
    }

    const count = Math.floor(data)
    if (count <= 0) {
      throw new Error('循环次数必须大于0')
    }

    let result = {}

    for (let i = 0; i < count; i++) {
      result = {
        item: i,
        index: i,
        times: i + 1
      }
      await iterator(result)
    }
    return result
  }
}

import { processParams } from '@/common'
const execute = async (node, context) => {
  const { inputs, config } = node

  const { complete, executeSubFlow, runCode } = context

  try {
    const data = inputs.data

    // 如果输入为空,抛出错误
    if (data === undefined || data === null) {
      throw new Error('输入数据为空')
    }

    // 获取数据类型
    const type = Array.isArray(data) ? 'array' : typeof data

    // 执行循环
    const handler = loopHandlers[type]
    if (handler) {
      const iterator = async (result) => {
        const { params = [], config: configParams = [] } = config
        //输入处理（没有输入参数，直接使用默认值）
        const inputsOutputs = processParams(params, inputs, runCode)
        //配置参数处理（取对应类型值）
        const configOutputs = configParams.reduce((acc, param) => {
          acc[param.name] = param[param.type + 'Value']
          return acc
        }, {})
        await executeSubFlow({
          ...inputsOutputs,
          ...configOutputs,
          ...result
        })
      }
      await handler(data, iterator)
      complete()
    } else {
      throw new Error('不支持的数据类型')
    }
  } catch (error) {
    throw error
  }
}

export default execute
