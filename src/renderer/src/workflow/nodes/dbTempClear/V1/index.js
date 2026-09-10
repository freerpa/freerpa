/**
 * @file: 清空数据暂存节点
 */
import { IconEmpty } from '@arco-design/web-vue/es/icon'

export default {
  type: 'dbTempClear',
  name: '清空暂存',
  icon: IconEmpty,
  description: '清空暂存节点：清空“数据暂存”节点累积的暂存器数据，使其恢复为空数组。',
  view: false,
  config: [],
  inputs: [
    {
      id: 'tempStore',
      name: '暂存器',
      type: 'tempStore',
      description: '要清空的暂存器（来自“数据暂存”节点的 tempStore 输出）',
      required: true
    }
  ],
  outputs: []
}
