import { RiLogoutBoxLine } from '@remixicon/vue'
import { IO_FIELD_MAP_NAME_ID } from '../../../io-conventions.js'
/**
 * @file: 读取变量节点
 * @author: dabao
 */
export default {
  type: 'variableGet',
  name: '读取变量',
  icon: RiLogoutBoxLine,
  description: '读取全局变量节点：按变量名从全局变量存储中读取当前值并输出，供下游节点引用。',
  view: false,
  config: [
    {
      id: 'basic',
      name: '基础配置',
      fields: [
        {
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
              description: '要读取的全局变量名',
              quickConfig: true
            }
          ],
          description: '要读取的全局变量名列表，运行时逐个读取各变量当前值作为输出',
          quickConfig: true
        }
      ]
    }
  ],
  inputs: [],
  outputs: [
    {
      type: 'dynamic',
      dataPath: 'variables',
      fieldMap: IO_FIELD_MAP_NAME_ID
    }
  ]
}
