import { RiChromeLine } from "@remixicon/vue"

export default {
  type: 'browserOpen',
  name: '打开浏览器',
  icon: RiChromeLine,
  description: '打开浏览器节点：启动一个内置浏览器实例（支持代理、无头模式、启动参数与前置脚本），或连接外部浏览器的 CDP 调试端口。输出页面对象（page），供后续所有网页控制类节点使用。',
  view: false,
  config: [
    {
      id: 'basic',
      name: '基础配置',
      fields: [
        {
          id: 'browser',
          name: '打开方式',
          type: 'radio',
          default: 'builtin',
          description: '打开方式：builtin（启动内置浏览器）/ cdp（连接外部浏览器的 CDP 调试端口）',
          options: [
            { label: '内置浏览器', value: 'builtin' },
            { label: 'CDP连接', value: 'cdp' }
          ],
          quickConfig: true
        },
        {
          id: 'cdpUrl',
          name: 'CDP地址',
          type: 'input',
          default: '',
          description: '外部浏览器的 CDP 调试地址（须以 ws:// 开头），仅“CDP连接”模式使用',
          show: '${browser} === "cdp"',
          quickConfig: true,
          required: true
        },
        {
          id: 'envId',
          name: '浏览器',
          type: 'browser',
          required: true,
          description: '选择要启动的浏览器运行环境（包含浏览器内核配置与可用代理，仅“内置浏览器”模式使用）',
          quickConfig: true,
          show: '${browser} === "builtin"',
          onChange: async (val, formData) => {
            if (!val) return
            const env = await window.electronAPI.browserLocal.getBrowser(val)
            if (env?.proxy_url && !formData.proxyUrl) {
              formData.proxyUrl = env.proxy_url
            }
          }
        },
        {
          id: 'proxyUrl',
          name: '代理地址',
          type: 'text',
          show: '${browser} === "builtin" && !!${envId}',
          description: '代理地址，格式：协议://用户名:密码@地址:端口（如 http://user:pass@127.0.0.1:7890）',
          quickConfig: true
        },
        {
          id: 'script',
          name: '前置脚本',
          type: 'code',
          description: '每个新页面加载完成后立即执行的 JavaScript 脚本（用于注入全局代码、屏蔽弹窗等）',
          quickConfig: true
        },
        {
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
          description: '浏览器启动选项：无头模式（提升性能但无界面、操作受限）、静音、禁止图片、自定义参数。',
          show: "${browser} === 'builtin'",
          quickConfig: true
        },
        {
          id: 'extraArgs',
          name: '启动参数',
          show: '${launchOptions}.includes("--custom-arg") && ${browser} === "builtin"',
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
          description: '自定义浏览器启动参数（如 "--headless=new"、"--disable-gpu" 等），需勾选“自定义参数”后生效',
          quickConfig: true
        }
      ]
    }
  ],
  inputs: [],
  outputs: [
    { id: 'page', name: '浏览器', type: 'page', description: '浏览器页面对象（供其他网页控制类节点使用）' }
  ]
}
