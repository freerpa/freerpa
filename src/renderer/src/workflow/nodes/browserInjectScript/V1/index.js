/**
 * @file: JavaScript注入节点
 */
import { RiJavascriptLine } from "@remixicon/vue";

export default {
  type: 'browserInjectScript',
  name: 'JS注入',
  icon: RiJavascriptLine,
  description: 'JS 注入节点：在浏览器页面上下文中执行自定义 JavaScript 代码（默认 async 执行），可用于读取页面数据、修改 DOM 或调用页面 API，并输出脚本的返回值。',
  config: [
    {
      id: 'basic',
      name: '基础配置',
      fields: [
        {
          id: 'code',
          name: 'js代码',
          type: 'code',
          language: 'javascript',
          quickConfig: true,
          description: '要注入并在页面上下文中执行的 JavaScript 代码（无需函数包裹，支持 async/await）',
          default: '// 在这里编写JavaScript代码\n\n\n\n'
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
      id: 'result',
      name: '执行结果',
      type: 'any',
      description: '脚本执行的返回值'
    }
  ]
}
