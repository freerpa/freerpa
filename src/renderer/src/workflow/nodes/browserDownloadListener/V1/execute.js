/**
 * @file: 下载监听节点执行器
 * @author: dabao
 * @date: 2024-03-29
 */

const execute = async (node, context) => {
  const { inputs, config } = node
  const { next, complete, onBeforeDestroy, fs, sendNodeEvent } = context
  const page = inputs.page
  const { savePath, isContinuous } = config

  try {
    let downloadUrl = ''
    let fileName = ''
    // 初始化下载选项
    const downloadOptions = {
      // 禁止下载
      behavior: 'deny',
      // 设置下载路径
      downloadPath: ''
    }
    // 如果设置了保存路径，则允许下载并设置下载路径
    if (savePath) {
      downloadOptions.behavior = 'allow'
      if (!fs.existsSync(savePath)) {
        fs.mkdirSync(savePath, { recursive: true })
      }
      // 获取真实路径
      const realPath = fs.realpathSync(savePath)
      downloadOptions.downloadPath = realPath
    }
    // 设置下载行为
    await page._client().send('Page.setDownloadBehavior', downloadOptions)



    // 监听下载开始事件
    page._client().on('Page.downloadWillBegin', (download) => {
      downloadUrl = download.url
      fileName = download.suggestedFilename
      sendNodeEvent({
        type: 'start'
      })
    })

    // 监听下载开始事件
    page._client().on('Page.downloadProgress', (download) => {
      sendNodeEvent({
        type: 'progress',
        data: download
      })
      if (download.state !== 'inProgress') {
        const output = {
          downloadUrl,
          fileName,
          filePath: ''
        }
        if (download.state === 'completed') {
          output.filePath = downloadOptions.downloadPath + fileName
        }
        if (isContinuous) {
          next(output)
        } else {
          complete(output)
          cleanUpListeners()
        }
      }

    })

    const cleanUpListeners = () => {
      page._client().removeAllListeners('Page.downloadWillBegin')
      page._client().removeAllListeners('Page.downloadProgress')
    }

    // 销毁时移除监听
    onBeforeDestroy(() => {
      cleanUpListeners()
    })
  } catch (error) {
    throw error
  }
}

export default execute
