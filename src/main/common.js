import path from 'path'
// 处理参数
export const processParams = (params, data, runCode) => {
  const result = {}
  if (params.length) {
    params.forEach((param) => {
      let type = param.type
      if(Array.isArray(param.type)) {
        type = param.type[0]
      }
      let value = data[param.name] || param[type + 'Value']

      // 如果类型为数组、对象或任意类型，并且值为字符串，则尝试解析为对应类型
      if (
        ['array', 'object', 'any'].includes(type) &&
        !data.hasOwnProperty(param.name) &&
        typeof value === 'string'
      ) {
        try {
          value = runCode(`(function(){return ${value}})()`)
        } catch (error) {
          throw new Error(`参数 ${param.name} 格式错误`)
        }
      }
      // 如果类型为字符串、数字、布尔值，则进行类型转换
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
      // 如果参数必填，则进行必填判断
      if (param.required && (value === null || value === undefined || value === '')) {
        throw new Error(`参数 ${param.name} 不能为空`)
      }
    })
  }
  return result
}

// 安全写入文件，确保目录存在
export const safeWriteFileSync = (fs, filePath, data) => {
  try {
    // 获取文件所在的目录路径
    const dirPath = path.dirname(filePath)
    // 检查目录是否存在，如果不存在则创建
    if (!fs.existsSync(dirPath)) {
      // 递归创建目录（如果父目录也不存在）
      fs.mkdirSync(dirPath, { recursive: true })
      console.log(`目录已创建: ${dirPath}`)
    }

    // 写入文件
    fs.writeFileSync(filePath, data)
    console.log(`文件已成功写入: ${filePath}`)
  } catch (err) {
    console.error('写入文件时发生错误:', err.message)
  }
}

// 同步获取路径对应的目录（文件返回父目录，目录返回自身）
export const getCorrectDirectorySync = (fs, targetPath) => {
  try {
    const stats = fs.statSync(targetPath)
    return stats.isDirectory() ? targetPath : path.dirname(targetPath)
  } catch (err) {
    return targetPath
  }
}

export { getHandler } from '@renderer/workflow/dataHandlers/'
export { openBrowser } from './browser/index.js'
export { launchKernel, downloadKernel, checkKernelExists, fetchKernelList } from './browser/index.js'
