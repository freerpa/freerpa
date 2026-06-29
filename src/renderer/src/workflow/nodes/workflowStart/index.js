/**
 * @file: 开始节点
 * @author: dabao
 * @date: 2024-03-15
 */
import { IconPlayCircle } from '@arco-design/web-vue/es/icon'
import { dynamicFields, configFields } from '../common'

export default {
  type: 'workflowStart',
  name: '开始流程',
  icon: IconPlayCircle,
  description: '开始流程',
  prev: false,
  next: true,
  view: true,
  config: {
    basic: {
      name: '输入项',
      fields: {
        params: {
          id: 'params',
          name: '输入项',
          nolabel: true,
          type: 'array',
          description: '设置开始时的参数',
          default: [],
          fields: dynamicFields
        }
      }
    },
    config: {
      name: '配置项',
      fields: {
        config: {
          id: 'config',
          name: '配置项',
          nolabel: true,
          type: 'array',
          description: '设置配置项',
          default: [],
          fields: configFields
        }
      }
    }
  },
  inputs: [],
  outputs: [
    {
      type: 'dynamic',
      dataPath: 'params',
      fieldMap: {
        id: 'name',
        name: 'name',
        description: 'description',
        type: 'type',
        required: 'required'
      }
    },
    {
      type: 'dynamic',
      dataPath: 'config',
      fieldMap: {
        id: 'name',
        name: 'name',
        description: 'description',
        type: 'dataType',
        required: 'required',
        isConfig: true
      }
    }
  ]
}
