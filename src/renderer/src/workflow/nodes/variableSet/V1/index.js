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
  description: '设置全局变量节点：把变量写入全局变量存储（跨节点、跨子流程共享）。每个变量的取值优先级为：上游输入同名数据 > 配置的默认值。',
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
              description: '全局变量名，写入后其他节点可用该名称读取',
              quickConfig: true
            }
          ],
          description: '要写入全局变量存储的变量列表（变量名 + 默认值）',
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
