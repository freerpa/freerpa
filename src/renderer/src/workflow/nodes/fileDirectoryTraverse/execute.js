/**
 * @file: 文件目录遍历节点执行器
 * @author: FreeRPA
 * @date: 2025-07-30
 */

// 递归遍历目录
const traverseDirectory = async (
  dirPath,
  fs,
  path,
  minimatch,
  options = {
    traverseType: ['files'],
    isDeep: true,
    maxDepth: 10,
    includePattern: '*',
    excludePattern: '',
    currentDepth: 0
  }
) => {
  const {
    traverseType,
    isDeep,
    maxDepth,
    includePattern,
    excludePattern,
    currentDepth
  } = options

  // 检查深度限制
  if (isDeep && maxDepth > 0 && currentDepth >= maxDepth) {
    return []
  }

  let results = []

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name)

      // 检查排除模式
      if (excludePattern && minimatch(entry.name, excludePattern)) {
        continue
      }

      // 检查包含模式
      if (!minimatch(entry.name, includePattern)) {
        continue
      }

      if (entry.isDirectory()) {
        // 如果是目录
        if (traverseType.includes('directories')) {
          try {
            const stats = await fs.stat(fullPath)
            results.push({
              path: fullPath,
              name: entry.name,
              type: 'directory',
              size: 0,
              mtime: stats.mtime.getTime(),
              ctime: stats.ctime.getTime()
            })
          } catch (statError) {
            console.warn(`无法获取目录状态: ${fullPath}, 错误: ${statError.message}`)
            results.push({
              path: fullPath,
              name: entry.name,
              type: 'directory',
              size: 0,
              mtime: 0,
              ctime: 0
            })
          }
        }

        // 如果需要深度遍历
        if (isDeep) {
          const subResults = await traverseDirectory(fullPath, fs, path, minimatch, {
            ...options,
            currentDepth: currentDepth + 1
          })
          results = results.concat(subResults)
        }
      } else if (entry.isFile()) {
        // 如果是文件
        if (traverseType.includes('files')) {
          try {
            const stats = await fs.stat(fullPath)
            results.push({
              path: fullPath,
              name: entry.name,
              type: 'file',
              size: stats.size,
              mtime: stats.mtime.getTime(),
              ctime: stats.ctime.getTime()
            })
          } catch (statError) {
            console.warn(`无法获取文件状态: ${fullPath}, 错误: ${statError.message}`)
            results.push({
              path: fullPath,
              name: entry.name,
              type: 'file',
              size: 0,
              mtime: 0,
              ctime: 0
            })
          }
        }
      }
    }
  } catch (error) {
    throw new Error(`遍历目录失败: ${error.message}`)
  }

  return results
}

// 排序结果
const sortResults = (results, sortBy, sortOrder) => {
  if (sortBy === 'none' || !results.length) {
    return results
  }

  return results.sort((a, b) => {
    let aValue = a[sortBy]
    let bValue = b[sortBy]

    // 处理字符串比较
    if (typeof aValue === 'string') {
      aValue = aValue.toLowerCase()
      bValue = bValue.toLowerCase()
    }

    if (sortOrder === 'asc') {
      return aValue > bValue ? 1 : aValue < bValue ? -1 : 0
    } else {
      return aValue < bValue ? 1 : aValue > bValue ? -1 : 0
    }
  })
}
import path from 'path';
import minimatch from 'minimatch';

const execute = async (node, context) => {
  const { config } = node
  const { complete, fs } = context

  try {
    const {
      directoryPath,
      traverseType = 'files',
      isDeep = true,
      maxDepth = 10,
      includePattern = '*',
      excludePattern = '',
      sortBy = 'name',
      sortOrder = 'asc'
    } = config

    // 验证目录路径
    if (!directoryPath) {
      throw new Error('目录路径不能为空')
    }

    // 检查目录是否存在
    try {
      const stats = await fs.stat(directoryPath)
      if (!stats.isDirectory()) {
        throw new Error('指定的路径不是一个目录')
      }
    } catch (error) {
      throw new Error(`目录访问失败: ${error.message}`)
    }

    // 遍历目录
    const results = await traverseDirectory(directoryPath, fs, path, minimatch, {
      traverseType,
      isDeep,
      maxDepth,
      includePattern,
      excludePattern,
      currentDepth: 0
    })

    // 排序结果
    const sortedResults = sortResults(results, sortBy, sortOrder)

    // 提取路径列表
    const paths = sortedResults.map(item => item.path)

    // 准备输出数据
    const outputData = {
      paths,
      count: paths.length,
      rootPath: directoryPath
    }

    // 使用context.complete完成节点执行，传递输出数据和isNext参数
    complete(outputData)
  } catch (error) {
    throw error
  }
}

export default execute