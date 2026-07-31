/**
 * @file: 数据加解密节点
 * @author: dabao
 * @date: 2024-03-15
 */
import { RiDatabase2Line } from "@remixicon/vue"
import { typeText } from '../../../utils/typeColor'
export default {
  type: 'dataCreate',
  name: '创建数据',
  icon: RiDatabase2Line,
  description: '创建数据',
  view: false,
  config: {
    basic: {
      name: '基础配置',
      fields: {
        dataModel: {
          id: 'dataModel',
          name: '数据',
          nolabel: true,
          type: 'array',
          default: [],
          fields: [
            {
              id: 'name',
              name: '名称',
              type: 'string',
              default: '',
              required: true,
              description: '要创建的数据名称',
              quickConfig: true
            },
            {
              id: 'type',
              name: '类型',
              type: 'select',
              required: true,
              options: Object.keys(typeText).filter((key) => ['string', 'number', 'boolean', 'object', 'array'].includes(key)).map((key) => ({ label: typeText[key], value: key })),
              default: 'string',
              description: '要创建的数据类型',
              quickConfig: true
            },
            {
              id: 'stringValue',
              name: '初始值',
              type: 'text',
              show: '${type} === "string"',
              default: ''
            },
            {
              id: 'numberValue',
              name: '初始值',
              type: 'number',
              show: '${type} === "number"',
              default: 0
            },
            {
              id: 'booleanValue',
              name: '初始值',
              type: 'switch',
              show: '${type} === "boolean"',
              default: false
            },
            {
              id: 'objectValue',
              name: '初始值',
              type: 'code',
              show: '${type} === "object"',
              default: '{}'
            },
            {
              id: 'arrayValue',
              name: '初始值',
              type: 'code',
              show: '${type} === "array"',
              quickConfig: true,
              default: '[]'
            }
          ],
          description: '要创建的数据',
          quickConfig: true
        }
      }
    }
  },
  inputs: [],
  outputs: [
    {
      type: 'dynamic',
      dataPath: 'dataModel',
      fieldMap: {
        id: 'name',
        name: 'name',
        description: 'description',
        type: 'type',
        required: 'required',
        isConfig: true
      }
    }
  ]
}
