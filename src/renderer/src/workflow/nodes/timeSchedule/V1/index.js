import { IO_FIELD_MAP_NAME_ID } from '../../../io-conventions.js'
/**
 * @file: 触发器节点
 */
import { IconPlayArrow } from '@arco-design/web-vue/es/icon'
import { configFields } from '../../common'

export default {
  type: 'timeSchedule',
  name: '定时触发',
  icon: IconPlayArrow,
  description: '定时触发节点（流程起点）：按配置的周期规则（每月/每周/每N天/每N时/每N分/每N秒）自动定时触发后续节点，也可手动确认触发。触发时输出配置的“触发参数”供下游使用。',
  view: true,
  config: [
    {
      id: 'basic',
      name: '基础配置',
      fields: [
        {
          id: 'enableSchedule',
          name: '定时',
          type: 'switch',
          default: false,
          description: '是否启用定时触发：开启后按下方周期规则自动触发；关闭时仅通过手动确认触发',
          quickConfig: true
        },
        {
          id: 'schedule',
          name: '周期',
          type: 'select',
          show: "${enableSchedule}",
          options: [

            {
              label: '每月',
              value: 'monthly'
            },
            {
              label: '每周',
              value: 'weekly'
            },
            {
              label: '每N天',
              value: 'day'
            },
            {
              label: '每N时',
              value: 'hour'
            },
            {
              label: '每N分',
              value: 'minute'
            },
            {
              label: '每N秒',
              value: 'second'
            },
          ],
          default: 'day',
          description: '触发周期：每月/每周/每N天/每N时/每N分/每N秒，决定按哪种粒度定时',
          quickConfig: true
        },
        {
          id: 'interval',
          name: 'N值',
          type: 'number',
          min: 1,
          max: 60,
          show: "['day','hour','minute','second'].includes(${schedule})",
          default: 1,
          description: '周期数值 N（每 N 天/时/分/秒触发一次），范围 1-60，默认 1',
          quickConfig: true
        },
        {
          id: 'week',
          name: '周',
          type: 'select',
          multiple: true,
          show: "['weekly'].includes(${schedule})",
          options: [
            {
              label: '周一',
              value: 1
            },
            {
              label: '周二',
              value: 2
            },
            {
              label: '周三',
              value: 3
            },
            {
              label: '周四',
              value: 4
            },
            {
              label: '周五',
              value: 5
            },
            {
              label: '周六',
              value: 6
            },
            {
              label: '周日',
              value: 0
            },
          ],
          default: [1],
          description: '每周触发时选择的星期（可多选），默认周一',
          required: true,
          props: {
            allowClear: true
          }
        },
        {
          id: 'day',
          name: '日',
          type: 'select',
          show: "['monthly'].includes(${schedule})",
          options: [],
          multiple: true,
          remote: true,
          remoteMethod: () => {
            const options = []
            for (let i = 1; i <= 31; i++) {
              options.push({
                label: i + '日',
                value: i
              })
            }
            return options
          },
          default: [1],
          description: '每月触发时选择的日期（1-31，可多选）',
          required: true,
          props: {
            allowClear: true
          }
        },
        {
          id: 'hour',
          name: '时',
          type: 'select',
          show: "['monthly','weekly','day'].includes(${schedule})",
          options: [],
          remote: true,
          multiple: true,
          remoteMethod: () => {
            const options = []
            for (let i = 0; i <= 23; i++) {
              options.push({
                label: i + '时',
                value: i
              })
            }
            return options
          },
          default: [0],
          description: '触发的小时（0-23，可多选）',
          required: true,
          props: {
            allowClear: true
          }
        },
        {
          id: 'minute',
          name: '分',
          type: 'select',
          show: "['monthly','weekly','day','hour'].includes(${schedule})",
          options: [],
          multiple: true,
          remote: true,
          remoteMethod: () => {
            const options = []
            for (let i = 0; i <= 59; i++) {
              options.push({
                label: i + '分',
                value: i
              })
            }
            return options
          },
          default: [0],
          description: '触发的分钟（0-59，可多选）',
          required: true,
          props: {
            allowClear: true
          }
        },
        {
          id: 'second',
          name: '秒',
          type: 'select',
          show: "['monthly','weekly','day','hour','minute'].includes(${schedule})",
          options: [],
          multiple: true,
          remote: true,
          remoteMethod: () => {
            const options = []
            for (let i = 0; i <= 59; i++) {
              options.push({
                label: i + '秒',
                value: i
              })
            }
            return options
          },
          default: [0],
          description: '触发的秒（0-59，可多选）',
          required: true,
          props: {
            allowClear: true
          }
        },
        {
          id: 'maxTimes',
          name: '次数',
          type: 'number',
          min: 0,
          default: 0,
          description: '最大触发次数，达到后停止定时并结束节点；0 表示不限制',
          quickConfig: true,
          show: "${enableSchedule}"
        },
        {
          id: 'params',
          name: '触发参数',
          type: 'array',
          description: '触发时随事件输出的参数列表（参数名 + 类型 + 默认值），供下游节点引用',
          fields: configFields
        }
      ]
    }
  ],
  inputs: [],
  outputs: [
    {
      type: 'dynamic',
      dataPath: 'params',
      fieldMap: { ...IO_FIELD_MAP_NAME_ID, type: 'dataType' }
    }
  ]
}
