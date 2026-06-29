/**
 * @file: 文件选择节点执行器
 * @author: dabao
 * @date: 2024-03-29
 */
import path from 'path'
import { page_eval } from '@pageEval'
// MIME类型映射
const mimeTypes = {
  // 图片
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
  svg: 'image/svg+xml',
  // 文档
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  // 文本
  txt: 'text/plain',
  csv: 'text/csv',
  html: 'text/html',
  htm: 'text/html',
  xml: 'text/xml',
  json: 'application/json',
  // 压缩文件
  zip: 'application/zip',
  rar: 'application/x-rar-compressed',
  '7z': 'application/x-7z-compressed',
  tar: 'application/x-tar',
  gz: 'application/gzip',
  // 音频
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  // 视频
  mp4: 'video/mp4',
  avi: 'video/x-msvideo',
  mov: 'video/quicktime',
  wmv: 'video/x-ms-wmv',
  // 其他
  bin: 'application/octet-stream'
}

// 获取MIME类型
const getMimeType = (fileName) => {
  const ext = fileName.split('.').pop().toLowerCase()
  return mimeTypes[ext] || 'application/octet-stream'
}

const execute = async (node, context) => {
  const { inputs, config } = node
  const { complete, fs } = context

  // 遍历文件夹获取所有文件路径
  const getAllFiles = (dirPath) => {
    const files = []
    const items = fs.readdirSync(dirPath).sort()

    for (const item of items) {
      const fullPath = path.join(dirPath, item)
      const stat = fs.statSync(fullPath)

      if (stat.isFile()) {
        files.push(fullPath)
      } else if (stat.isDirectory()) {
        files.push(...getAllFiles(fullPath))
      }
    }

    return files
  }

  // 读取文件内容
  const readFileContent = (filePath) => {
    try {
      // 读取文件内容
      const buffer = fs.readFileSync(filePath)
      // 转换为 ArrayBuffer
      return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
    } catch (error) {
      return new ArrayBuffer(0)
    }
  }

  const getFilePaths = (filePath) => {
    const filePaths = []
    if (Array.isArray(filePath)) {
      filePath.forEach((item) => filePaths.push(...getFilePaths(item)))
    } else if (typeof filePath === 'string') {
      try {
        const stat = fs.statSync(filePath)
        if (stat.isFile()) {
          filePaths.push(filePath)
        } else if (stat.isDirectory()) {
          filePaths.push(...getAllFiles(filePath))
        }
      } catch (error) {
        console.log('无效的文件路径:', filePath)
      }
    }
    return filePaths
  }
  try {
    const page = inputs.page
    const { selector, forceDrop = false } = config
    // 获取所有需要处理的文件路径

    const filePaths = getFilePaths(inputs.filePath)
    // 处理上传按钮
    const handleUploadButton = async (uploadButton, targetFiles) => {
      try {
        if (!uploadButton) {
          throw new Error(`未找到上传按钮: ${selector}`)
        }
        // 判断是否支持多文件上传
        const isMultiple = await page_eval(
          uploadButton,
          `(uploadButton) => {
            return uploadButton.multiple
          }`
        )
        for (let index in targetFiles) {
          targetFiles[index] = await fs.realpath(targetFiles[index])
        }
        // 上传文件
        if (isMultiple) {
          await uploadButton.uploadFile(...targetFiles)
        } else {
          await uploadButton.uploadFile(targetFiles[0])
        }
        return true
      } catch (error) {
        throw error
      }
    }

    // 模拟文件拖放
    const handleDrop = async (dropZone, targetFiles) => {
      try {
        if (!dropZone) {
          throw new Error(`拖放区域未找到: ${selector}`)
        }

        // 准备文件数据
        const files = await Promise.all(
          targetFiles.map(async (filePath) => {
            const stat = fs.statSync(filePath)
            const fileName = path.basename(filePath)
            const fileType = getMimeType(fileName)
            const content = await readFileContent(filePath)

            return {
              name: fileName,
              type: fileType,
              path: filePath,
              size: stat.size,
              lastModified: stat.mtimeMs,
              content: Array.from(new Uint8Array(content))
            }
          })
        )

        //将files转为字符串并分割为5m大小的字符串数组
        const filesStr = JSON.stringify(files)
        const filesStrArr = filesStr.match(/.{1,5242880}/g)
        //依次传递给浏览器
        for (let index in filesStrArr) {
          await page_eval(
            page,
            `(filesStr,isStart) => {
            if(isStart || !window.__automan_files_temp){
              window.__automan_files_temp = []
            }
            window.__automan_files_temp.push(filesStr)
          }`,
            filesStrArr[index],
            index == 0
          )
        }
        // 注入拖放处理代码
        await page_eval(
          dropZone,
          `(dropZone) => {
            if (!dropZone) return
            // 从浏览器获取文件字符串
            const filesStr = window.__automan_files_temp.join('')
            // 解析为文件数组
            const filesData = JSON.parse(filesStr)

            // 创建 DataTransfer 对象
            const dt = new DataTransfer()

            // 添加文件到 DataTransfer
            filesData.forEach((fileData) => {
              // 创建 Blob 对象
              const blob = new Blob([new Uint8Array(fileData.content)], { type: fileData.type })

              // 创建完整的 File 对象
              const file = new File([blob], fileData.name, {
                type: fileData.type,
                lastModified: fileData.lastModified
              })

              // 添加自定义属性
              Object.defineProperties(file, {
                path: {
                  value: fileData.path,
                  writable: false
                },
                size: {
                  value: fileData.size,
                  writable: false
                }
              })

              dt.items.add(file)
            })

            // 触发拖放事件序列
            ;['dragenter', 'dragover', 'drop'].forEach((eventType) => {
              const event = new DragEvent(eventType, {
                bubbles: true,
                cancelable: true,
                dataTransfer: dt
              })
              event.preventDefault()
              dropZone.dispatchEvent(event)
            })
          }`
        )
        return true
      } catch (error) {
        throw error
      }
    }

    // 等待目标元素出现
    await page.waitForSelector(selector)
    // 获取目标元素
    const element = await page.$(selector)
    //根据元素是否为input file类型选择处理方法
    const isInputFile = await page_eval(
      element,
      `(element) => {
        return element?.type === 'file'
      }`
    )

    // 根据模式选择处理方法
    const handler = isInputFile && !forceDrop ? handleUploadButton : handleDrop

    // 执行处理
    await handler(element, filePaths)

    // 完成执行
    complete({
      fileCount: filePaths.length
    })
  } catch (error) {
    throw error
  }
}

export default execute
