/**
 * @file: 访问URL节点
 */
import { IconLink } from '@arco-design/web-vue/es/icon'

export default {
  type: 'browserUrlVisit',
  name: '访问地址',
  icon: IconLink,
  description: '访问指定的URL地址或等待页面加载',
  config: [
    {
      id: 'basic',
      name: '基础配置',
      fields: [
        {
          id: 'action',
          name: '操作类型',
          type: 'select',
          default: 'goto',
          description: '操作类型',
          quickConfig: true,
          options: [
            { label: '访问页面', value: 'goto' },
            { label: '下载文件', value: 'download' },
            { label: '刷新页面', value: 'refresh' },
            { label: '前进', value: 'forward' },
            { label: '后退', value: 'back' },
            { label: '仅等待', value: 'listen' }
          ]
        },
        {
          id: 'url',
          name: 'URL地址',
          type: 'string',
          required: true,
          description: '要访问或下载的页面URL地址',
          quickConfig: true,
          show: '${action} === "goto" || ${action} === "download"'
        },
        {
          id: 'waitUntil',
          name: '等待时机',
          type: 'select',
          default: 'load',
          description: '页面加载完成的时机',
          options: [
            { label: '页面加载完成', value: 'load' },
            { label: 'DOM加载完成', value: 'domcontentloaded' },
            { label: '网络请求完成', value: 'networkidle0' }
          ],
          quickConfig: true
        },
        {
          id: 'timeout',
          name: '超时时间',
          type: 'number',
          default: 30000,
          description: '访问超时时间(毫秒)',
          min: 0,
          step: 1000,
          quickConfig: true
        }
      ]
    }
  ],
  inputs: [
    {
      id: 'page',
      name: '浏览器',
      type: 'page',
      required: true,
      description: '浏览器'
    }
  ],
  outputs: [
    {
      id: 'url',
      name: '当前URL',
      type: 'string',
      description: '当前URL地址'
    }
  ]
}
