import { RiLoginBoxLine } from '@remixicon/vue'
import { IO_FIELD_MAP_NAME_ID } from '../../../io-conventions.js'
/**
 * @file: 设置变量节点
 * @author: dabao
 */
export default {
  type: 'variableSet',
  name: '设置变量',
  icon: RiLoginBoxLine,
  description: '设置全局变量',
  view: false,
  config: {
    basic: {
      name: '基础配置',
      fields: {
        variables: {
          id: 'variables',
          name: '变量',
          nolabel: true,
          type: 'array',
          default: [],
          fields: [
            {
              id: 'name',
              name: '变量名',
              type: 'string',
              required: true,
              description: '变量名称',
              quickConfig: true
            },
            {
              id: 'type',
              name: '类型',
              type: 'select',
              required: true,
              options: [
                { label: '文本', value: 'string' },
                { label: '数字', value: 'number' },
                { label: '是否', value: 'boolean' },
                { label: '对象', value: 'object' },
                { label: '数组', value: 'array' },
                { label: '任意', value: 'any' }
              ],
              default: 'string',
              description: '变量类型',
              quickConfig: true
            },
            {
              id: 'stringValue',
              name: '默认值',
              type: 'text',
              show: '${type} === "string"',
              default: ''
            },
            {
              id: 'numberValue',
              name: '默认值',
              type: 'number',
              show: '${type} === "number"',
              default: 0
            },
            {
              id: 'booleanValue',
              name: '默认值',
              type: 'switch',
              show: '${type} === "boolean"',
              default: false
            },
            {
              id: 'objectValue',
              name: '默认值',
              type: 'code',
              show: '${type} === "object"',
              default: '{}'
            },
            {
              id: 'arrayValue',
              name: '默认值',
              type: 'code',
              show: '${type} === "array"',
              default: '[]'
            },
            {
              id: 'anyValue',
              name: '默认值',
              type: 'code',
              show: '${type} === "any"',
              default: ''
            }
          ],
          description: '要设置的全局变量',
          quickConfig: true
        }
      }
    }
  },
  inputs: [
    {
      type: 'dynamic',
      dataPath: 'variables',
      fieldMap: IO_FIELD_MAP_NAME_ID
    }
  ],
  outputs: [

  ]
}
