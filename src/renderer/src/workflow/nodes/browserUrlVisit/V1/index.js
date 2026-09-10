/**
 * @file: 访问URL节点
 */
import { IconLink } from '@arco-design/web-vue/es/icon'

export default {
  type: 'browserUrlVisit',
  name: '访问地址',
  icon: IconLink,
  description: '访问页面节点：在指定浏览器页面中执行访问 URL、下载文件、刷新、前进、后退或仅等待页面加载等操作，并输出操作完成后的当前 URL。',
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
          description: '操作类型：goto（访问页面）/ download（下载文件）/ refresh（刷新页面）/ forward（前进）/ back（后退）/ listen（仅等待页面加载完成）',
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
          description: '要访问或下载的页面 URL 地址（未带协议时自动补全 http://）',
          quickConfig: true,
          show: '${action} === "goto" || ${action} === "download"'
        },
        {
          id: 'waitUntil',
          name: '等待时机',
          type: 'select',
          default: 'load',
          description: '视为页面加载完成的时机：load（页面资源加载完成）/ domcontentloaded（DOM 解析完成）/ networkidle0（网络请求空闲）',
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
          description: '页面加载超时时间（毫秒），超时则操作失败',
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
      description: '浏览器页面对象（来自“打开浏览器”节点）'
    }
  ],
  outputs: [
    {
      id: 'url',
      name: '当前URL',
      type: 'string',
      description: '操作完成后的当前页面 URL 地址'
    }
  ]
}
