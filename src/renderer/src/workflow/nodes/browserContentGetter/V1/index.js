/**
 * @file: 内容获取节点
 */
import { RiArticleLine } from "@remixicon/vue";

export default {
  type: 'browserContentGetter',
  name: '内容获取',
  icon: RiArticleLine,
  description: '内容获取节点：从页面元素上提取文本、链接、图片、音频/视频、属性、表单值、计算样式、位置等数据；可一次获取多个元素、按元素状态过滤、对已获取列表去重，并支持 HTML 子项解析输出结构化字段。',
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
          description: '要获取内容的目标元素',
          default: '',
          quickConfig: true
        },
        {
          id: 'getAll',
          name: '获取全部',
          type: 'switch',
          default: false,
          description: '是否获取全部符合条件的元素,否则仅获取第一个符合条件的元素',
          quickConfig: true
        },
        {
          id: 'deduplicate',
          name: '是否去重',
          type: 'switch',
          default: false,
          description: '是否对已获取过内容的元素进行过滤,适用动态分页的列表获取（页面刷新或跳转后去重失效）',
          quickConfig: true
        },
        {
          id: 'elementState',
          name: '元素状态',
          type: 'checkbox',
          options: [
            { label: '可见', value: 'visible' },
            { label: '视口内', value: 'inViewport' }
          ],
          default: [],
          description: '目标元素需满足的状态：可见 / 在视口内（可多选，不选则不过滤）',
          quickConfig: true
        },
        {
          id: 'getType',
          name: '获取类型',
          type: 'select',
          options: [
            { label: '文本', value: 'text' },
            { label: '链接', value: 'link' },
            { label: '图片', value: 'image' },
            { label: '音频', value: 'audio' },
            { label: '视频', value: 'video' },
            { label: 'HTML内容（子项解析）', value: 'html' },
            { label: '元素属性', value: 'attribute' },
            { label: '表单值', value: 'value' },
            { label: '计算样式', value: 'style' },
            { label: '元素位置', value: 'position' }
          ],
          default: 'text',
          description: '要提取的内容类型：文本/链接/图片/音频/视频/HTML 子项解析/元素属性/表单值/计算样式/元素位置',
          quickConfig: true
        },
        {
          id: 'attributeName',
          name: '属性名称',
          type: 'input',
          description: '要获取的属性名称',
          default: '',
          show: '${getType} === "attribute"',
          required: '${getType} === "attribute"',
          quickConfig: true
        },
        {
          id: 'styleName',
          name: '样式名称',
          type: 'input',
          description: '要获取的样式属性名称',
          default: '',
          show: '${getType} === "style"',
          required: '${getType} === "style"'
        },
        //解析规则
        {
          id: 'parseRulesTip',
          nolabel: true,
          type: 'alert',
          content: '左侧面板配置子项解析规则',
          show: '${getType} == "html"',
          quickConfig: true,
          onlyQuick: true
        },
        {
          id: 'modelId',
          name: '获取字段',
          type: 'select',
          show: '${getType} == "html" && ${parseRules}.length === 0',
          default: '',
          props: {
            allowClear: true
          },
          options: [], // 动态获取数据表列表
          description: '选择数据表，自动按其字段生成解析规则',
          remote: true,
          remoteMethod: async (keyword = '') => {
            const result = await window.electronAPI.data.getModels({
              page: 1,
              pageSize: 1000,
              keyword
            })
            return result.data.map((model) => ({
              label: model.name,
              value: model.id
            }))
          },
          onChange: async (value, formData) => {
            if (!value) {
              return
            }
            const model = await window.electronAPI.data.getModel(value)
            const fields = JSON.parse(model?.fields)
            if (formData.parseRules.length === 0 && fields?.length > 0) {
              fields.forEach((field) => {
                formData.parseRules.push({
                  field: field.name,
                  selector: '',
                  getType: 'text',
                  attributeName: '',
                  styleName: ''
                })
              })
            }
            formData.modelId = ''
          }
        },
        //解析规则
        {
          id: 'parseRules',
          name: '解析规则',
          type: 'array',
          show: '${getType} == "html"',
          description: 'HTML 子项解析规则：为每个要输出的字段配置“字段名 + 子元素选择器 + 获取类型”，从列表项中提取结构化数据',
          default: [],
          quickConfig: false,
          fields: [
            {
              id: 'field',
              name: '字段名',
              description: '输出的内容字段名',
              type: 'input'
            },
            {
              id: 'selector',
              name: '子元素',
              description: '子元素,为空时取当前父元素',
              type: 'selector'
            },
            {
              id: 'getType',
              name: '获取类型',
              type: 'select',
              options: [
                { label: '文本', value: 'text' },
                { label: '链接', value: 'link' },
                { label: '图片', value: 'image' },
                { label: '音频', value: 'audio' },
                { label: '视频', value: 'video' },
                { label: 'HTML内容', value: 'html' },
                { label: '元素属性', value: 'attribute' },
                { label: '表单值', value: 'value' },
                { label: '计算样式', value: 'style' },
                { label: '元素位置', value: 'position' }
              ],
              default: 'text',
              description: '要获取的内容类型',
              quickConfig: true
            },
            {
              id: 'attributeName',
              name: '属性名称',
              type: 'input',
              description: '要获取的属性名称',
              show: '${getType} === "attribute"',
              required: '${getType} === "attribute"',
              quickConfig: true
            },
            {
              id: 'styleName',
              name: '样式名称',
              type: 'input',
              description: '要获取的样式属性名称',
              show: '${getType} === "style"',
              required: '${getType} === "style"'
            }
          ]
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
      id: 'content',
      name: '内容',
      type: ['string', 'array', 'object'],
      description: '获取到的内容，多个时为数组'
    }
  ]
}
