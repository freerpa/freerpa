/**
 * @file: 网络请求节点
 * @author: dabao
 * @date: 2024-03-15
 */
import { IconWifi } from '@arco-design/web-vue/es/icon'

export default {
  type: 'httpRequestV3',
  name: 'HTTP请求',
  icon: IconWifi,
  description: '发送HTTP请求',
  view: true,
  config: {
    basic: {
      name: '基础配置',
      fields: {
        method: {
          id: 'method',
          name: '请求方法',
          type: 'select',
          options: [
            { label: 'GET', value: 'GET' },
            { label: 'POST', value: 'POST' },
            { label: 'PUT', value: 'PUT' },
            { label: 'PATCH', value: 'PATCH' },
            { label: 'DELETE', value: 'DELETE' },
            { label: 'HEAD', value: 'HEAD' },
            { label: 'OPTIONS', value: 'OPTIONS' }
          ],
          default: 'GET',
          description: 'HTTP请求方法',
          required: true,
          quickConfig: true
        },
        url: {
          id: 'url',
          name: '请求地址',
          type: 'text',
          required: true,
          description: 'HTTP请求的URL地址',
          quickConfig: true
        },
        timeout: {
          id: 'timeout',
          name: '超时时间',
          type: 'number',
          default: 30000,
          description: '请求超时时间(毫秒)'
        },
        proxyUrl: {
          id: 'proxyUrl',
          name: '代理配置',
          type: 'text',
          default: '',
          quickConfig: true,
          description: '协议://用户名:密码@地址:端口'
        },
        headers: {
          id: 'headers',
          name: '请求头',
          type: 'array',
          codeView: {
            type: 'object',
            key: 'key',
            value: 'value'
          },
          defaultValue: [],
          fields: {
            key: {
              id: 'key',
              name: '参数名',
              type: 'text'
            },
            value: {
              id: 'value',
              name: '参数值',
              type: 'text'
            }
          },
          description: 'HTTP请求头'
        },
        bodyType: {
          id: 'bodyType',
          name: '类型',
          type: 'select',
          default: 'form-data',
          show: "['POST', 'PUT', 'PATCH', 'DELETE'].includes(${method})",
          description: '内容类型',
          options: [
            {
              label: 'form-data',
              value: 'form-data'
            },
            {
              label: 'urlencoded',
              value: 'urlencoded'
            },
            {
              label: 'json',
              value: 'json'
            },
            {
              label: 'xml',
              value: 'xml'
            },
            {
              label: 'javascript',
              value: 'javascript'
            },
            {
              label: 'plain',
              value: 'plain'
            },
            {
              label: 'html',
              value: 'html'
            }
          ]
        },
        bodyFormData: {
          id: 'bodyFormData',
          name: '请求体',
          type: 'array',
          description: '请求体参数',
          show: "${bodyType} === 'form-data' || ${bodyType} === 'urlencoded'",
          codeView: {
            type: 'object',
            key: 'key',
            value: 'value'
          },
          fields: {
            key: {
              id: 'key',
              name: '参数名',
              type: 'text',
              default: ''
            },
            value: {
              id: 'value',
              name: '参数值',
              type: 'text',
              default: ''
            }
          }
        },
        bodyFormFiles: {
          id: 'bodyFormFiles',
          name: '文件',
          type: 'array',
          description: '文件参数',
          show: "${bodyType} === 'form-data'",
          fields: {
            key: {
              id: 'key',
              name: '参数名',
              type: 'text',
              default: ''
            },
            file: {
              id: 'file',
              name: '文件',
              type: 'path',
              pathType: 'file',
              default: ''
            }
          }
        },
        bodyText: {
          id: 'bodyText',
          name: '请求体',
          description: '请求体内容',
          type: 'code',
          show: "['json', 'xml', 'javascript', 'plain', 'html'].includes(${bodyType})",
          language: '${bodyType}',
          default: ''
        }
      }
    }
  },
  inputs: [],
  outputs: [
    // 响应码
    {
      id: 'url',
      name: '请求地址',
      type: 'string',
      description: '请求地址'
    },
    {
      id: 'response',
      name: '响应信息',
      type: 'object',
      description: '完整的响应信息对象'
    },
    // 响应码
    {
      id: 'statusCode',
      name: '响应码',
      type: 'number',
      description: '请求响应码'
    },
    {
      id: 'responseData',
      name: '响应数据',
      type: 'any',
      description: '请求响应数据'
    }
  ]
}
