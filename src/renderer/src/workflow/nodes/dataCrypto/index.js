/**
 * @file: 数据加解密节点
 * @author: dabao
 * @date: 2024-03-15
 */
import { IconSafe } from '@arco-design/web-vue/es/icon'

export default {
  type: 'dataCrypto',
  name: '加密解密',
  icon: IconSafe,
  description: '对数据进行加密或解密',
  view: false,
  config: {
    basic: {
      name: '基础配置',
      fields: {
        mode: {
          id: 'mode',
          name: '操作模式',
          type: 'radio',
          options: [
            { label: '加密', value: 'encrypt' },
            { label: '解密', value: 'decrypt' }
          ],
          default: 'encrypt',
          description: '加密或解密操作',
          quickConfig: true
        },
        algorithm: {
          id: 'algorithm',
          name: '算法类型',
          type: 'select',
          options: [
            { label: 'AES', value: 'aes' },
            { label: 'DES', value: 'des' },
            { label: '3DES', value: '3des' },
            { label: 'RC4', value: 'rc4' },
            { label: 'Base64', value: 'base64' },
            { label: 'MD5', value: 'md5' },
            { label: 'SHA1', value: 'sha1' },
            { label: 'SHA256', value: 'sha256' },
            { label: 'SHA512', value: 'sha512' },
            { label: 'URL编码', value: 'url' },
            { label: 'Unicode编码', value: 'unicode' },
            { label: 'Hex编码', value: 'hex' }
          ],
          default: 'aes',
          description: '加解密算法',
          quickConfig: true
        },
        key: {
          id: 'key',
          name: '密钥',
          type: 'password',
          description: '加解密密钥',
          show: "${algorithm} === 'aes' || ${algorithm} === 'des' || ${algorithm} === '3des' || ${algorithm} === 'rc4'",
          required:
            "${algorithm} === 'aes' || ${algorithm} === 'des' || ${algorithm} === '3des' || ${algorithm} === 'rc4'",
          quickConfig: true
        },
        iv: {
          id: 'iv',
          name: '初始向量',
          type: 'password',
          description: 'CBC模式的初始向量',
          show: "${algorithm} === 'aes' || ${algorithm} === 'des' || ${algorithm} === '3des'",
          quickConfig: true
        },
        encoding: {
          id: 'encoding',
          name: '编码方式',
          type: 'select',
          options: [
            { label: 'Base64', value: 'base64' },
            { label: 'Hex', value: 'hex' },
            { label: 'UTF-8', value: 'utf8' }
          ],
          default: 'base64',
          description: '输出编码格式',
          show: "${algorithm} !== 'base64' && ${algorithm} !== 'url' && ${algorithm} !== 'unicode' && ${algorithm} !== 'hex'",
          quickConfig: true
        },
        cipherMode: {
          id: 'cipherMode',
          name: '加密模式',
          type: 'select',
          options: [
            { label: 'ECB模式', value: 'ecb' },
            { label: 'CBC模式', value: 'cbc' },
            { label: 'CFB模式', value: 'cfb' },
            { label: 'OFB模式', value: 'ofb' },
            { label: 'CTR模式', value: 'ctr' }
          ],
          quickConfig: true,
          default: 'cbc',
          description: '分组密码工作模式',
          show: "${algorithm} === 'aes' || ${algorithm} === 'des' || ${algorithm} === '3des'"
        },
        padding: {
          id: 'padding',
          name: '填充方式',
          type: 'select',
          options: [
            { label: 'PKCS7', value: 'pkcs7' },
            { label: 'ZeroPadding', value: 'zero' },
            { label: 'NoPadding', value: 'nopadding' }
          ],
          quickConfig: true,
          default: 'pkcs7',
          description: '数据填充方式',
          show: "${algorithm} === 'aes' || ${algorithm} === 'des' || ${algorithm} === '3des'"
        },
        keySize: {
          id: 'keySize',
          name: '密钥长度',
          type: 'select',
          options: [
            { label: '128位', value: '128' },
            { label: '192位', value: '192' },
            { label: '256位', value: '256' }
          ],
          quickConfig: true,
          default: '256',
          description: 'AES密钥长度',
          show: "${algorithm} === 'aes'"
        }
      }
    }
  },
  inputs: [
    {
      id: 'data',
      name: '输入数据',
      type: 'any',
      required: true
    }
  ],
  outputs: [
    {
      id: 'data',
      name: '输出数据',
      type: 'string',
      description: '加解密后的数据'
    }
  ]
}
