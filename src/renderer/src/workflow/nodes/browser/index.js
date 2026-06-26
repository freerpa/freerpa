import { RiChromeLine } from "@remixicon/vue"
import { useStore } from '@/store'

export default {
  type: 'browser',
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
          description: '内置浏览器为常规非指纹浏览器，如果需要高安全性的浏览器隔离请选择比特指纹浏览器',
          options: [
            {
              label: '内置浏览器',
              value: 'automan'
            },
            {
              label: '比特浏览器',
              value: 'bit'
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
          quickConfig: true
        },
        other: {
          id: 'other',
          name: '其他配置',
          type: 'checkbox',
          description: '静音运行：禁止浏览器播放音频\n禁止图片：禁止浏览器加载图片\n显示浏览器：浏览器创建成功后默认显示窗口\n允许打开新页面：允许浏览器target="_blank"或者 window.open打开新页面, 否则新页面将在当前页面打开',
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
              label: '创建后立即显示浏览器',
              value: 'show'
            },
            {
              label: '允许打开新页面',
              value: 'new_page'
            },
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
        waitUntil: {
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
          show: '${envId}',
          quickConfig: true
        },
        timeout: {
          id: 'timeout',
          name: '超时时间',
          type: 'number',
          default: 30000,
          description: '访问超时时间(毫秒)',
          min: 0,
          step: 1000,
          show: '${envId}'
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
