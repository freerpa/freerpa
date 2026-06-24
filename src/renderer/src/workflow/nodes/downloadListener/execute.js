/**
 * @file: 下载监听节点执行器
 * @author: dabao
 * @date: 2024-03-29
 */

const execute = async (node, context) => {
  const { inputs, config } = node
  const { next, complete, onBeforeDestroy } = context
  const page = inputs.page
  const { isContinuous } = config

  try {
    let downloadUrl = ''
    let fileName = ''
    // 连接到 Chrome DevTools Protocol
    const client = await page.target().createCDPSession()

    // 启用 Page 域以监听下载事件
    await client.send('Page.enable')

    // 设置下载行为
    await client.send('Page.setDownloadBehavior', {
      // 禁止下载
      behavior: 'deny'
    })

    // 监听下载开始事件
    client.on('Page.downloadWillBegin', (download) => {
      downloadUrl = download.url
      fileName = download.suggestedFilename
      if (isContinuous) {
        next({
          downloadUrl,
          fileName
        })
      } else {
        complete({
          downloadUrl,
          fileName
        })
        清理监听()
      }
    })

    const 清理监听 = () => {
      client.removeAllListeners('Page.downloadWillBegin')
    }

    // 销毁时移除监听
    onBeforeDestroy(() => {
      清理监听()
    })
  } catch (error) {
    throw error
  }
}

export default execute
