import { RiChromeLine } from "@remixicon/vue"
import { useStore } from '@/store'

export default {
  type: 'browserOpen',
  name: '打开浏览器',
  icon: RiChromeLine,
  description: '打开一个浏览器',
  view: true,
  config: {
    basic: {
      name: '基础配置',
      fields: {
        browser: {
          id: 'browser',
          name: '浏览器',
          type: 'radio',
          default: 'automan',
          description: '支持内置浏览器和CDP连接',
          options: [
            { label: '内置', value: 'automan' },
            { label: 'CDP', value: 'cdp' }
          ],
          quickConfig: true
        },
        headless: {
          id: 'headless',
          name: '无头模式',
          type: 'switch',
          default: false,
          description: '无头模式可以有效提升性能，但操作受限。',
          show: "['automan'].includes(${browser})",
          quickConfig: true
        },
        cdpUrl: {
          id: 'cdpUrl',
          name: 'CDP地址',
          type: 'input',
          default: '',
          description: 'CDP连接地址',
          show: '${browser} === "cdp"',
          quickConfig: true
        },
        other: {
          id: 'other',
          name: '其他配置',
          type: 'checkbox',
          description: '静音运行：禁止浏览器播放音频\n禁止图片：禁止浏览器加载图片\n拦截广告：拦截网页上的广告\n允许新页面：允许浏览器target="_blank"或者 window.open打开新页面, 否则新页面将在当前页面打开',
          quickConfig: true,
          default: ['mute'],
          show: '${browser} === "automan"',
          options: [
            { label: '静音运行', value: 'mute' },
            { label: '禁止图片', value: 'no_image' },
            { label: '拦截广告', value: 'ad_block' },
            { label: '允许新页面', value: 'new_page' }
          ]
        },
        envId: {
          id: 'envId',
          name: '运行环境',
          type: 'select',
          description: '选择浏览器运行环境',
          quickConfig: true,
          show: '${browser} === "automan"',
          remote: true,
          props: { allowClear: true },
          remoteMethod: async (keyword = '') => {
            const { getEnvList } = useStore()
            const result = await getEnvList(keyword)
            return result.map((env) => ({
              label: env.name,
              value: env.id
            }))
          }
        },
        proxyUrl: {
          id: 'proxyUrl',
          name: '代理地址',
          type: 'text',
          show: '${browser} === "automan"',
          description: '协议://用户名:密码@地址:端口',
          quickConfig: true
        },
        script: {
          id: 'script',
          name: '前置脚本',
          type: 'code',
          description: '每个新页面加载完成后立即执行的脚本',
          quickConfig: true
        }
      }
    }
  },
  inputs: [],
  outputs: [
    { id: 'page', name: '浏览器', type: 'page', description: '浏览器' }
  ]
}
