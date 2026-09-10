import { IconExclamationPolygonFill } from '@arco-design/web-vue/es/icon'

export default {
  type: 'workflowThrowException',
  name: '中断流程',
  icon: IconExclamationPolygonFill,
  description: '中断流程节点：立即终止当前流程并抛出配置的报错信息，异常会向上传播，被父级（外层流程/调用方）捕获并显示。',
  prev: true,
  next: false,
  view: false,
  config: [
    {
      id: 'basic',
      name: '基础配置',
      fields: [
        {
          id: 'err',
          name: '报错信息',
          type: 'text',
          default: '',
          required: true,
          description: '中断时抛出的错误信息文本，将作为异常原因向上传播，并在流程执行记录/界面上显示',
          quickConfig: true
        },
      ]
    }
  ],
  inputs: [],
  outputs: []
}
