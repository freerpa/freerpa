/**
 * @file: HTTP服务节点
 */
import { IconWifi } from '@arco-design/web-vue/es/icon'

export default {
  type: 'networkHttpServer',
  name: 'HTTP服务',
  icon: IconWifi,
  description: '创建一个HTTP服务来处理请求',
  view: true,
  subFlow: {
    name: '处理流程',
    startOutputs: [
      {
        id: 'params',
        name: '请求参数',
        type: 'object',
        default: {},
        required: true,
        description: '请求参数'
      }
    ],
    endOutputs: false
  },
  config: {
    basic: {
      name: '基础配置',
      fields: {
        route: {
          id: 'route',
          name: '地址',
          type: 'string',
          default: '/',
          required: true,
          description: 'HTTP服务的路由地址（/xxx/xxx）,仅GET请求'
        }
      }
    }
  },
  inputs: [],
  outputs: [
    {
      id: 'url',
      name: '地址',
      description: 'HTTP服务地址',
      type: 'string'
    }
  ]
}
