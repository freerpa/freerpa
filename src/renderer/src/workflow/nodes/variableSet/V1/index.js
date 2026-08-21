import { RiLoginBoxLine } from '@remixicon/vue'
import { IO_FIELD_MAP_NAME_ID } from '../../../io-conventions.js'
/**
 * @file: 设置变量节点
 * @author: dabao
 */
export default {
  type: 'variableSet',
  name: '设置变量',
  icon: RiLoginBoxLine,
  description: '设置全局变量',
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
              description: '变量名称',
              quickConfig: true
            }
          ],
          description: '要设置的全局变量',
          quickConfig: true
        }
      ]
    }
  ],
  inputs: [
    {
      type: 'dynamic',
      dataPath: 'variables',
      fieldMap: IO_FIELD_MAP_NAME_ID
    }
  ],
  outputs: [

  ]
}
