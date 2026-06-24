/**
 * @file: 网络请求节点
 * @author: dabao
 * @date: 2024-03-15
 */
import { IconWifi } from '@arco-design/web-vue/es/icon'

export default {
  type: 'httpRequestV2',
  name: 'HTTP请求',
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
          type: 'text',
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
        timeout: {
          id: 'timeout',
          name: '超时时间',
          type: 'number',
          default: 30000,
          description: '请求超时时间(毫秒)'
        },
        authType: {
          id: 'authType',
          name: '认证类型',
          type: 'select',
          options: [
            { label: '无', value: 'none' },
            { label: 'Basic Auth', value: 'basic' },
            { label: 'Bearer Token', value: 'bearer' }
          ],
          default: 'none',
          description: '认证类型'
        },
        username: {
          id: 'username',
          name: '用户名',
          type: 'text',
          show: "${authType} === 'basic'",
          description: 'Basic Auth用户名'
        },
        password: {
          id: 'password',
          name: '密码',
          type: 'password',
          show: "${authType} === 'basic'",
          description: 'Basic Auth密码'
        },
        token: {
          id: 'token',
          name: 'Token',
          type: 'text',
          show: "${authType} === 'bearer'",
          description: 'Bearer Token'
        },
        // proxy: {
        //   id: 'proxy',
        //   name: '代理配置',
        //   type: 'object',
        //   default: {
        //     enable: false,
        //     protocol: 'http',
        //     host: '',
        //     port: 80,
        //     username: '',
        //     password: ''
        //   },
        //   fields: {
        //     enable: {
        //       id: 'enable',
        //       name: '启用代理',
        //       type: 'switch',
        //       default: false
        //     },
        //     protocol: {
        //       id: 'protocol',
        //       name: '协议',
        //       type: 'select',
        //       options: [
        //         { label: 'HTTP', value: 'http' },
        //         { label: 'HTTPS', value: 'https' },
        //         { label: 'SOCKS4', value: 'socks4' },
        //         { label: 'SOCKS5', value: 'socks5' }
        //       ],
        //       default: 'http',
        //       show: '${enable} === true'
        //     },
        //     host: {
        //       id: 'host',
        //       name: '主机地址',
        //       type: 'text',
        //       show: '${enable} === true',
        //       required: true
        //     },
        //     port: {
        //       id: 'port',
        //       name: '端口',
        //       type: 'number',
        //       default: 80,
        //       show: '${enable} === true',
        //       required: true
        //     },
        //     username: {
        //       id: 'username',
        //       name: '用户名',
        //       type: 'text',
        //       show: '${enable} === true'
        //     },
        //     password: {
        //       id: 'password',
        //       name: '密码',
        //       type: 'password',
        //       show: '${enable} === true'
        //     }
        //   }
        // },
        headers: {
          id: 'headers',
          name: '请求头',
          type: 'array',
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
        cookie: {
          id: 'cookie',
          name: 'Cookie',
          type: 'array',
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
          description: 'HTTP请求Cookie'
        },
        body: {
          id: 'body',
          name: '请求体',
          type: 'object',
          show: "['POST', 'PUT', 'PATCH', 'DELETE'].includes(${method})",
          default: {
            type: 'form',
            form: []
          },
          fields: {
            type: {
              id: 'type',
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
            form: {
              id: 'form',
              name: '内容',
              type: 'array',
              show: "${type} === 'form-data' || ${type} === 'urlencoded'",
              fields: {
                key: {
                  id: 'key',
                  name: '参数名',
                  type: 'text',
                  default: ''
                },
                type: {
                  id: 'type',
                  name: '类型',
                  type: 'select',
                  default: 'text',
                  description: '仅form-data支持文件',
                  options: [
                    {
                      label: '文本',
                      value: 'text'
                    },
                    {
                      label: '文件',
                      value: 'file'
                    }
                  ]
                },
                value: {
                  id: 'value',
                  name: '参数值',
                  type: 'text',
                  show: "${type} === 'text'",
                  default: ''
                },
                file: {
                  id: 'file',
                  name: '文件',
                  type: 'path',
                  pathType: 'file',
                  show: "${type} === 'file'",
                  default: ''
                }
              }
            },
            text: {
              id: 'text',
              name: '内容',
              type: 'code',
              show: "['json', 'xml', 'javascript', 'plain', 'html'].includes(${type})",
              language: '${type}',
              default: ''
            }
          },
          description: 'HTTP请求体'
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
      description: 'HTTP请求地址'
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
