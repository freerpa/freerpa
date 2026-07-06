import { RiChromeLine } from "@remixicon/vue"

export default {
  type: 'browserOpen',
  name: '打开浏览器',
  icon: RiChromeLine,
  description: '打开一个浏览器',
  view: false,
  config: {
    basic: {
      name: '基础配置',
      fields: {
        browser: {
          id: 'browser',
          name: '打开方式',
          type: 'radio',
          default: 'automan',
          description: '支持内置浏览器和CDP连接',
          options: [
            { label: '内置浏览器', value: 'automan' },
            { label: 'CDP连接', value: 'cdp' }
          ],
          quickConfig: true
        },
        cdpUrl: {
          id: 'cdpUrl',
          name: '地址',
          type: 'input',
          default: '',
          description: 'CDP连接地址',
          show: '${browser} === "cdp"',
          quickConfig: true,
          required: true
        },
        envId: {
          id: 'envId',
          name: '浏览器',
          type: 'browser',
          required: true,
          description: '选择浏览器运行环境',
          quickConfig: true,
          show: '${browser} === "automan"',
          onChange: async (val, formData) => {
            if (!val) return
            const env = await window.electronAPI.browserLocal.getBrowser(val)
            if (env?.proxy_url && !formData.value.proxyUrl) {
              formData.value.proxyUrl = env.proxy_url
            }
          }
        },
        proxyUrl: {
          id: 'proxyUrl',
          name: '代理地址',
          type: 'text',
          show: '${browser} === "automan" && !!${envId}',
          description: '协议://用户名:密码@地址:端口',
          quickConfig: true
        },
        script: {
          id: 'script',
          name: '前置脚本',
          type: 'code',
          description: '每个新页面加载完成后立即执行的脚本',
          quickConfig: true
        },
        launchOptions: {
          id: 'launchOptions',
          name: '启动设置',
          type: 'checkbox',
          default: [],
          options: [
            { label: '无头模式', value: '--headless=new' },
            { label: '静音模式', value: '--mute-audio' },
            { label: '禁止图片', value: '--blink-settings=imagesEnabled=false' },
            { label: '自定义参数', value: '--custom-arg' },
          ],
          description: '无头模式可以有效提升性能，但操作受限。',
          show: "${browser} === 'automan'",
          quickConfig: true
        },
        extraArgs: {
          id: 'extraArgs',
          name: '启动参数',
          show: '${launchOptions}.includes("--custom-arg") && ${browser} === "automan"',
          type: 'array',
          default: [],
          fields: [
            {
              id: 'arg',
              name: '',
              type: 'text',
              noLabel: true,
              default: '',
            }
          ],
          description: '浏览器启动参数，如 "--headless=new" 等',
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
