/**
 * @file: 数据过滤节点
 * @author: dabao
 * @date: 2024-03-15
 */
import { IconFilter } from '@arco-design/web-vue/es/icon'

export default {
  type: 'dataFilter',
  name: '过滤数据',
  icon: IconFilter,
  description: '对数据进行筛选和过滤',
  view: false,
  config: {
    basic: {
      name: '过滤规则',
      fields: {
        matchType: {
          id: 'matchType',
          name: '匹配方式',
          type: 'radio',
          options: [
            { label: '满足所有', value: 'and' },
            { label: '满足任一', value: 'or' }
          ],
          default: 'and',
          description: '多个条件的匹配方式',
          quickConfig: false
        },
        rules: {
          id: 'rules',
          name: '过滤条件',
          nolabel: true,
          type: 'array',
          description: '设置过滤条件',
          fields: {
            dataPath: {
              id: 'dataPath',
              name: '数据路径',
              type: 'string',
              description: '要过滤的数据路径,支持点号分隔,如: data.list',
              quickConfig: false
            },
            operator: {
              id: 'operator',
              name: '比较方式',
              type: 'select',
              options: [
                { label: '等于', value: 'eq' },
                { label: '不等于', value: 'ne' },
                { label: '大于', value: 'gt' },
                { label: '大于等于', value: 'gte' },
                { label: '小于', value: 'lt' },
                { label: '小于等于', value: 'lte' },
                { label: '包含', value: 'contains' },
                { label: '不包含', value: 'notContains' },
                { label: '开头是', value: 'startsWith' },
                { label: '结尾是', value: 'endsWith' },
                { label: '为空', value: 'isNull' },
                { label: '不为空', value: 'isNotNull' },
                { label: '正则匹配', value: 'regex' },
                // 日期特有的比较方式
                { label: '在日期之前', value: 'before' },
                { label: '在日期之后', value: 'after' },
                { label: '在时间范围内', value: 'between' },
                { label: '今天', value: 'today' },
                { label: '本周内', value: 'thisWeek' },
                { label: '本月内', value: 'thisMonth' },
                { label: '今年内', value: 'thisYear' },
                { label: '自定义', value: 'custom' }
              ],
              default: 'eq'
            },
            value: {
              id: 'value',
              name: '比较值',
              type: 'input',
              show: "['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'contains', 'notContains', 'startsWith', 'endsWith'].includes(${operator})"
            },
            regex: {
              id: 'regex',
              name: '表达式',
              type: 'input',
              show: "${operator} === 'regex'"
            },
            startDate: {
              id: 'startDate',
              name: '比较日期',
              type: 'date',
              show: "['before', 'after', 'between'].includes(${operator})"
            },
            endDate: {
              id: 'endDate',
              name: '结束日期',
              type: 'date',
              show: "${operator} === 'between'"
            },
            customCode: {
              id: 'customCode',
              name: '自定义',
              type: 'code',
              language: 'javascript',
              description: '自定义处理函数',
              prefix: 'function handler(data, source){',
              default: '//这里书写自定义处理代码\nreturn false',
              suffix: '}',
              description: '自定义处理函数',
              show: '${operator} === "custom"'
            }
          }
        }
      }
    }
  },
  inputs: [
    {
      id: 'data',
      name: '数据',
      type: 'array',
      required: true
    }
  ],
  outputs: [
    {
      id: 'data',
      name: '过滤结果',
      type: 'array',
      description: '过滤后的数据'
    }
  ]
}
