/**
 * @file: 判断节点
 */
import { IconBranch } from '@arco-design/web-vue/es/icon'
export default {
  type: 'workflowIf',
  name: '判断',
  icon: IconBranch,
  description: '条件判断节点：对输入数据执行一组规则并输出布尔结果（result: true / false），驱动流程分支。支持数值/字符串/空值/布尔/正则/日期等比较，多条规则可按“全部满足（and）”或“任一满足（or）”组合。',
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
          description: '多条规则的组合逻辑：and（全部规则满足才输出 true）/ or（任一规则满足即输出 true）'
        },
        {
          id: 'rules',
          name: '条件', 
          type: 'array',
          description: '判断规则列表，每条规则由“被比项（data）+ 比较符（operator）+ 比较项”构成；被比项可引用上游变量。未配置任何规则时默认输出 true。',
          quickConfig: true,
          paramRef: false,
          fields: [
            {
              id: 'data',
              name: '被比项',
              type: 'string',
              description: '被比较的数据来源，可引用上游节点输出变量或直接填写值',
              quickConfig: false
            },
            {
              id: 'operator',
              name: '比较符',
              type: 'select',
              description: '比较运算符，决定被比项与比较项的关系（数值/字符串/空值/布尔/正则/日期等）',
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
              description: '与“被比项”比较的目标值（用于等于/不等于/大小比较/包含/开头结尾等基础比较）',
              show: "['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'contains', 'notContains', 'startsWith', 'endsWith'].includes(${operator})"
            },
            {
              id: 'regex',
              name: '表达式',
              type: 'input',
              description: '正则表达式文本，用于“正则匹配”比较',
              show: "${operator} === 'regex'"
            },
            {
              id: 'startDate',
              name: '比较日期',
              type: 'date',
              description: '比较用的日期（“在日期之前/之后”比较的参照日期，“在时间范围内”的起始日期）',
              show: "['before', 'after', 'between'].includes(${operator})"
            },
            {
              id: 'endDate',
              name: '结束日期',
              type: 'date',
              description: '“在时间范围内”比较的结束日期（含边界）',
              show: "${operator} === 'between'"
            },
            {
              id: 'customCode',
              name: '自定义',
              type: 'code',
              language: 'javascript',
              description: '自定义判断函数体：接收参数 data（即被比项），返回布尔值决定规则结果',
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
