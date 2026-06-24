import { ipcMain } from 'electron'
import { AES } from 'crypto-js'
import CryptoJS from 'crypto-js'

var encryptSecretKey = CryptoJS.enc.Utf8.parse('2bmd.vCK!ddOf0ke2ey6kjC@5Q^a++R_')
var decryptSecretKey = CryptoJS.enc.Utf8.parse('kgJsGk#4_^n%CRn~nD4oKDVgqwKG5T7+')
var iv = CryptoJS.enc.Utf8.parse('PEtbFYrwJnJz5s4B')

const options = {
  iv: iv,
  mode: CryptoJS.mode.CBC,
  padding: CryptoJS.pad.Pkcs7
}

export const encryptedData = (data) => {
  const encrypted = AES.encrypt(JSON.stringify(data), encryptSecretKey, options)
  return encrypted.toString()
}

export const decryptedData = (data) => {
  const decrypted = AES.decrypt(data, decryptSecretKey, options)
  return JSON.parse(decrypted.toString(CryptoJS.enc.Utf8))
}

// 注册加密解密相关的 IPC 处理
export const register = () => {
  // 加密数据
  ipcMain.handle('api:encrypt', async (event, data) => {
    return encryptedData(data)
  })

  // 解密数据
  ipcMain.handle('api:decrypt', async (event, data) => {
    return decryptedData(data)
  })
}
