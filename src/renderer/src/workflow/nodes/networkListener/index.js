/**
 * @file: 网络监听节点
 * @author: dabao
 * @date: 2024-03-15
 */
import { IconWifi } from '@arco-design/web-vue/es/icon'

export default {
  type: 'networkListener',
  name: '网络监听',
  icon: IconWifi,
  description: '监听网络请求',
  view: false,
  config: {
    basic: {
      name: '基础配置',
      fields: {
        url: {
          id: 'url',
          name: 'URL匹配',
          type: 'object',
          fields: {
            type: {
              id: 'type',
              name: '匹配方式',
              type: 'select',
              options: [
                { label: '精确匹配', value: 'exact' },
                { label: '包含', value: 'contains' },
                { label: '正则匹配', value: 'regex' },
                { label: '通配符', value: 'wildcard' }
              ],
              default: 'contains'
            },
            value: {
              id: 'value',
              name: '匹配值',
              type: 'string',
              required: true
            }
          }
        },
        method: {
          id: 'method',
          name: '请求方法',
          type: 'checkbox',
          options: [
            { label: 'GET', value: 'GET' },
            { label: 'POST', value: 'POST' },
            { label: 'PUT', value: 'PUT' },
            { label: 'DELETE', value: 'DELETE' }
          ],
          default: ['GET', 'POST', 'PUT', 'DELETE']
        },
        headers: {
          id: 'headers',
          name: '请求头匹配',
          type: 'array',
          fields: {
            name: {
              id: 'name',
              name: '请求头名称',
              type: 'string',
              required: true
            },
            type: {
              id: 'type',
              name: '匹配方式',
              type: 'radio',
              options: [
                { label: '精确匹配', value: 'exact' },
                { label: '包含', value: 'contains' },
                { label: '正则匹配', value: 'regex' }
              ],
              default: 'exact'
            },
            value: {
              id: 'value',
              name: '匹配值',
              type: 'string',
              required: true
            }
          }
        },
        params: {
          id: 'params',
          name: '参数匹配',
          type: 'array',
          fields: {
            name: {
              id: 'name',
              name: '参数名称',
              type: 'string',
              required: true
            },
            type: {
              id: 'type',
              name: '匹配方式',
              type: 'radio',
              options: [
                { label: '精确匹配', value: 'exact' },
                { label: '包含', value: 'contains' },
                { label: '正则匹配', value: 'regex' }
              ],
              default: 'exact'
            },
            value: {
              id: 'value',
              name: '匹配值',
              type: 'string',
              required: true
            }
          }
        },
        isContinuous: {
          id: 'isContinuous',
          name: '持续监听',
          type: 'switch',
          default: false,
          description:
            '选中则持续监听网络请求，否则只监听一次就卸载监听事件，等待下一次节点运行时重新监听。',
          quickConfig: true
        },
        configTip: {
          id: 'configTip',
          name: '配置提示',
          nolabel: true,
          type: 'alert',
          default: '',
          quickConfig: true,
          onlyQuick: true,
          content: '点击右上角齿轮配置网络监听参数'
        }
      }
    },
    content: {
      name: '响应匹配',
      fields: {
        // 资源类型过滤
        resourceTypes: {
          id: 'resourceTypes',
          name: '资源类型',
          type: 'checkbox',
          options: [
            { label: '文档', value: 'document' },
            { label: '样式表', value: 'stylesheet' },
            { label: '图片', value: 'image' },
            { label: '媒体', value: 'media' },
            { label: '字体', value: 'font' },
            { label: '脚本', value: 'script' },
            { label: 'XHR', value: 'xhr' },
            { label: 'Fetch', value: 'fetch' },
            { label: 'WS', value: 'websocket' }
          ],
          default: [
            'document',
            'stylesheet',
            'image',
            'media',
            'font',
            'script',
            'xhr',
            'fetch',
            'websocket'
          ],
          description: '要监听的资源类型'
        },
        // 状态码过滤
        statusCodes: {
          id: 'statusCodes',
          name: '状态码',
          type: 'checkbox',
          options: [
            { label: '成功(2xx)', value: '2xx' },
            { label: '重定向(3xx)', value: '3xx' },
            { label: '客户端错误(4xx)', value: '4xx' },
            { label: '服务器错误(5xx)', value: '5xx' }
          ],
          default: ['2xx', '3xx', '4xx', '5xx'],
          description: '要监听的响应状态码'
        },
        responseMatch: {
          id: 'responseMatch',
          name: '响应匹配',
          type: 'array',
          fields: {
            field: {
              id: 'field',
              name: '匹配字段',
              type: 'string',
              description: '要匹配的JSON字段路径'
            },
            operator: {
              id: 'operator',
              name: '操作符',
              type: 'select',
              options: [
                { label: '等于', value: 'eq' },
                { label: '不等于', value: 'ne' },
                { label: '包含', value: 'contains' },
                { label: '大于', value: 'gt' },
                { label: '小于', value: 'lt' },
                { label: '大于等于', value: 'gte' },
                { label: '小于等于', value: 'lte' },
                { label: '为空', value: 'empty' },
                { label: '不为空', value: 'notEmpty' },
                { label: '正则匹配', value: 'regex' }
              ],
              default: 'eq',
              description: '匹配操作符'
            },
            value: {
              id: 'value',
              name: '匹配值',
              type: 'string',
              description: '要匹配的值',
              show: '!["empty", "notEmpty"].includes(${operator})',
              required: true
            }
          },
          description: '响应内容匹配规则'
        }
      }
    }
  },
  inputs: [
    {
      id: 'page',
      name: '浏览器',
      type: 'page',
      required: true
    }
  ],
  outputs: [
    // {
    //   id: "page",
    //   name: "浏览器",
    //   type: "page",
    // },
    {
      id: 'request',
      name: '请求信息',
      type: 'object',
      description: '匹配到的请求信息'
    },
    {
      id: 'response',
      name: '响应信息',
      type: 'object',
      description: '匹配到的响应信息'
    },
    {
      id: 'responseData',
      name: '响应数据',
      type: 'any',
      description: '匹配到的响应数据'
    }
  ]
}
