/**
 * @file: 网络请求节点
 */
import { IconWifi } from '@arco-design/web-vue/es/icon'

export default {
  type: 'networkHttpRequest',
  name: 'HTTP请求',
  icon: IconWifi,
  description: '发送 HTTP 请求，支持 GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS、自定义请求头、代理、form-data/urlencoded/json/xml/plain/html 请求体',
  view: true,
  config: [
    {
      id: 'basic',
      name: '基础配置',
      fields: [
        {
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
        {
          id: 'url',
          name: '请求地址',
          type: 'text',
          required: true,
          description: 'HTTP请求的URL地址',
          quickConfig: true
        },
        {
          id: 'timeout',
          name: '超时时间',
          type: 'number',
          default: 30000,
          description: '请求超时时间(毫秒)'
        },
        {
          id: 'proxyUrl',
          name: '代理配置',
          type: 'text',
          default: '',
          quickConfig: true,
          description: '协议://用户名:密码@地址:端口'
        },
        {
          id: 'headers',
          name: '请求头',
          type: 'array',
          codeView: {
            type: 'object',
            key: 'key',
            value: 'value'
          },
          defaultValue: [],
          fields: [
            {
              id: 'key',
              name: '参数名',
              type: 'text'
            },
            {
              id: 'value',
              name: '参数值',
              type: 'text'
            }
          ],
          description: 'HTTP请求头'
        },
        {
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
        {
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
          fields: [
            {
              id: 'key',
              name: '参数名',
              type: 'text',
              default: ''
            },
            {
              id: 'value',
              name: '参数值',
              type: 'text',
              default: ''
            }
          ]
        },
        {
          id: 'bodyFormFiles',
          name: '文件',
          type: 'array',
          description: '文件参数',
          show: "${bodyType} === 'form-data'",
          fields: [
            {
              id: 'key',
              name: '参数名',
              type: 'text',
              default: ''
            },
            {
              id: 'file',
              name: '文件',
              type: 'path',
              pathType: 'file',
              default: ''
            }
          ]
        },
        {
          id: 'bodyText',
          name: '请求体',
          description: '请求体内容',
          type: 'code',
          show: "['json', 'xml', 'javascript', 'plain', 'html'].includes(${bodyType})",
          language: '${bodyType}',
          default: ''
        }
      ]
    }
  ],
  inputs: [],
  outputs: [
    {
      id: 'requestUrl',
      name: '请求地址',
      type: 'string',
      description: '最终请求的 URL 地址'
    },
    {
      id: 'response',
      name: '响应信息',
      type: 'object',
      description: '完整响应对象（含 status/headers/data）'
    },
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
      description: '响应体数据（已按 Content-Type 解析；response.data 与之相同）'
    }
  ]
}
