/**
 * @file: 视频预览节点执行器
 * @author: AutoMan
 * @date: 2025-07-31
 */
const path = require('path')
const { URL } = require('url')

const execute = async (node, context) => {
  const { inputs } = node
  const { sendNodeEvent, complete, fs } = context

  try {
    let video = inputs.video

    function getFileProtocolUrl(filePath) {
      try {
        // 1. 获取文件的绝对路径（处理相对路径）
        const absolutePath = fs.realpathSync(filePath)

        // 2. 处理不同操作系统的路径格式
        let pathForUrl
        if (process.platform === 'win32') {
          // Windows 系统：将反斜杠转为正斜杠，盘符后加斜杠（如 C:/xxx）
          pathForUrl = absolutePath.replace(/\\/g, '/').replace(/^([A-Za-z]):/, '/$1:')
        } else {
          // Unix/Linux/macOS 系统：直接使用绝对路径
          pathForUrl = absolutePath
        }

        // 3. 构造 file:// 协议的 URL
        const fileUrl = new URL(`file://${pathForUrl}`)

        return fileUrl.href
      } catch (err) {
        console.error('获取文件URL失败：', err.message)
        return null
      }
    }

    if (video && !video.startsWith('http')) {
      // 获取完整的本地文件路径
      video = getFileProtocolUrl(video)
    }

    // 发送输出事件到渲染进程
    sendNodeEvent({
      type: 'preview',
      data: {
        video
      }
    })

    complete()
  } catch (error) {
    throw error
  }
}

export default execute
