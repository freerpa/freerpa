/**
 * @file: 数据提取节点
 */
import { IconMindMapping } from '@arco-design/web-vue/es/icon'
import { format } from '../../common'

export default {
  type: 'dataExtract',
  name: '提取数据',
  icon: IconMindMapping,
  description: '提取数据节点：按“提取规则”从输入数据中按点号路径取出指定字段并输出（数组输入时逐条解析为对象数组）；每个字段可应用格式化（时间/金额/数字/百分比/文件大小/自定义）。',
  view: false,
  config: [
    {
      id: 'basic',
      name: '提取规则',
      fields: [
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
          description: '选择数据表，自动按数据表字段生成提取规则',
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
                  field: field.description,
                  dataPath: field.name,
                  format: {}
                })
              })
            }
            formData.modelId = ''
          }
        },
        {
          id: 'rules',
          name: '提取规则',
          type: 'array',
          description: '提取规则列表：输出字段名 + 数据路径（支持点号，如 data.list.0.name）+ 可选格式化',
          default: [],
          fields: [
            {
              id: 'field',
              name: '字段名称',
              type: 'string',
              description: '输出字段名'
            },
            // 数据路径
            {
              id: 'dataPath',
              name: '数据路径',
              type: 'string',
              default: '',
              description: '支持点号如：data.list.0.name'
            },
            format
          ]
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
      type: 'dynamic',
      dataPath: 'rules',
      fieldMap: {
        id: 'field',
        name: 'field'
      }
    }
  ]
}
