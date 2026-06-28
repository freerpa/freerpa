import { ipcMain } from 'electron'
import { manager } from './index'
import { AES } from 'crypto-js'
import CryptoJS from 'crypto-js'
import { sendToRenderer } from './core/utils/rendererUtils'

var secretKey = CryptoJS.enc.Utf8.parse('Q6bYTizo4OPRiuHUE3XsA5)Zm^WUv+t%')
var iv = CryptoJS.enc.Utf8.parse('YAjXAT9W8nQFWKC0')
const options = {
  iv: iv,
  mode: CryptoJS.mode.CBC,
  padding: CryptoJS.pad.Pkcs7
}

const encryptedData = (data) => {
  const encrypted = AES.encrypt(data, secretKey, options)
  return encrypted.toString()
}

const decryptedData = (data) => {
  const decrypted = AES.decrypt(data, secretKey, options)
  return decrypted.toString(CryptoJS.enc.Utf8)
}

const verifyData = (data) => {
  const decrypted = AES.decrypt(data, secretKey, options)
  return decrypted.toString(CryptoJS.enc.Utf8)
}

// 注册工作流相关的 IPC 处理
export const register = () => {
  // 创建工作流
  ipcMain.handle('flowEventBus:createEngine', async (event, data) => {
    try {
      await manager.createEngine(data)
      return { success: true }
    } catch (error) {
      return { success: false, message: error.message }
    }
  })

  // 执行工作流
  ipcMain.handle('flowEventBus:startFlow', async (event, flowId) => {
    try {
      const engine = await manager.getEngine(flowId)
      engine.on('stateChange', (state, error) => {
        sendToRenderer(`flowEventBus:stateChange:${flowId}`, { state, error })
        if (state === 'completed' || state === 'stopped' || state === 'error') {
          engine.removeAllListeners()
          manager.removeEngine(flowId)
        }
      })
      const result = await engine.execute()
      return { success: true, ...result }
    } catch (error) {
      return { success: false, message: error.message }
    }
  })

  // 停止工作流
  ipcMain.handle('flowEventBus:stopFlow', async (event, flowId) => {
    try {
      const engine = manager.getEngine(flowId)
      if (engine) {
        engine.stop()
        manager.removeEngine(flowId)
      }
      return { success: true }
    } catch (error) {
      return { success: false, message: error.message }
    }
  })

  // 清理工作流
  ipcMain.handle('flowEventBus:cleanup', async (event) => {
    manager.cleanup() 
    return { success: true }
  })

  // 加密数据
  ipcMain.handle('workflow:encryptData', async (event, data) => {
    return encryptedData(data)
  })

  // 解密数据
  ipcMain.handle('workflow:decryptData', async (event, data) => {
    return decryptedData(data)
  })

  // 验证数据
  ipcMain.handle('workflow:verifyData', async (event, data) => {
    return verifyData(data)
  })
}
