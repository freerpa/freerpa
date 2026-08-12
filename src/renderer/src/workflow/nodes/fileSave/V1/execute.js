/**
 * @file: 文件保存节点执行器
 */
import path from 'path'
import { Buffer } from 'node:buffer' // deno ESM 无全局 Buffer，需显式导入
import mime from 'mime-types'
import axios from 'axios'
import { safeWriteFileSync, getCorrectDirectorySync } from '@/common'

// 执行器
const execute = async (node, context) => {
  const { config } = node
  const { filePath, fileName, overwrite } = config
  const { content } = node.inputs
  const { onBeforeDestroy, complete, fs } = context

  let finalFileName = fileName

  // 生成自动编号
  const generateNumber = (fileName, index) => {
    const fileNames = fileName.split('.')
    // 倒数第二位插入index
    fileNames.splice(-1, 0, String(index).padStart(3, '0'))
    return fileNames.join('.')
  }

  // 获取文件扩展名
  const getExtension = (content) => {
    // 如果是base64数据
    if (typeof content === 'string' && content.startsWith('data:')) {
      const match = content.match(/^data:([^;]+);base64,/)
      if (match) {
        return mime.extension(match[1]) || ''
      }
    }
    // 如果是URL，先尝试从URL中获取
    if (typeof content === 'string' && content.startsWith('http')) {
      const urlExt = path.extname(content.split('?')[0])
      if (urlExt) return urlExt.slice(1)
    }

    // 如果是Buffer，尝试从内容判断
    if (Buffer.isBuffer(content)) {
      // 这里可以添加文件头识别逻辑
      const fileType = mime.lookup(content)
      return mime.extension(fileType) || ''
    }

    // 如果是对象，保存为JSON
    if (typeof content === 'object') {
      return 'json'
    }

    // 默认保存为无扩展名
    return ''
  }

  // 获取文件名
  const getFileName = (content) => {
    let fileName = 'file'
    if (typeof content === 'string' && content.startsWith('http')) {
      fileName = path.basename(content.split('?')[0]).split('.')[0]
    }
    const extension = getExtension(content)
    if (extension) {
      fileName = fileName + '.' + extension
    }
    return fileName
  }

  let source = null
  // 下载文件
  const downloadFile = async (url) => {
    source = axios.CancelToken.source()
    const response = await axios.get(url, {
      cancelToken: source.token,
      responseType: 'arraybuffer',
      timeout: 30000, // 默认30秒超时
      maxRedirects: 5 // 最大重定向次数
    })
    source = null

    if (!finalFileName && response.headers['content-disposition']) {
      // 根据content-disposition获取文件名
      const contentDisposition = response.headers['content-disposition']
      finalFileName = contentDisposition.split('filename=')[1]?.replace(/['"]/g, '')
    }
    return response.data
  }

  // 处理内容
  const processContent = async (content) => {
    // 如果是URL
    if (typeof content === 'string' && content.startsWith('http')) {
      const data = await downloadFile(content)
      return {
        content: data
      }
    }

    // 如果是base64数据
    if (typeof content === 'string' && content.startsWith('data:')) {
      const base64Data = content.split(';base64,').pop()
      return {
        content: Buffer.from(base64Data, 'base64')
      }
    }

    // 如果是Buffer，直接返回
    if (Buffer.isBuffer(content)) {
      return { content }
    }

    // 如果是对象，保存为JSON
    if (typeof content === 'object') {
      return {
        content: JSON.stringify(content, null, 2)
      }
    }

    // 其他情况转为字符串
    return {
      content: String(content)
    }
  }
  try {
    // 取消下载
    onBeforeDestroy(() => {
      if (source) {
        source.cancel()
      }
    })

    // 处理内容
    const { content: processedContent } = await processContent(content)

    // 处理文件名
    if (!finalFileName) {
      finalFileName = fileName || getFileName(content)
    }
    const fileDirPath = getCorrectDirectorySync(fs, filePath)

    // 保存文件
    let savePath = path.join(fileDirPath, finalFileName)

    // 如果文件存在，且不允许覆盖，则编号
    if (!overwrite) {
      let index = 1
      savePath = path.join(fileDirPath, generateNumber(finalFileName, index))
      while (fs.existsSync(savePath)) {
        savePath = path.join(fileDirPath, generateNumber(finalFileName, index))
        index++
      }
    }

    // 保存文件
    try {
      safeWriteFileSync(fs, savePath, processedContent)
      // 使用 complete 方法返回结果并继续执行
    } catch (error) {
      savePath = ''
    }

    complete({
      result: savePath
    })
  } catch (error) {
    throw error
  }
}

export default execute
