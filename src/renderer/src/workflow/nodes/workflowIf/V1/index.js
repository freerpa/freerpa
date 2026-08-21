/**
 * @file: 判断节点
 */
import { IconBranch } from '@arco-design/web-vue/es/icon'
export default {
  type: 'workflowIf',
  name: '判断',
  icon: IconBranch,
  description: '根据条件执行不同分支',
  view: false,
  config: [
    {
      id: 'basic',
      name: '基础配置',
      fields: [
        {
          id: 'matchType',
          name: '逻辑',
          type: 'radio',
          paramRef: false,
          quickConfig: true,
          options: [
            { label: '满足所有', value: 'and' },
            { label: '满足任一', value: 'or' }
          ],
          default: 'and',
          description: '多个条件的判断方式'
        },
        {
          id: 'rules',
          name: '条件', 
          type: 'array',
          description: '设置判断条件',
          quickConfig: true,
          paramRef: false,
          fields: [
            {
              id: 'data',
              name: '被比项',
              type: 'string',
              quickConfig: false
            },
            {
              id: 'operator',
              name: '比较符',
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
                { label: '为是', value: 'isTrue' },
                { label: '为否', value: 'isFalse' },
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
              name: '比较项',
              type: 'input',
              show: "['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'contains', 'notContains', 'startsWith', 'endsWith'].includes(${operator})"
            },
            {
              id: 'regex',
              name: '表达式',
              type: 'input',
              show: "${operator} === 'regex'"
            },
            {
              id: 'startDate',
              name: '比较日期',
              type: 'date',
              show: "['before', 'after', 'between'].includes(${operator})"
            },
            {
              id: 'endDate',
              name: '结束日期',
              type: 'date',
              show: "${operator} === 'between'"
            },
            {
              id: 'customCode',
              name: '自定义',
              type: 'code',
              language: 'javascript',
              prefix: 'function handler(data){',
              default: '//这里书写自定义处理代码\nreturn false',
              suffix: '}',
              show: '${operator} === "custom"'
            }
          ]
        }
      ]
    }
  ],
  inputs: [],
  outputs: []
}
