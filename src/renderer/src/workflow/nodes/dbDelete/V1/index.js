/**
 * @file: 数据删除节点
 */
import { IconDelete } from '@arco-design/web-vue/es/icon'

export default {
  type: 'dbDelete',
  name: '数据删除',
  icon: IconDelete,
  description: '数据删除节点：根据“数据标识”（来自数据读取/保存节点）删除数据表中对应的数据行。',
  view: false,
  config: [],
  inputs: [
    {
      id: 'query',
      name: '数据标识',
      type: 'dataQuery',
      description: '数据标识（来自“数据读取/数据保存”节点的 query 输出），指定要删除的数据行'
    }
  ],
  outputs: []
}
