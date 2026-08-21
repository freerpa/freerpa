/**
 * @file: 元素编辑节点
 */
import { RiEditBoxLine } from "@remixicon/vue";

export default {
  type: 'browserElementEdit',
  name: '元素编辑',
  icon: RiEditBoxLine,
  description: '编辑页面上的元素',
  view: false,
  config: [
    {
      id: 'basic',
      name: '基础配置',
      fields: [
        {
          id: 'selector',
          name: '目标元素',
          type: 'selector',
          required: true,
          description: '要编辑的目标元素',
          default: '',
          quickConfig: true
        },
        {
          id: 'type',
          name: '修改类型',
          type: 'select',
          options: [
            { label: '追加属性值', value: 'appendAttrValue' },
            { label: '剔除属性值', value: 'removeAttrValue' },
            { label: '修改属性值', value: 'modifyAttrValue' },
            { label: '添加属性', value: 'addAttribute' },
            { label: '删除属性', value: 'deleteAttribute' },
            { label: '修改内容', value: 'modifyContent' },
            { label: '删除元素', value: 'deleteElement' },
          ],
          default: 'deleteElement',
          description: '要执行的编辑操作类型',
          quickConfig: true
        },
        {
          id: 'attrName',
          name: '属性名',
          type: 'text',
          show:"['appendAttrValue', 'removeAttrValue', 'modifyAttrValue', 'addAttribute', 'deleteAttribute'].includes(${type})",
          required: true,
          description: '要操作的属性名',
          default: '',
          quickConfig: true
        },
        {
          id: 'attrValue',
          name: '属性值',
          type: 'text',
          show:"['appendAttrValue', 'removeAttrValue', 'modifyAttrValue', 'addAttribute'].includes(${type})",
          required: true,
          description: '要操作的属性值',
          default: '',
          quickConfig: true
        },
        {
          id: 'content',
          name: '内容',
          type: 'text',
          show:"${type} === 'modifyContent'",
          required: true,
          description: '要修改的内容',
          default: '',
          quickConfig: true
        },
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
  outputs: []
}
