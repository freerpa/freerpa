/**
 * @file: 全局变量节点
 * @author: dabao
 * @date: 2024-03-15
 */
import { IconPlayCircle } from '@arco-design/web-vue/es/icon'
import { dynamicFields, configFields } from '../common'

export default {
  type: 'globalVariable',
  name: '全局变量',
  icon: IconPlayCircle,
  description: '全局变量',
  view: true,
  config: {
    basic: {
      name: '全局变量',
      fields: {
        params: {
          id: 'params',
          name: '变量名',
          nolabel: true,
          type: 'array',
          description: '设置全局变量',
          default: [],
          fields: dynamicFields
        }
      }
    },
    config: {
      name: '全局配置',
      fields: {
        config: {
          id: 'config',
          name: '全局配置',
          nolabel: true,
          type: 'array',
          description: '设置全局配置',
          default: [],
          fields: configFields
        }
      }
    }
  },
  inputs: [{
    type: 'dynamic',
    dataPath: 'params',
    fieldMap: {
      id: 'name',
      name: 'name',
      description: 'description',
      type: 'type',
      required: 'required'
    }
  }],
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
