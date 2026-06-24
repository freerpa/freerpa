/**
 * @file: 数据处理节点
 * @author: dabao
 * @date: 2024-03-29
 */
import { IconCode } from '@arco-design/web-vue/es/icon'

export default {
  type: 'dataHandler',
  name: '数据处理',
  icon: IconCode,
  description: '对数据进行处理转换',
  view: false,
  config: {
    basic: {
      name: '基础配置',
      fields: {
        type: {
          id: 'type',
          name: '处理类型',
          type: 'select',
          props: {
            allowClear: false
          },
          quickConfig: true,
          options: [
            { label: '文本操作', value: 'string' },
            { label: '数组操作', value: 'array' },
            { label: '数值操作', value: 'number' },
            { label: '自定义处理', value: 'custom' }
          ],
          default: 'array'
        },
        // 数组操作配置
        arrayOperation: {
          id: 'arrayOperation',
          name: '数组操作',
          type: 'select',
          props: {
            allowClear: false
          },
          show: "${type} === 'array'",
          quickConfig: true,
          default: 'unique',
          options: [
            { label: '去重', value: 'unique' },
            { label: '分组', value: 'group' },
            { label: '扁平化', value: 'flat' },
            { label: '截取', value: 'slice' },
            { label: '连接', value: 'join' },
            { label: '取长度', value: 'length' }
          ]
        },
        groupField: {
          id: 'groupField',
          name: '分组字段',
          type: 'string',
          quickConfig: true,
          show: "${type} === 'array' && ${arrayOperation} === 'group'",
          description: '支持点号分隔的路径'
        },
        joinSeparator: {
          id: 'joinSeparator',
          name: '连接符',
          type: 'string',
          quickConfig: true,
          show: "${type} === 'array' && ${arrayOperation} === 'join'",
          default: ''
        },
        sliceStart: {
          id: 'sliceStart',
          name: '起始位置',
          type: 'number',
          quickConfig: true,
          show: "${type} === 'array' && ${arrayOperation} === 'slice'",
          default: 0
        },
        sliceEnd: {
          id: 'sliceEnd',
          name: '结束位置',
          type: 'number',
          quickConfig: true,
          show: "${type} === 'array' && ${arrayOperation} === 'slice'"
        },
        // 字符串操作配置
        stringOperation: {
          id: 'stringOperation',
          name: '操作类型',
          type: 'select',
          props: {
            allowClear: false
          },
          show: "${type} === 'string'",
          quickConfig: true,
          default: 'substring',
          options: [
            { label: '截取', value: 'substring' },
            { label: '替换', value: 'replace' },
            { label: '分割', value: 'split' },
            { label: '转换大小写', value: 'case' },
            { label: '去除空格', value: 'trim' },
            { label: '取长度', value: 'length' }
          ]
        },
        start: {
          id: 'start',
          name: '起始位置',
          type: 'number',
          quickConfig: true,
          show: "${type} === 'string' && ${stringOperation} === 'substring'",
          default: 0
        },
        end: {
          id: 'end',
          name: '结束位置',
          type: 'number',
          quickConfig: true,
          show: "${type} === 'string' && ${stringOperation} === 'substring'"
        },
        searchValue: {
          id: 'searchValue',
          name: '查找内容',
          type: 'string',
          quickConfig: true,
          required: true,
          show: "${type} === 'string' && ${stringOperation} === 'replace'"
        },
        replaceValue: {
          id: 'replaceValue',
          name: '替换内容',
          type: 'string',
          quickConfig: true,
          show: "${type} === 'string' && ${stringOperation} === 'replace'",
          default: ''
        },
        separator: {
          id: 'separator',
          name: '分隔符',
          type: 'string',
          quickConfig: true,
          show: "${type} === 'string' && ${stringOperation} === 'split'"
        },
        caseType: {
          id: 'caseType',
          name: '转换类型',
          type: 'select',
          props: {
            allowClear: false
          },
          quickConfig: true,
          show: "${type} === 'string' && ${stringOperation} === 'case'",
          options: [
            { label: '转大写', value: 'upper' },
            { label: '转小写', value: 'lower' },
            { label: '首字母大写', value: 'capitalize' }
          ],
          default: 'upper'
        },
        // 数值操作配置
        numberOperation: {
          id: 'numberOperation',
          name: '数值操作',
          type: 'select',
          props: {
            allowClear: false
          },
          quickConfig: true,
          show: "${type} === 'number'",
          default: 'arithmetic',
          options: [
            { label: '运算', value: 'arithmetic' },
            { label: '取整', value: 'round' },
            { label: '保留小数', value: 'toFixed' },
            { label: '取绝对值', value: 'abs' }
          ]
        },
        operator: {
          id: 'operator',
          name: '运算符',
          type: 'select',
          props: {
            allowClear: false
          },
          quickConfig: true,
          show: "${type} === 'number' && ${numberOperation} === 'arithmetic'",
          default: '+',
          options: [
            { label: '加', value: '+' },
            { label: '减', value: '-' },
            { label: '乘', value: '*' },
            { label: '除', value: '/' },
            { label: '取余', value: '%' }
          ]
        },
        operand: {
          id: 'operand',
          name: '操作数',
          type: 'number',
          quickConfig: true,
          show: "${type} === 'number' && ${numberOperation} === 'arithmetic'"
        },
        roundType: {
          id: 'roundType',
          name: '取整方式',
          type: 'select',
          props: {
            allowClear: false
          },
          quickConfig: true,
          show: "${type} === 'number' && ${numberOperation} === 'round'",
          options: [
            { label: '四舍五入', value: 'round' },
            { label: '向上取整', value: 'ceil' },
            { label: '向下取整', value: 'floor' }
          ],
          default: 'round'
        },
        digit: {
          id: 'digit',
          name: '小数位数',
          type: 'number',
          quickConfig: true,
          show: "${type} === 'number' && ${numberOperation} === 'toFixed'",
          default: 2
        },
        // 自定义处理配置
        customCode: {
          id: 'customCode',
          name: '处理函数',
          type: 'code',
          language: 'javascript',
          show: "${type} === 'custom'",
          quickConfig: true,
          description: '自定义处理函数,data为输入数据',
          prefix: 'function handler(data){',
          default: 'return data',
          suffix: '}'
        }
      }
    }
  },
  inputs: [
    {
      id: 'data',
      name: '输入数据',
      type: 'any',
      required: true,
      description: '要处理的数据'
    }
  ],
  outputs: [
    {
      id: 'data',
      name: '处理结果',
      type: 'any',
      description: '处理后的数据'
    }
  ]
}
