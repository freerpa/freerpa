/**
 * @file: JavaScript注入节点
 */
import { RiJavascriptLine } from "@remixicon/vue";

export default {
  type: 'browserInjectScript',
  name: 'JS注入',
  icon: RiJavascriptLine,
  description: '向页面注入JavaScript代码，默认async执行',
  config: {
    basic: {
      name: '基础配置',
      fields: {
        code: {
          id: 'code',
          name: 'js代码',
          type: 'code',
          language: 'javascript',
          quickConfig: true,
          description: '要注入的JavaScript代码，无需函数包裹',
          default: '// 在这里编写JavaScript代码\n\n\n\n'
        }
      }
    }
  },
  inputs: [
    {
      id: 'page',
      name: '浏览器',
      type: 'page',
      required: true
    }
  ],
  outputs: [
    {
      id: 'result',
      name: '执行结果',
      type: 'any',
      description: '脚本执行的返回值'
    }
  ]
}
