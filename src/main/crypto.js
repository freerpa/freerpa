/**
 * @file: 数据加解密（AES-CBC）— 独立于业务模块，供 IPC 与内部使用
 */
import CryptoJS from 'crypto-js'
import { ipcMain } from 'electron'

const secretKey = CryptoJS.enc.Utf8.parse('Q6bYTizo4OPRiuHUE3XsA5)Zm^WUv+t%')
const iv = CryptoJS.enc.Utf8.parse('YAjXAT9W8nQFWKC0')
const options = {
  iv,
  mode: CryptoJS.mode.CBC,
  padding: CryptoJS.pad.Pkcs7
}

/** 解密（AES-CBC） */
export const decryptData = (data) => {
  const decrypted = CryptoJS.AES.decrypt(data, secretKey, options)
  return decrypted.toString(CryptoJS.enc.Utf8)
}

/** 注册解密 IPC（渲染端 workflow/utils/crypto.js 的 decryptData） */
export const registerDecryptIpc = () => {
  ipcMain.handle('workflow:decryptData', async (_, data) => decryptData(data))
}
