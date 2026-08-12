import { RiEyeLine } from '@remixicon/vue'
import { IO_FIELD_MAP_NAME_ID } from '../../../io-conventions.js'
/**
 * @file: 读取变量节点
 * @author: dabao
 */
export default {
  type: 'variableGet',
  name: '读取变量',
  icon: RiEyeLine,
  description: '读取全局变量',
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
              description: '要读取的变量名称',
              quickConfig: true
            }
          ],
          description: '要读取的全局变量',
          quickConfig: true
        }
      }
    }
  },
  inputs: [],
  outputs: [
    {
      type: 'dynamic',
      dataPath: 'variables',
      fieldMap: IO_FIELD_MAP_NAME_ID
    }
  ]
}
