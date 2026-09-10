/**
 * @file: 元素编辑节点
 */
import { RiEditBoxLine } from "@remixicon/vue";

export default {
  type: 'browserElementEdit',
  name: '元素编辑',
  icon: RiEditBoxLine,
  description: '元素编辑节点：修改页面元素的属性（追加/剔除/修改/添加/删除属性值）、替换元素内容文本，或直接删除整个元素，对所有匹配元素生效。',
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
          description: '编辑操作类型：追加/剔除/修改属性值、添加/删除属性、修改元素内容、删除元素',
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
          description: '要修改的内容文本',
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
      required: true,
      description: '浏览器页面对象（来自“打开浏览器”节点）'
    }
  ],
  outputs: []
}
