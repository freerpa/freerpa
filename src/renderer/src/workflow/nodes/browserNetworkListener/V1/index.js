/**
 * @file: 网络监听节点
 */
import { IconWifi } from '@arco-design/web-vue/es/icon'
const mode = {
  id: 'mode',
  name: '模式',
  type: 'radio',
  description: '全部满足：所有规则都必须满足；任一满足：任意一个规则满足即可（常驻监听，需 workflowEnd 或手动停止结束流程）',
  options: [
    { label: '全部满足', value: 'all' },
    { label: '任一满足', value: 'any' }
  ],
  default: 'all'
}
const rules = {
  id: 'rules',
  name: '规则',
  type: 'array',
  default: [],
  fields: {
    name: {
      id: 'name',
      name: '参数名称',
      description: '要匹配的参数名称；响应匹配支持点号路径，如：data.0.title',
      type: 'string',
      required: true,
      default: ''
    },
    type: {
      id: 'type',
      name: '匹配方式',
      type: 'radio',
      options: [
        { label: '存在', value: 'exists' },
        { label: '等于', value: 'eq' },
        { label: '包含', value: 'contains' },
        { label: '为空', value: 'empty' },
        { label: '正则', value: 'regex' }
      ],
      default: 'eq'
    },
    value: {
      id: 'value',
      name: '匹配值',
      type: 'string',
      required: true,
      show: "!['exists','empty'].includes(${type})",
      default: ''
    }
  }
}
export default {
  type: 'browserNetworkListener',
  name: '网络监听',
  icon: IconWifi,
  description: '监听浏览器网络请求',
  view: false,
  config: {
    basic: {
      name: '基础配置',
      fields: {
        url: {
          id: 'url',
          name: 'URL匹配',
          type: 'object',
          default: {},
          fields: {
            mode,
            rules: {
              id: 'rules',
              name: '规则',
              type: 'array',
              default: [],
              fields: {
                type: {
                  id: 'type',
                  name: '匹配方式',
                  type: 'radio',
                  options: [
                    { label: '等于', value: 'eq' },
                    { label: '包含', value: 'contains' },
                    { label: '正则', value: 'regex' }
                  ],
                  default: 'contains'
                },
                value: {
                  id: 'value',
                  name: '匹配值',
                  type: 'string',
                  required: true,
                  default: ''
                }
              }
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
            { label: 'DELETE', value: 'DELETE' },
            { label: 'PATCH', value: 'PATCH' },
            { label: 'HEAD', value: 'HEAD' },
            { label: 'OPTIONS', value: 'OPTIONS' }
          ],
          default: ['GET', 'POST']
        },
        headers: {
          id: 'headers',
          name: '请求头匹配',
          type: 'object',
          default: {},
          fields: {
            mode,
            rules
          }
        },
        body: {
          id: 'body',
          name: '请求体匹配',
          type: 'object',
          default: {},
          fields: {
            mode,
            rules
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
          type: 'object',
          default: {},
          fields: {
            mode,
            rules
          },
          description: '响应内容规则'
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
      id: 'statusCode',
      name: '响应码',
      type: 'number',
      description: '匹配到的响应状态码'
    },
    {
      id: 'responseData',
      name: '响应数据',
      type: 'any',
      description: '匹配到的响应数据'
    }
  ]
}
