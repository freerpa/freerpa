import { IconExclamationPolygonFill } from '@arco-design/web-vue/es/icon'

export default {
  type: 'workflowThrowException',
  name: '中断流程',
  icon: IconExclamationPolygonFill,
  description: '中断当前流程并抛出一个报错信息\n报错信息会被父级节点捕获并显示',
  prev: true,
  next: false,
  view: false,
  config: {
    basic: {
      name: '基础配置',
      fields: {
        err: {
          id: 'err',
          name: '报错信息',
          type: 'text',
          default: '',
          required: true,
          description: '抛出的报错信息',
          quickConfig: true
        },
      }
    }
  },
  inputs: [],
  outputs: []
}
