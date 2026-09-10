/**
 * @file: 延时节点
 */
import { RiRestTimeLine } from '@remixicon/vue'

export default {
  type: 'timeDelay',
  name: '延时等待',
  icon: RiRestTimeLine,
  description: '延时等待节点：暂停执行指定的时长（固定值或随机区间，单位毫秒）后再继续执行后续节点。',
  view: true,
  config: [
    {
      id: 'basic',
      name: '基础配置',
      fields: [
        {
          id: 'mode',
          name: '等待模式',
          type: 'radio',
          options: [
            {
              label: '固定时间',
              value: 'fixed'
            },
            {
              label: '随机时间',
              value: 'random'
            }
          ],
          default: 'fixed',
          description: '等待模式：fixed（等待固定时长）/ random（在“最小时间-最大时间”区间内随机取时长）',
          quickConfig: true
        },
        {
          id: 'duration',
          name: '等待时间',
          type: 'number',
          min: 0,
          default: 1000,
          description: '固定模式的等待时长（毫秒）',
          quickConfig: true,
          show: "${mode}=='fixed'"
        },
        {
          id: 'minDuration',
          name: '最小时间',
          type: 'number',
          min: 0,
          default: 1000,
          description: '随机模式的最小等待时长（毫秒）',
          quickConfig: true,
          show: "${mode}=='random'"
        },
        {
          id: 'maxDuration',
          name: '最大时间',
          type: 'number',
          min: 0,
          default: 1000,
          description: '随机模式的最大等待时长（毫秒）',
          quickConfig: true,
          show: "${mode}=='random'"
        }
      ]
    }
  ],
  inputs: [],
  outputs: []
}
