import { RiDeleteBinLine } from '@remixicon/vue'
/**
 * @file: 删除变量节点
 * @author: dabao
 */
export default {
  type: 'variableDelete',
  name: '删除变量',
  icon: RiDeleteBinLine,
  description: '删除全局变量',
  view: false,
  config: {
    basic: {
      name: '基础配置',
      fields: {
        variables: {
          id: 'variables',
          name: '变量',
          nolabel: true,
          type: 'array',
          default: [],
          fields: [
            {
              id: 'name',
              name: '变量名',
              type: 'string',
              required: true,
              description: '要删除的变量名称',
              quickConfig: true
            }
          ],
          description: '要删除的全局变量',
          quickConfig: true
        }
      }
    }
  },
  inputs: [],
  outputs: []
}
