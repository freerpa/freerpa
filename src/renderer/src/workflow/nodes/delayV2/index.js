/**
 * @file: 延时节点
 * @author: dabao
 * @date: 2024-03-15
 */
import { RiRestTimeLine } from '@remixicon/vue'

export default {
  type: 'delayV2',
  name: '延时等待',
  icon: RiRestTimeLine,
  description: '等待指定时间后继续执行',
  view: true,
  config: {
    basic: {
      name: '基础配置',
      fields: {
        mode: {
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
          description: '等待时间模式',
          quickConfig: true
        },
        duration: {
          id: 'duration',
          name: '等待时间',
          type: 'number',
          min: 0,
          default: 1000,
          description: '等待时间(毫秒)',
          quickConfig: true,
          show: "${mode}=='fixed'"
        },
        minDuration: {
          id: 'minDuration',
          name: '最小时间',
          type: 'number',
          min: 0,
          default: 1000,
          description: '最小等待时间(毫秒)',
          quickConfig: true,
          show: "${mode}=='random'"
        },
        maxDuration: {
          id: 'maxDuration',
          name: '最大时间',
          type: 'number',
          min: 0,
          default: 1000,
          description: '最大等待时间(毫秒)',
          quickConfig: true,
          show: "${mode}=='random'"
        }
      }
    }
  },
  inputs: [],
  outputs: []
}
