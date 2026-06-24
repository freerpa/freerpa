/**
 * @file: 数据加解密节点执行器
 * @author: dabao
 * @date: 2024-03-15
 */
import CryptoJS from 'crypto-js'

const execute = async (node, context) => {
  const { inputs, config } = node
  const { complete } = context

  try {
    const {
      mode = 'encrypt',
      algorithm = 'aes',
      key = '',
      iv = '',
      encoding = 'base64',
      cipherMode = 'cbc',
      padding = 'pkcs7',
      keySize = '256'
    } = config

    // 确保输入数据是字符串
    const data = typeof inputs.data === 'string' ? inputs.data : JSON.stringify(inputs.data)

    try {
      // 处理密钥和IV
      const getKeyAndIV = () => {
        const keyBytes = CryptoJS.enc.Utf8.parse(key)
        const ivBytes = iv ? CryptoJS.enc.Utf8.parse(iv) : CryptoJS.enc.Utf8.parse('')

        switch (algorithm) {
          case 'aes':
            return {
              key: keyBytes,
              iv: ivBytes,
              keySize: parseInt(keySize) / 32
            }
          case 'des':
            return {
              key: keyBytes.words.slice(0, 2),
              iv: ivBytes?.words.slice(0, 2)
            }
          case '3des':
            return {
              key: keyBytes.words.slice(0, 6),
              iv: ivBytes?.words.slice(0, 2)
            }
          default:
            return { key: keyBytes, iv: ivBytes }
        }
      }

      // 获取加密配置
      const getCipherConfig = () => {
        const modes = {
          ecb: CryptoJS.mode.ECB,
          cbc: CryptoJS.mode.CBC,
          cfb: CryptoJS.mode.CFB,
          ofb: CryptoJS.mode.OFB,
          ctr: CryptoJS.mode.CTR
        }

        const paddings = {
          pkcs7: CryptoJS.pad.Pkcs7,
          zero: CryptoJS.pad.ZeroPadding,
          nopadding: CryptoJS.pad.NoPadding
        }

        const { iv } = getKeyAndIV()
        return {
          mode: modes[cipherMode],
          padding: paddings[padding],
          iv
        }
      }

      const crypto = () => {
        try {
          switch (algorithm) {
            case 'aes': {
              const { key, keySize } = getKeyAndIV()
              const cfg = getCipherConfig()

              if (mode === 'encrypt') {
                const encrypted = CryptoJS.AES.encrypt(data, key, {
                  ...cfg,
                  keySize
                })
                return encoding === 'hex' ? encrypted.ciphertext.toString() : encrypted.toString()
              } else {
                const decrypted = CryptoJS.AES.decrypt(data, key, {
                  ...cfg,
                  keySize
                })
                return decrypted.toString(CryptoJS.enc.Utf8)
              }
            }

            case 'des': {
              const { key } = getKeyAndIV()
              const cfg = getCipherConfig()
              console.log('cfg', cfg)
              if (mode === 'encrypt') {
                const encrypted = CryptoJS.DES.encrypt(data, key, cfg)
                return encoding === 'hex' ? encrypted.ciphertext.toString() : encrypted.toString()
              } else {
                const decrypted = CryptoJS.DES.decrypt(data, key, cfg)
                return decrypted.toString(CryptoJS.enc.Utf8)
              }
            }

            case '3des': {
              const { key } = getKeyAndIV()
              const cfg = getCipherConfig()

              if (mode === 'encrypt') {
                const encrypted = CryptoJS.TripleDES.encrypt(data, key, cfg)
                return encoding === 'hex' ? encrypted.ciphertext.toString() : encrypted.toString()
              } else {
                const decrypted = CryptoJS.TripleDES.decrypt(data, key, cfg)
                return decrypted.toString(CryptoJS.enc.Utf8)
              }
            }

            case 'rc4': {
              const { key } = getKeyAndIV()
              if (mode === 'encrypt') {
                const encrypted = CryptoJS.RC4.encrypt(data, key)
                return encoding === 'hex' ? encrypted.ciphertext.toString() : encrypted.toString()
              } else {
                const decrypted = CryptoJS.RC4.decrypt(data, key)
                return decrypted.toString(CryptoJS.enc.Utf8)
              }
            }

            case 'base64':
              if (mode === 'encrypt') {
                return btoa(unescape(encodeURIComponent(data)))
              } else {
                return decodeURIComponent(escape(atob(data)))
              }

            case 'md5':
              return CryptoJS.MD5(data).toString(
                encoding === 'hex' ? CryptoJS.enc.Hex : CryptoJS.enc.Base64
              )

            case 'sha1':
              return CryptoJS.SHA1(data).toString(
                encoding === 'hex' ? CryptoJS.enc.Hex : CryptoJS.enc.Base64
              )

            case 'sha256':
              return CryptoJS.SHA256(data).toString(
                encoding === 'hex' ? CryptoJS.enc.Hex : CryptoJS.enc.Base64
              )

            case 'sha512':
              return CryptoJS.SHA512(data).toString(
                encoding === 'hex' ? CryptoJS.enc.Hex : CryptoJS.enc.Base64
              )

            case 'url':
              return mode === 'encrypt' ? encodeURIComponent(data) : decodeURIComponent(data)

            case 'unicode':
              if (mode === 'encrypt') {
                return data
                  .split('')
                  .map((char) => '\\u' + char.charCodeAt(0).toString(16).padStart(4, '0'))
                  .join('')
              } else {
                return data.replace(/\\u[\dA-F]{4}/gi, (match) =>
                  String.fromCharCode(parseInt(match.replace(/\\u/g, ''), 16))
                )
              }

            case 'hex':
              if (mode === 'encrypt') {
                return data
                  .split('')
                  .map((char) => char.charCodeAt(0).toString(16).padStart(2, '0'))
                  .join('')
              } else {
                return data
                  .match(/.{2}/g)
                  .map((hex) => String.fromCharCode(parseInt(hex, 16)))
                  .join('')
              }
          }
        } catch (error) {
          throw new Error(`加解密失败: ${error.message}`)
        }
      }

      const result = crypto()

      // 发送结果
      complete({
        data: result
      })
    } catch (error) {
      throw error
    }
  } catch (error) {
    throw error
  }
}

export default execute
