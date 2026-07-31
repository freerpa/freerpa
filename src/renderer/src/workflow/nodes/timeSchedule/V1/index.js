/**
 * @file: 触发器节点
 * @author: dabao
 * @date: 2024-03-15
 */
import { IconPlayArrow } from '@arco-design/web-vue/es/icon'
import { configFields } from '../../common'

export default {
  type: 'timeSchedule',
  name: '定时触发',
  icon: IconPlayArrow,
  description: '定时触发后续节点',
  view: true,
  config: {
    basic: {
      name: '基础配置',
      fields: {
        enableSchedule: {
          id: 'enableSchedule',
          name: '定时',
          type: 'switch',
          default: false,
          description: '启用定时触发，配置定时规则',
          quickConfig: true
        },
        schedule: {
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
          description: '设置触发周期，默认天',
          quickConfig: true
        },
        interval: {
          id: 'interval',
          name: 'N值',
          type: 'number',
          min: 1,
          max: 60,
          show: "['day','hour','minute','second'].includes(${schedule})",
          default: 1,
          description: '设置N值，默认1',
          quickConfig: true
        },
        week: {
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
          description: '设置触发周，默认周一',
          required: true,
          props: {
            allowClear: true
          }
        },
        day: {
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
          description: '设置触发日',
          required: true,
          props: {
            allowClear: true
          }
        },
        hour: {
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
          description: '设置触发时',
          required: true,
          props: {
            allowClear: true
          }
        },
        minute: {
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
          description: '设置触发分',
          required: true,
          props: {
            allowClear: true
          }
        },
        second: {
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
          description: '设置触发秒',
          required: true,
          props: {
            allowClear: true
          }
        },
        maxTimes: {
          id: 'maxTimes',
          name: '次数',
          type: 'number',
          min: 0,
          default: 0,
          description: '最大触发次数,0表示不限制',
          quickConfig: true,
          show: "${enableSchedule}"
        },
        params: {
          id: 'params',
          name: '触发参数',
          type: 'array',
          description: '设置触发时的参数',
          fields: configFields
        }
      }
    }
  },
  inputs: [],
  outputs: [
    {
      type: 'dynamic',
      dataPath: 'params',
      fieldMap: {
        id: 'name',
        name: 'name',
        description: 'description',
        type: 'dataType'
      }
    }
  ]
}