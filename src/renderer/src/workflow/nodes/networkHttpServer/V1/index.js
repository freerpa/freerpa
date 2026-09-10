/**
 * @file: HTTP服务节点
 */
import { IconWifi } from '@arco-design/web-vue/es/icon'

export default {
  type: 'networkHttpServer',
  name: 'HTTP服务',
  icon: IconWifi,
  description: 'HTTP 服务节点：在本机启动一个共享 HTTP 服务并注册一个 GET 路由，收到请求时把查询参数注入“处理流程”子流程，子流程的返回结果作为 HTTP 响应返回给调用方。',
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
        description: 'HTTP 请求的查询参数对象（URL 上 ?key=value 部分）'
      }
    ],
    endOutputs: false
  },
  config: [
    {
      id: 'basic',
      name: '基础配置',
      fields: [
        {
          id: 'route',
          name: '地址',
          type: 'string',
          default: '/',
          required: true,
          description: '注册的路由地址（如 /api/hello），仅支持 GET 请求，收到请求后触发“处理流程”子流程'
        }
      ]
    }
  ],
  inputs: [],
  outputs: [
    {
      id: 'url',
      name: '地址',
      description: 'HTTP服务地址（http://localhost:端口 + 路由）',
      type: 'string'
    }
  ]
}
