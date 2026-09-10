/**
 * @file: 数据过滤节点
 */
import { IconFilter } from '@arco-design/web-vue/es/icon'

export default {
  type: 'dataFilter',
  name: '过滤数据',
  icon: IconFilter,
  description: '过滤数据节点：对输入数组逐条按过滤条件判断，仅保留满足条件的数据（支持数值/字符串/空值/正则/日期比较与自定义函数，多条规则按“满足所有/任一”组合），输出过滤后的数组。',
  view: false,
  config: [
    {
      id: 'basic',
      name: '过滤规则',
      fields: [
        {
          id: 'matchType',
          name: '匹配方式',
          type: 'radio',
          options: [
            { label: '满足所有', value: 'and' },
            { label: '满足任一', value: 'or' }
          ],
          default: 'and',
          description: '多条规则的组合逻辑：and（全部满足才保留）/ or（任一满足即保留）',
          quickConfig: false
        },
        {
          id: 'rules',
          name: '过滤条件',
          nolabel: true,
          type: 'array',
          description: '过滤条件列表：数据路径 + 比较方式 + 比较值（支持多种比较符及日期、自定义函数）',
          fields: [
            {
              id: 'dataPath',
              name: '数据路径',
              type: 'string',
              description: '要过滤的数据路径,支持点号分隔,如: data.list',
              quickConfig: false
            },
            {
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
            {
              id: 'value',
              name: '比较值',
              type: 'input',
              description: '与目标字段比较的值（用于等于/不等于/大小/包含/开头结尾等）',
              show: "['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'contains', 'notContains', 'startsWith', 'endsWith'].includes(${operator})"
            },
            {
              id: 'regex',
              name: '表达式',
              type: 'input',
              description: '正则表达式文本（用于“正则匹配”）',
              show: "${operator} === 'regex'"
            },
            {
              id: 'startDate',
              name: '比较日期',
              type: 'date',
              description: '比较用日期（“在日期之前/之后”的参照日期，“在时间范围内”的起始日期）',
              show: "['before', 'after', 'between'].includes(${operator})"
            },
            {
              id: 'endDate',
              name: '结束日期',
              type: 'date',
              description: '“在时间范围内”比较的结束日期',
              show: "${operator} === 'between'"
            },
            {
              id: 'customCode',
              name: '自定义',
              type: 'code',
              language: 'javascript',
              description: '自定义过滤函数体：接收参数 data（目标字段值），返回布尔值决定是否保留',
              prefix: 'function handler(data, source){',
              default: '//这里书写自定义处理代码\nreturn false',
              suffix: '}',
              show: '${operator} === "custom"'
            }
          ]
        }
      ]
    }
  ],
  inputs: [
    {
      id: 'data',
      name: '数据',
      type: 'array',
      required: true,
      description: '要过滤的数组数据（传入单个对象时自动包装为数组）'
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
