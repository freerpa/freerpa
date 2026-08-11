/**
 * @file: 数据删除节点
 */
import { IconDelete } from '@arco-design/web-vue/es/icon'

export default {
  type: 'dataDelete',
  name: '数据删除',
  icon: IconDelete,
  description: '删除数据表中的数据',
  view: false,
  config: {},
  inputs: [
    {
      id: 'query',
      name: '数据标识',
      type: 'dataQuery',
      description: '来自数据读取节点的数据查询标识'
    }
  ],
  outputs: []
}
