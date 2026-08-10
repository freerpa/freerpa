/**
 * @file: 元素集相关 AI 工具（elementSet 模块）
 * 执行器调用 window.electronAPI.elementSet.*（即主进程 elementSet:* IPC）
 */
const elementSet = () => window.electronAPI.elementSet

// 工具结果注入 LLM 上下文的大小上限（head/tail 截断，见 guard.js）
import { limitText, assertArgs } from './guard.js'

const toText = (res) => limitText(res)

export const createElementSetTools = () => [
  {
    type: 'function',
    function: {
      name: 'createElementSet',
      description:
        '创建元素集（网页元素选择器的集合）。仅当同一组元素需要被多个工作流/多次长期复用时才创建；常规少量元素不要建元素集——直接在浏览器节点 config 的 selector 字段内嵌元素对象 {name, match_condition, selectors} 即可。elements 为元素数组（可选）：每个元素含 name 与 selectors 选择器数组；selectors.type 支持 css（CSS 选择器）、xpath、text（按文本匹配，text_subtype 为 start/end/equals/contains）、position（坐标定位）；一个元素可配多个选择器并用 match_condition（any/all）决定命中条件。',
      strict: true,
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: '元素集名称' },
          description: { type: 'string', description: '描述', default: '' },
          category_id: { type: 'string', description: '所属分类ID（可选，默认不分类）', default: '' },
          elements: {
            type: 'array',
            description: '元素定义（可选）',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', description: '元素名称' },
                match_condition: {
                  type: 'string',
                  enum: ['any', 'all'],
                  description: '多选择器命中条件（any=任一命中，all=全部命中，默认 any）'
                },
                selectors: {
                  type: 'array',
                  description: '选择器列表（至少 1 个）',
                  items: {
                    type: 'object',
                    properties: {
                      type: {
                        type: 'string',
                        enum: ['css', 'xpath', 'text', 'position'],
                        description: '选择器类型：css=CSS 选择器，xpath=XPath，text=按文本匹配，position=坐标定位'
                      },
                      text_subtype: {
                        type: 'string',
                        enum: ['start', 'end', 'equals', 'contains'],
                        description: '仅 type=text 时使用：文本匹配方式'
                      },
                      expression: { type: 'string', description: '选择器表达式（css 选择器 / xpath / 文本内容 / 坐标）' }
                    },
                    required: ['type', 'expression'],
                    additionalProperties: false
                  }
                }
              },
              required: ['name', 'selectors'],
              additionalProperties: false
            }
          }
        },
        required: ['title'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'listElementSets',
      description:
        '列出所有元素集（网页元素选择器的集合）。搭建工作流需要网页元素时，先调用本工具查看现有元素集，优先匹配复用，不要每次都新建。',
      strict: true,
      parameters: {
        type: 'object',
        properties: {
          keyword: { type: 'string', description: '按名称搜索', default: '' },
          page: { type: 'number', description: '页码，默认1', default: 1 },
          pageSize: { type: 'number', description: '每页条数，默认20', default: 20 }
        },
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getElementSet',
      description:
        '获取单个元素集的完整详情（含元素与选择器）。取出的元素对象可直接作为浏览器节点 config 的 selector 字段值（节点存元素副本，与元素集无 ID 关联，复制使用即可）。',
      strict: true,
      parameters: {
        type: 'object',
        properties: { id: { type: 'string', description: '元素集ID' } },
        required: ['id'],
        additionalProperties: false
      }
    }
  }
]

export const createElementSetExecutors = () => ({
  createElementSet: async (args) => {
    const { title, description = '', category_id = '', elements = [] } = args || {}
    assertArgs(args, ['title'])
    if (!Array.isArray(elements)) throw new Error('elements 必须为数组')
    // 校验元素/选择器结构（与真实三表结构一致：elements[].selectors[].type/expression）
    for (const el of elements) {
      if (!el?.name) throw new Error('每个元素必须有 name')
      if (!Array.isArray(el.selectors) || el.selectors.length === 0) {
        throw new Error(`元素「${el.name}」至少需要 1 个 selectors（type 与 expression）`)
      }
    }
    return toText(await elementSet().createElementSet({ title, description, category_id, elements }))
  },
  listElementSets: async ({ keyword = '', page = 1, pageSize = 20 } = {}) =>
    toText(await elementSet().getElementSets({ keyword, page, pageSize })),
  getElementSet: async (args) => {
    assertArgs(args, ['id'])
    return toText(await elementSet().getElementSet(args.id))
  }
})
