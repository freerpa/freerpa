import { ipcMain } from 'electron'
import { v4 as uuid } from 'uuid'

// 发送消息到渲染进程
function sendToRenderer(channel, data = {}) {
  try {
    global.mainView.webContents.send(channel, data)
  } catch (error) {
    console.error('发送消息到渲染进程失败:', error)
  }
}

// 异步发送消息到渲染进程
async function sendToRendererAsync(channel, data) {
  data.async = true
  return new Promise((resolve, reject) => {
    const TIMEOUT_MS = 30000
    const responseId = uuid()

    let settled = false
    const done = (err, result) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      ipcMain.removeAllListeners(`${channel}:response:${responseId}`)
      if (err) reject(err)
      else resolve(result)
    }

    const timeout = setTimeout(() => {
      done(new Error('Renderer response timeout'))
    }, TIMEOUT_MS)

    try {
      ipcMain.once(`${channel}:response:${responseId}`, (event, response) => {
        done(null, response)
      })
      data.responseId = responseId
      sendToRenderer(channel, data)
    } catch (error) {
      done(error)
    }
  })
}

// 监听来自渲染进程的事件
function onFromRenderer(channel, callback) {
  ipcMain.removeHandler(channel)
  // 注册监听器
  ipcMain.handle(channel, (event, data) => {
    return callback(data)
  })
  // 返回清理函数
  return () => {
    // 移除所有监听器
    ipcMain.removeAllListeners(channel)
    ipcMain.removeHandler(channel)
  }
}

export { sendToRenderer, sendToRendererAsync, onFromRenderer }
