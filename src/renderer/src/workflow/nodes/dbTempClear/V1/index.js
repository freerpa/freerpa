/**
 * @file: 清空数据暂存节点
 */
import { IconEmpty } from '@arco-design/web-vue/es/icon'

export default {
  type: 'dbTempClear',
  name: '清空暂存',
  icon: IconEmpty,
  description: '清空暂存',
  view: false,
  config: [],
  inputs: [
    {
      id: 'tempStore',
      name: '暂存器',
      type: 'tempStore',
      description: '用于清空数据暂存',
      required: true
    }
  ],
  outputs: []
}
