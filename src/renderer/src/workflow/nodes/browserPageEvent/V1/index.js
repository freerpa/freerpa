/**
 * @file: 页面事件监听节点（对应 puppeteer PageEvent）
 */
import { RiBroadcastLine } from '@remixicon/vue'

// 常见页面事件（剔除了网络请求/响应、页面关闭及崩溃、Metrics、Worker、Frame 增删等高阶事件）
const eventOptions = [
  { label: '页面跳转', value: 'framenavigated' },
  { label: '控制台消息', value: 'console' },
  { label: '弹窗（alert/confirm）', value: 'dialog' },
  { label: '打开新标签页', value: 'popup' },
  { label: '页面脚本报错', value: 'pageerror' }
]

export default {
  type: 'browserPageEvent',
  name: '页面事件',
  icon: RiBroadcastLine,
  description: '监听页面生命周期及各类事件（对应 puppeteer PageEvent）',
  view: false,
  config: [
    {
      id: 'basic',
      name: '基础配置',
      fields: [
        {
          id: 'event',
          name: '事件类型',
          type: 'select',
          options: eventOptions,
          default: 'console',
          description: '选择要监听的页面事件',
          quickConfig: true
        },
        {
          id: 'closeTab',
          name: '关闭新标签页',
          type: 'switch',
          default: false,
          show: "${event}==='popup'",
          description: '打开新标签页后自动关闭该新标签页',
          quickConfig: true
        },
        {
          id: 'waitUntil',
          name: '等待时机',
          type: 'select',
          default: 'load',
          show: "${event}==='framenavigated'",
          description: '页面跳转后等导航加载到什么状态再输出地址（page.waitForNavigation(awaitUntil)）',
          quickConfig: true,
          options: [
            { label: '不等待', value: '' },
            { label: '页面加载完成', value: 'load' },
            { label: '页面渲染完成', value: 'domcontentloaded' },
            { label: '网络加载完成', value: 'networkidle2' }
          ]
        },
        {
          id: 'isContinuous',
          name: '持续监听',
          type: 'switch',
          default: true,
          description: '是否持续监听该事件，否则只触发一次后卸载监听',
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
      required: true
    }
  ],
  outputs: [
    // 打开新标签页
    { id: 'newPageUrl', name: '标签页地址', type: 'string', show: "${event}==='popup'", description: '新标签页的地址' },
    { id: 'newPageCdp', name: '页面CDP链接', type: 'string', show: "${event}==='popup'", description: '新标签页的 DevTools CDP 调试链接' },
    // 页面跳转
    { id: 'url', name: '跳转后的地址', type: 'string', show: "${event}==='framenavigated'", description: '跳转后的页面地址' },
    // 控制台消息
    { id: 'consoleMessage', name: '消息内容', type: 'string', show: "${event}==='console'", description: '控制台输出的消息内容' },
    // 弹窗
    { id: 'dialogMessage', name: '弹窗内容', type: 'string', show: "${event}==='dialog'", description: '弹窗中显示的文字内容' },
    // 页面脚本报错
    { id: 'errorMessage', name: '错误信息', type: 'string', show: "${event}==='pageerror'", description: '页面脚本报错信息' }
  ]
}