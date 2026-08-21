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
  description: '开始流程',
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
          nolabel: true,
          type: 'array',
          description: '设置开始时的参数',
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
          nolabel: true,
          type: 'array',
          description: '设置配置项',
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
