/**
 * @file: 数据读取节点
 */
import { IconList } from '@arco-design/web-vue/es/icon'

export default {
  type: 'dataRead',
  name: '数据读取',
  icon: IconList,
  description: '从数据表中读取数据',
  view: false,
  config: [
    {
      id: 'basic',
      name: '基础配置',
      fields: [
        {
          id: 'modelId',
          name: '数据表',
          type: 'select',
          options: [], // 动态获取数据表列表
          required: true,
          description: '选择要读取的数据表',
          quickConfig: true,
          remote: true,
          remoteMethod: async (keyword = '') => {
            // 获取数据表列表
            const result = await window.electronAPI.data.getModels({
              page: 1,
              pageSize: 1000,
              keyword
            })

            return result.data.map((model) => ({
              label: model.name,
              value: model.id
            }))
          }
        },
        {
          id: 'startPage',
          name: '起始页码',
          type: 'number',
          min: 1,
          default: 1,
          description: '起始页码',
          quickConfig: true
        },
        {
          id: 'batchSize',
          name: '批次大小',
          type: 'number',
          min: 1,
          default: 10,
          description: '每次读取的数据条数',
          quickConfig: true
        },
        {
          id: 'conditions',
          name: '查询条件',
          type: 'array',
          description: '设置查询条件',
          fields: [
            {
              id: 'conditions',
              name: '条件',
              type: 'array',
              description: '设置查询条件',
              fields: [
                {
                  id: 'field',
                  name: '字段名',
                  type: 'input',
                  description: '要查询的字段名'
                },
                {
                  id: 'operator',
                  name: '操作符',
                  type: 'select',
                  options: [
                    { label: '等于', value: 'eq' },
                    { label: '不等于', value: 'ne' },
                    { label: '大于', value: 'gt' },
                    { label: '大于等于', value: 'gte' },
                    { label: '小于', value: 'lt' },
                    { label: '小于等于', value: 'lte' },
                    { label: '包含', value: 'like' },
                    { label: '不包含', value: 'notLike' },
                    { label: '在范围内', value: 'in' },
                    { label: '不在范围内', value: 'notIn' },
                    { label: '为空', value: 'isNull' },
                    { label: '不为空', value: 'isNotNull' }
                  ],
                  default: 'eq',
                  description: '查询操作符'
                },
                {
                  id: 'value',
                  name: '匹配值',
                  type: 'string',
                  description: '查询的值',
                  show: "!['isNull', 'isNotNull'].includes(${operator})"
                }
              ]
            },
            {
              id: 'logic',
              name: '逻辑',
              type: 'select',
              options: [
                { label: '全部满足', value: 'and' },
                { label: '任一满足', value: 'or' },
              ],
              default: 'and',
              description: '查询逻辑'
            }
          ]
        },
        {
          id: 'random',
          name: '随机读取',
          type: 'switch',
          default: false,
          description: '是否随机读取数据'
        },
        {
          id: 'sort',
          name: '排序设置',
          type: 'array',
          description: '设置排序规则',
          show: '!${random}',
          fields: [
            {
              id: 'field',
              name: '字段',
              type: 'string',
              description: '排序字段'
            },
            {
              id: 'order',
              name: '顺序',
              type: 'radio',
              options: [
                { label: '升序', value: 'asc' },
                { label: '降序', value: 'desc' }
              ],
              default: 'asc',
              description: '排序方式'
            }
          ]
        },
        {
          id: 'readFields',
          name: '读取字段',
          type: 'array',
          description: '设置要读取的字段',
          fields: [
            {
              id: 'field',
              name: '字段',
              type: 'string',
              description: '要读取的字段名'
            }
          ]
        }
      ]
    }
  ],
  inputs: [],
  outputs: [
    {
      id: 'data',
      name: '查询结果',
      type: 'array',
      description: '查询到的数据'
    },
    {
      id: 'dataLength',
      name: '结果条数',
      type: 'number',
      description: '查询到的结果条数'
    },
    {
      id: 'query',
      name: '数据标识',
      type: 'dataQuery',
      description: '用于删除和修改数据'
    },
    {
      id: 'total',
      name: '总条数',
      type: 'number',
      description: '查询到的总条数'
    }
  ]
}
