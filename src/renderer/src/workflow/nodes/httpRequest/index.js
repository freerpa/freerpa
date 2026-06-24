/**
 * @file: 网络请求节点
 * @author: dabao
 * @date: 2024-03-15
 */
import { IconWifi } from '@arco-design/web-vue/es/icon'

export default {
  type: 'httpRequest',
  name: '网络请求',
  icon: IconWifi,
  description: '发送HTTP请求',
  view: false,
  config: {
    basic: {
      name: '基础配置',
      fields: {
        url: {
          id: 'url',
          name: '请求地址',
          type: 'input',
          required: true,
          description: 'HTTP请求的URL地址',
          quickConfig: true
        },
        method: {
          id: 'method',
          name: '请求方法',
          type: 'select',
          options: [
            { label: 'GET', value: 'GET' },
            { label: 'POST', value: 'POST' },
            { label: 'PUT', value: 'PUT' },
            { label: 'DELETE', value: 'DELETE' }
          ],
          default: 'GET',
          description: 'HTTP请求方法',
          required: true,
          quickConfig: true
        },
        headers: {
          id: 'headers',
          name: '请求头',
          type: 'array',
          fields: {
            key: {
              id: 'key',
              name: '名称',
              type: 'input',
              required: true
            },
            value: {
              id: 'value',
              name: '值',
              type: 'input',
              required: true
            }
          },
          description: 'HTTP请求头'
        },
        body: {
          id: 'body',
          name: '请求体',
          type: 'array',
          show: "${method} !== 'GET'",
          fields: {
            key: {
              id: 'key',
              name: '字段名',
              type: 'input',
              required: true
            },
            value: {
              id: 'value',
              name: '字段值',
              type: 'input',
              required: true
            }
          },
          description: 'HTTP请求体'
        }
      }
    }
  },
  inputs: [
    {
      id: 'page',
      name: '浏览器',
      type: 'page',
      description: '如果传入此参数，则将网页作为上下文环境'
    },
    {
      id: 'request',
      name: '请求信息',
      type: 'object',
      description: '网络请求信息对象'
    }
  ],
  outputs: [
    // 响应码
    {
      id: 'url',
      name: '请求地址',
      type: 'string',
      description: 'HTTP请求地址'
    },
    // 响应码
    {
      id: 'statusCode',
      name: '响应码',
      type: 'number',
      description: 'HTTP响应码'
    },
    {
      id: 'response',
      name: '响应信息',
      type: 'object',
      description: 'HTTP响应信息对象'
    },
    {
      id: 'responseData',
      name: '响应数据',
      type: 'any',
      description: 'HTTP响应数据'
    }
  ]
}
