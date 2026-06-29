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
          description: '支持内置浏览器、比特浏览器和CDP连接',
          options: [
            {
              label: '内置',
              value: 'automan'
            },
            {
              label: '比特',
              value: 'bit'
            },
            {
              label: 'CDP',
              value: 'cdp'
            }
          ],
          quickConfig: true
        },
        offscreen: {
          id: 'offscreen',
          name: '无头模式',
          type: 'switch',
          default: false,
          description: '无头模式可以有效提升性能，但操作受限。',
          show: "['automan', 'bit'].includes(${browser})",
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
            {
              label: '静音运行',
              value: 'mute'
            },
            {
              label: '禁止图片',
              value: 'no_image'
            },
            {
              label: '拦截广告',
              value: 'ad_block'
            },
            {
              label: '允许新页面',
              value: 'new_page'
            }
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
          props: {
            allowClear: true
          },
          remoteMethod: async (keyword = '') => {
            const { getEnvList } = useStore()
            // 通过网络api获取浏览器列表
            const result = await getEnvList(keyword)
            return result.map((env) => ({
              label: env.name,
              value: env.id
            }))
          }
        },
        browser_type: {
          id: 'browser_type',
          name: '设备类型',
          type: 'radio',
          default: 'pc',
          description: '浏览器的模拟设备',
          show: '!${envId} && ${browser} === "automan"',
          options: [
            {
              label: '电脑',
              value: 'pc'
            },
            {
              label: '手机',
              value: 'mobile'
            },
            {
              label: '自定义',
              value: 'diy'
            }
          ],
          onChange: (val, formData) => {
            if (val === 'pc') {
              formData.value.browser_width = 1280
              formData.value.browser_height = 720
            } else if (val === 'mobile') {
              formData.value.browser_width = 345
              formData.value.browser_height = 700
            } else if (val === 'diy') {
              formData.value.browser_width = 1280
              formData.value.browser_height = 720
              formData.value.browser_ua = ''
            }
          },
          quickConfig: true
        },
        browser_width: {
          id: 'browser_width',
          name: '宽度',
          type: 'number',
          default: 1280,
          description: '浏览器宽度',
          min: 0,
          show: '${browser_type} === "diy"',
          quickConfig: true
        },
        browser_height: {
          id: 'browser_height',
          name: '高度',
          type: 'number',
          default: 720,
          description: '浏览器高度',
          min: 0,
          show: '${browser_type} === "diy"',
          quickConfig: true
        },
        browser_ua: {
          id: 'browser_ua',
          name: '标识',
          type: 'text',
          description: '浏览器UA',
          show: '${browser_type} === "diy"',
          quickConfig: true,
          required: true
        },
        proxyUrl: {
          id: 'proxyUrl',
          name: '代理地址',
          type: 'text',
          show: '${browser} === "automan"',
          description: '协议://用户名:密码@地址:端口',
          quickConfig: true
        },
        port: {
          id: 'port',
          name: '服务端口',
          type: 'number',
          default: 54345,
          description: '比特浏览器 Local API 端口号',
          min: 0,
          max: 65535,
          show: '${browser} === "bit"',
          quickConfig: true
        },
        bitWindow: {
          id: 'bitWindow',
          name: '运行环境',
          type: 'select',
          description: '选择比特浏览器窗口',
          quickConfig: true,
          show: '${browser} === "bit"',
          remote: true,
          required: true,
          props: {
            allowClear: true
          },
          remoteMethod: async (keyword = '', formData) => {
            let options = []
            try {
              const res = await fetch(`http://127.0.0.1:${formData.value.port}/browser/list`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  "page": 0,
                  "pageSize": 100
                })
              })
              const data = await res.json()
              options = data?.data?.list.map((env) => ({
                label: env.name,
                value: env.id
              })).filter((item) => item.label.includes(keyword))
            } catch (error) {
              options = []
              formData.value.bitWindow = ''
            }
            return options
          }
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
    {
      id: 'page',
      name: '浏览器',
      type: 'page',
      description: '浏览器'
    }
  ]
}
