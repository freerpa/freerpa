/**
 * @file: 数据修改节点
 */
import { IconEdit } from '@arco-design/web-vue/es/icon'

export default {
  type: 'dbUpdate',
  name: '数据修改',
  icon: IconEdit,
  description: '数据修改节点：根据“数据标识”定位数据行，将指定字段批量修改为新值，输出修改的行数。',
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
          description: '要修改的字段列表：字段名 + 新值',
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
      description: '数据标识（来自“数据读取/数据保存”节点的 query 输出），指定要修改的数据行'
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
