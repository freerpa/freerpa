/**
 * @file: 数据修改节点
 */
import { IconEdit } from '@arco-design/web-vue/es/icon'

export default {
  type: 'dbUpdate',
  name: '数据修改',
  icon: IconEdit,
  description: '修改数据表中的数据',
  view: false,
  config: [
    {
      id: 'basic',
      name: '基础配置',
      fields: [
        // 修改项
        {
          id: 'updateItems',
          name: '修改项',
          type: 'array',
          description: '设置修改字段',
          quickConfig: true,
          fields: [
            {
              id: 'field',
              name: '字段',
              type: 'input',
              required: true,
              description: '要修改的字段名'
            },
            {
              id: 'value',
              name: '值',
              type: 'input',
              description: '要修改的值'
            }
          ]
        }
      ]
    }
  ],
  inputs: [
    {
      id: 'query',
      name: '数据标识',
      type: 'dataQuery',
      description: '来自数据读取节点的数据查询标识'
    }
  ],
  outputs: [
    {
      id: 'count',
      name: '修改数量',
      type: 'number',
      description: '成功修改的数据数量'
    }
  ]
}
