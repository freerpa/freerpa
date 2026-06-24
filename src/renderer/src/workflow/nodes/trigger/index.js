/**
 * @file: 触发器节点
 * @author: dabao
 * @date: 2024-03-15
 */
import { IconPlayArrow } from '@arco-design/web-vue/es/icon'
import { configFields } from '../common'
export default {
  type: 'trigger',
  name: '触发器',
  icon: IconPlayArrow,
  description: '用户手动、定时、循环触发后续节点',
  view: true,
  config: {
    basic: {
      name: '基础配置',
      fields: {
        triggerType: {
          id: 'triggerType',
          name: '触发方式',
          type: 'radio',
          options: [
            { label: '手动', value: 'manual' },
            { label: '直接', value: 'direct' },
            { label: '定时', value: 'schedule' },
            { label: '循环', value: 'loop' }
          ],
          default: 'manual',
          description: '选择触发方式',
          quickConfig: false
        },
        schedule: {
          id: 'schedule',
          name: '定时设置',
          type: 'object',
          show: "${triggerType} === 'schedule'",
          fields: {
            type: {
              id: 'type',
              name: '时间类型',
              type: 'select',
              options: [
                { label: '每天', value: 'daily' },
                { label: '每周', value: 'weekly' },
                { label: '每月', value: 'monthly' }
              ],
              default: 'daily',
              description: '选择定时类型'
            },
            time: {
              id: 'time',
              name: '执行时间',
              type: 'time',
              description: '每天执行的时间',
              default: '00:00:00',
              required: true
            },
            weekDay: {
              id: 'weekDay',
              name: '每周几',
              type: 'select',
              multiple: true,
              options: [
                { label: '周一', value: 1 },
                { label: '周二', value: 2 },
                { label: '周三', value: 3 },
                { label: '周四', value: 4 },
                { label: '周五', value: 5 },
                { label: '周六', value: 6 },
                { label: '周日', value: 0 }
              ],
              default: [],
              show: "${type} === 'weekly'",
              required: true
            },
            monthDay: {
              id: 'monthDay',
              name: '每月几号',
              type: 'select',
              multiple: true,
              options: Array.from({ length: 31 }, (_, i) => ({
                label: `${i + 1}号`,
                value: i + 1
              })),
              default: [],
              show: "${type} === 'monthly'",
              required: true
            },
            maxTimes: {
              id: 'maxTimes',
              name: '最大次数',
              type: 'number',
              min: 0,
              default: 0,
              description: '最大触发次数,0表示不限制'
            }
          }
        },
        loop: {
          id: 'loop',
          name: '循环设置',
          type: 'object',
          show: "${triggerType} === 'loop'",
          fields: {
            interval: {
              id: 'interval',
              name: '间隔时间',
              type: 'number',
              min: 100,
              default: 1000,
              description: '循环触发的间隔时间(毫秒)',
              required: true
            },
            maxTimes: {
              id: 'maxTimes',
              name: '最大次数',
              type: 'number',
              min: 0,
              default: 0,
              description: '最大触发次数,0表示无限循环'
            }
          }
        },
        params: {
          id: 'params',
          name: '触发参数',
          type: 'array',
          description: '设置触发时的参数',
          fields: configFields
        }
      }
    },
    advanced: {
      name: '高级配置',
      fields: {
        retryTimes: {
          id: 'retryTimes',
          name: '重试次数',
          type: 'number',
          min: 0,
          default: 0,
          description: '触发失败时的重试次数'
        },
        retryInterval: {
          id: 'retryInterval',
          name: '重试间隔',
          type: 'number',
          min: 1000,
          default: 5000,
          description: '重试的间隔时间(毫秒)',
          show: '${retryTimes} > 0'
        },
        timeout: {
          id: 'timeout',
          name: '超时时间',
          type: 'number',
          min: 0,
          default: 0,
          description: '触发超时时间(毫秒),0表示不限制'
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
