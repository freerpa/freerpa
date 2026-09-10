import { IO_FIELD_MAP_NAME_ID } from '../../../io-conventions.js'
/**
 * @file: 开始节点
 */
import { IconPlayCircle } from '@arco-design/web-vue/es/icon'
import { createDynamicFields, configFields } from '../../common'

export default {
  type: 'workflowStart',
  name: '开始流程',
  icon: IconPlayCircle,
  description: '工作流入口节点：定义流程启动时的输入项（params）与配置项（config），二者在流程运行期内作为可用变量供各节点引用。作为子流程使用时自动透传父级调用方传入的数据，不再自己定义。',
  prev: false,
  next: true,
  view: true,
  config: [
    {
      id: 'basic',
      name: '输入项',
      fields: [
        {
          id: 'params',
          name: '输入项',
          type: 'array',
          description: '流程启动时的输入参数列表（参数名 + 数据类型 + 默认值）。每个参数在流程运行期内都是可用变量；作为子流程或外部调用时，调用方按参数名注入同名数据。',
          default: [],
          fields: createDynamicFields()
        }
      ]
    },
    {
      id: 'config',
      name: '配置项',
      fields: [
        {
          id: 'config',
          name: '配置项',
          type: 'array',
          description: '流程级配置参数列表（参数名 + 数据类型 + 默认值），语义为流程的运行配置，运行期内同样作为变量供节点引用。',
          default: [],
          fields: configFields
        }
      ]
    }
  ],
  inputs: [],
  outputs: [
    {
      type: 'dynamic',
      dataPath: 'params',
      fieldMap: IO_FIELD_MAP_NAME_ID
    },
    {
      type: 'dynamic',
      dataPath: 'config',
      fieldMap: { ...IO_FIELD_MAP_NAME_ID, type: 'dataType' }
    }
  ]
}
