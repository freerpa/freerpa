/**
 * @file: 数据解析节点
 */
import { IconSwap } from '@arco-design/web-vue/es/icon'
import { format } from '../../common'

export default {
  type: 'dataParser',
  name: '解析数据',
  icon: IconSwap,
  description: '数据解析节点，根据规则按数据路径提取并转换数据字段，支持格式化输出',
  view: false,
  config: [
    {
      id: 'basic',
      name: '规则',
      fields: [
        // 数据路径
        {
          id: 'dataPath',
          name: '数据路径',
          type: 'string',
          default: '',
          description: '支持点号如：data.list.0.name'
        },
        {
          id: 'modelId',
          name: '获取字段',
          type: 'select',
          show: '${rules}.length == 0',
          props: {
            allowClear: true
          },
          default: '',
          options: [], // 动态获取数据表列表
          description: '自动获取数据表中的字段',
          remote: true,
          remoteMethod: async (keyword = '') => {
            const result = await window.electronAPI.data.getModels({
              page: 1,
              pageSize: 1000,
              keyword
            })
            return result.data.map((model) => ({
              label: model.name,
              value: model.id
            }))
          },
          onChange: async (value, formData) => {
            if (!value) {
              return
            }
            const model = await window.electronAPI.data.getModel(value)
            const fields = JSON.parse(model?.fields)
            if (formData.rules.length === 0 && fields?.length > 0) {
              fields.forEach((field) => {
                formData.rules.push({
                  field: field.name,
                  selector: '',
                  format: {}
                })
              })
            }
            formData.modelId = ''
          }
        },
        {
          id: 'rules',
          name: '解析规则',
          type: 'array',
          description: '仅输出解析规则中映射的字段，其他原始字段将不会输出',
          default: [],  
          fields: [
            {
              id: 'selector',
              name: '数据路径',
              type: 'string',
              description: '要选取的目标字段'
            },
            {
              id: 'field',
              name: '输出字段名',
              type: 'string',
              description: '输出的字段名'
            },
            format
          ]
        },
        {
          id: 'onlyValue',
          name: '仅输出值',
          type: 'switch',
          default: false,
          description: '如果解析规则只有一个，则可以仅输出值',
          show: '${rules}.length == 1'
        }
      ]
    }
  ],
  inputs: [
    {
      id: 'data',
      name: '数据',
      description: '支持数组、对象',
      type: ['array', 'object', 'string'],
      required: true
    }
  ],
  outputs: [
    {
      id: 'data',
      name: '解析结果',
      type: ['array', 'object', 'string'],
      description: '解析后的数据对象'
    }
  ]
}
